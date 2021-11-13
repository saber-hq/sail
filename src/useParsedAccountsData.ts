import type { KeyedAccountInfo, PublicKey } from "@solana/web3.js";
import zip from "lodash.zip";
import { useEffect, useMemo, useState } from "react";

import { getCacheKeyOfPublicKey, SailAccountParseError, useSail } from ".";
import type { ParsedAccountDatum } from "./types";
import { useAccountsData } from "./useAccountsData";

export type AccountParser<T> = (info: KeyedAccountInfo) => T;

/**
 * Parses accounts with the given parser.
 * @param keys
 * @param parser
 * @returns
 */
export const useParsedAccountsData = <T>(
  keys: (PublicKey | null | undefined)[],
  parser: AccountParser<T>
): ParsedAccountDatum<T>[] => {
  const { onError } = useSail();
  const data = useAccountsData(keys);
  const [parsed, setParsed] = useState<Record<string, ParsedAccountDatum<T>>>(
    keys.reduce<Record<string, ParsedAccountDatum<T>>>((acc, k) => {
      if (k) {
        acc[getCacheKeyOfPublicKey(k)] = undefined;
      }

      return acc;
    }, {})
  );

  useEffect(() => {
    setParsed((prevParsed) => {
      const nextParsed = { ...prevParsed };
      zip(keys, data).forEach(([key, datum]) => {
        if (datum) {
          const key = getCacheKeyOfPublicKey(datum.accountId);
          const prevValue = prevParsed[key];
          if (
            prevValue &&
            prevValue.raw.length === datum.accountInfo.data.length &&
            prevValue.raw.equals(datum.accountInfo.data)
          ) {
            // preserve referential equality if buffers are equal
            return;
          }
          try {
            const parsed = parser(datum);
            nextParsed[key] = {
              ...datum,
              accountInfo: {
                ...datum.accountInfo,
                data: parsed,
              },
              raw: datum.accountInfo.data,
            };
          } catch (e) {
            onError(new SailAccountParseError(e, datum));
            nextParsed[key] = null;
            return;
          }
        }
        if (key && datum === null) {
          nextParsed[getCacheKeyOfPublicKey(key)] = null;
        }
      });
      return nextParsed;
    });
  }, [data, keys, onError, parser]);

  return useMemo(() => {
    return keys.map((k) => {
      if (!k) {
        return k;
      }
      return parsed[getCacheKeyOfPublicKey(k)];
    });
  }, [keys, parsed]);
};

/**
 * Loads the parsed data of a single account.
 * @returns
 */
export const useParsedAccountData = <T>(
  key: PublicKey | null | undefined,
  parser: AccountParser<T>
): { loading: boolean; data: ParsedAccountDatum<T> } => {
  const theKey = useMemo(() => [key], [key]);
  const [data] = useParsedAccountsData(theKey, parser);
  return {
    loading: key !== undefined && data === undefined,
    data,
  };
};

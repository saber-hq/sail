import type { KeyedAccountInfo, PublicKey } from "@solana/web3.js";
import zip from "lodash.zip";
import { useEffect, useMemo, useState } from "react";

import { SailAccountParseError, useSail } from ".";
import type { ParsedAccountDatum } from "./types";
import { useAccountsData } from "./useAccountsData";

export type AccountParser<T> = (info: KeyedAccountInfo) => T;

/**
 * Parses accounts with the given parser.
 * @param keys
 * @param parser
 * @returns
 */
export const useParsedAccountsData = <T extends unknown>(
  keys: (PublicKey | null | undefined)[],
  parser: AccountParser<T>
): ParsedAccountDatum<T>[] => {
  const { onError } = useSail();
  const data = useAccountsData(keys);
  const [parsed, setParsed] = useState<Record<string, ParsedAccountDatum<T>>>(
    keys.reduce(
      (acc, k) => (k ? { ...acc, [k.toString()]: undefined } : acc),
      {}
    )
  );

  useEffect(() => {
    setParsed((prevParsed) => {
      const nextParsed = { ...prevParsed };
      zip(keys, data).forEach(([key, datum]) => {
        if (datum) {
          const key = datum.accountId.toString();
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
            nextParsed[key.toString()] = null;
            return;
          }
        }
        if (key && datum === null) {
          nextParsed[key.toString()] = null;
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
      return parsed[k.toString()];
    });
  }, [keys, parsed]);
};

/**
 * Loads the parsed data of a single account.
 * @returns
 */
export const useParsedAccountData = <T extends unknown>(
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

import type { KeyedAccountInfo, PublicKey } from "@solana/web3.js";
import { useEffect, useState } from "react";

import { SailAccountParseError, useSail } from ".";
import type { ParsedAccountDatum } from "./types";
import { useAccountsData } from "./useAccountsData";

export type AccountParser<T> = (info: KeyedAccountInfo) => T;

export const useParsedAccountsData = <T extends unknown>(
  keys: (PublicKey | null | undefined)[],
  parser: AccountParser<T>
): ParsedAccountDatum<T>[] => {
  const { onError } = useSail();
  const data = useAccountsData(keys);
  const [parsed, setParsed] = useState<ParsedAccountDatum<T>[]>(
    keys.map((k) => (k === null ? null : undefined))
  );

  useEffect(() => {
    setParsed((prevParsed) => {
      return data.map((datum, i) => {
        if (datum) {
          if (prevParsed[i]?.raw.equals(datum.accountInfo.data)) {
            return prevParsed[i];
          }
          try {
            const parsed = parser(datum);
            return {
              ...datum,
              accountInfo: {
                ...datum.accountInfo,
                data: parsed,
              },
              raw: datum.accountInfo.data,
            };
          } catch (e) {
            onError(new SailAccountParseError(e, datum));
            return null;
          }
        }
        return datum;
      });
    });
  }, [data, onError, parser]);

  return parsed;
};

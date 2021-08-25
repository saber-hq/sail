import type { KeyedAccountInfo, PublicKey } from "@solana/web3.js";
import { useEffect, useState } from "react";

import type { ParsedAccountDatum } from "./types";
import { useAccountsData } from "./useAccountsData";

export type AccountParser<T> = (info: KeyedAccountInfo) => T;

export const useParsedAccountsData = <T extends unknown>(
  keys: (PublicKey | null | undefined)[],
  parser: AccountParser<T>
): ParsedAccountDatum<T>[] => {
  const data = useAccountsData(keys);
  const [parsed, setParsed] = useState<ParsedAccountDatum<T>[]>(
    keys.map(() => undefined)
  );

  useEffect(() => {
    setParsed((prevParsed) => {
      return data.map((datum, i) => {
        if (datum) {
          if (prevParsed[i]?.raw.equals(datum.accountInfo.data)) {
            return prevParsed[i];
          }
          return {
            ...datum,
            accountInfo: {
              ...datum.accountInfo,
              data: parser(datum),
            },
            raw: datum.accountInfo.data,
          };
        }
        return datum;
      });
    });
  }, [data, parser]);

  return parsed;
};

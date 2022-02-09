import type { ProgramAccount } from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import { useEffect } from "react";
import type { UseQueryOptions, UseQueryResult } from "react-query";
import { useQuery } from "react-query";

import { fetchKeysMaybe, serializeKeys } from "..";
import { useSail } from "../provider";
import type { ProgramAccountParser } from "./programAccounts";

/**
 * Result of a parsed account query.
 */
export type BatchParsedAccountQueryResult<T> = UseQueryResult<
  BatchedParsedAccountQueryData<T>
>;

export type BatchedParsedAccountQueryData<T> = readonly (
  | ProgramAccount<T>
  | null
  | undefined
)[];

/**
 * Parses accounts with the given parser, fetching them in batch.
 *
 * @param keys
 * @param parser
 * @returns
 */
export const useBatchedParsedAccounts = <T>(
  keys: (PublicKey | null | undefined)[],
  parser: ProgramAccountParser<T>,
  options: Omit<
    UseQueryOptions<BatchedParsedAccountQueryData<T>>,
    "queryFn" | "queryKey"
  > = {}
): BatchParsedAccountQueryResult<T> => {
  const { fetchKeys, onBatchCache } = useSail();

  const query = useQuery(
    ["batchedParsedAccounts", ...serializeKeys(keys)],
    async (): Promise<readonly (ProgramAccount<T> | null | undefined)[]> => {
      const accountsData = await fetchKeysMaybe(fetchKeys, keys);
      return accountsData.map(
        (result): ProgramAccount<T> | null | undefined => {
          if (!result) {
            return result;
          }
          const data = result.data;
          if (!data) {
            return null;
          }
          const parsed = parser.parse(data.accountInfo.data);
          return {
            publicKey: data.accountId,
            account: parsed,
          };
        }
      );
    },
    options
  );

  // refresh from the cache whenever the cache is updated
  const { refetch } = query;
  useEffect(() => {
    return onBatchCache((e) => {
      if (keys.find((key) => key && e.hasKey(key))) {
        void refetch();
      }
    });
  }, [keys, fetchKeys, onBatchCache, refetch]);

  return query;
};

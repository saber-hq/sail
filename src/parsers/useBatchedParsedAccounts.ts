import { exists } from "@saberhq/solana-contrib";
import type { ProgramAccount } from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import type { UseQueryResult } from "react-query";
import { useQuery } from "react-query";
import invariant from "tiny-invariant";

import { serializeKeys } from "..";
import { useSail } from "../provider";
import type { ProgramAccountParser } from "./programAccounts";

/**
 * Result of a parsed account query.
 */
export type BatchParsedAccountQueryResult<T> = UseQueryResult<
  readonly (ProgramAccount<T> | null | undefined)[]
>;

/**
 * Parses accounts with the given parser, fetching them in batch.
 *
 * @param keys
 * @param parser
 * @returns
 */
export const useBatchedParsedAccounts = <T>(
  keys: (PublicKey | null | undefined)[],
  parser: ProgramAccountParser<T>
): BatchParsedAccountQueryResult<T> => {
  const { fetchKeys } = useSail();
  const query = useQuery(
    ["batchedParsedAccounts", ...serializeKeys(keys)],
    async (): Promise<readonly (ProgramAccount<T> | null | undefined)[]> => {
      const keysWithIndex = keys.map((k, i) => [k, i] as const);
      const nonEmptyKeysWithIndex = keysWithIndex.filter(
        (key): key is readonly [PublicKey, number] => exists(key[0])
      );
      const nonEmptyKeys = nonEmptyKeysWithIndex.map((n) => n[0]);
      const accountsData = await fetchKeys(nonEmptyKeys);
      const result = accountsData.map(({ data }): ProgramAccount<T> | null => {
        if (!data) {
          return null;
        }
        const parsed = parser.parse(data.accountInfo.data);
        return {
          publicKey: data.accountId,
          account: parsed,
        };
      });
      return keysWithIndex.map(([key, index]) => {
        const found = nonEmptyKeysWithIndex.findIndex((k) => k[1] === index);
        if (found !== -1) {
          return result[found];
        }
        invariant(!key, "key should be empty");
        return key;
      });
    }
  );
  return query;
};

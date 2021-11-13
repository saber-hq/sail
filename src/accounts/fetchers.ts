import type {
  AccountInfo,
  Commitment,
  Connection,
  PublicKey,
} from "@solana/web3.js";

import { SailGetMultipleAccountsError } from "..";

export function chunks<T>(array: readonly T[], size: number): T[][] {
  return Array.apply<number, T[], T[][]>(
    0,
    new Array(Math.ceil(array.length / size)) as T[]
  ).map((_, index) => array.slice(index * size, (index + 1) * size));
}

const GET_MULTIPLE_ACCOUNTS_CHUNK_SIZE = 99;

export const getMultipleAccounts = async (
  connection: Connection,
  keys: readonly PublicKey[],
  onGetMultipleAccountsError: (err: SailGetMultipleAccountsError) => void,
  commitment: Commitment = "recent"
): Promise<{
  keys: readonly PublicKey[];
  array: readonly (AccountInfo<Buffer> | null | SailGetMultipleAccountsError)[];
}> => {
  const result = await Promise.all(
    chunks(keys, GET_MULTIPLE_ACCOUNTS_CHUNK_SIZE).map(
      async (
        chunk
      ): Promise<
        {
          keys: PublicKey[];
        } & (
          | {
              array: (AccountInfo<Buffer> | null)[];
            }
          | {
              error: SailGetMultipleAccountsError;
            }
        )
      > => {
        try {
          return {
            keys: chunk,
            array: await connection.getMultipleAccountsInfo(chunk, commitment),
          };
        } catch (e) {
          const error = new SailGetMultipleAccountsError(chunk, commitment, e);
          onGetMultipleAccountsError(error);
          return {
            keys: chunk,
            error,
          };
        }
      }
    )
  );
  const array = result
    .map((el) => {
      if ("error" in el) {
        return el.keys.map(() => el.error);
      }
      return el.array;
    })
    .flat();
  return { keys, array };
};

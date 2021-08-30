import type {
  AccountInfo,
  Commitment,
  Connection,
  PublicKey,
} from "@solana/web3.js";

export function chunks<T>(array: readonly T[], size: number): T[][] {
  return Array.apply<number, T[], T[][]>(
    0,
    new Array(Math.ceil(array.length / size))
  ).map((_, index) => array.slice(index * size, (index + 1) * size));
}

export const getMultipleAccounts = async (
  connection: Connection,
  keys: readonly PublicKey[],
  onGetMultipleAccountsError?: (err: SolanaGetMultipleAccountsError) => void,
  commitment: Commitment = "recent"
): Promise<{
  keys: readonly PublicKey[];
  array: readonly (
    | AccountInfo<Buffer>
    | null
    | SolanaGetMultipleAccountsError
  )[];
}> => {
  const result = await Promise.all(
    chunks(keys, 99).map(async (chunk) => {
      try {
        return await getMultipleAccountsCore(connection, chunk, commitment);
      } catch (e) {
        const error = new SolanaGetMultipleAccountsError(
          chunk,
          commitment,
          e as Error
        );
        onGetMultipleAccountsError?.(error);
        return {
          keys: chunk,
          error,
        };
      }
    })
  );
  const array = result
    .map((el) => {
      if ("error" in el) {
        return el.keys.map(() => el.error);
      }
      return el.array.map((acc) => {
        if (!acc) {
          return null;
        }
        const { data, ...rest } = acc;
        const dataStr = data?.[0];
        return {
          ...rest,
          data: dataStr ? Buffer.from(dataStr, "base64") : Buffer.alloc(0),
        } as AccountInfo<Buffer>;
      });
    })
    .flat();
  return { keys, array };
};

const getMultipleAccountsCore = async (
  conn: Connection,
  keys: readonly PublicKey[],
  commitment: Commitment = "recent"
): Promise<{
  keys: readonly PublicKey[];
  array: readonly AccountInfo<string[]>[];
}> => {
  const connection = conn as Connection & {
    _rpcRequest: (
      rpc: string,
      args: unknown[]
    ) => Promise<{
      error?: Error;
      result: {
        value: readonly AccountInfo<string[]>[];
      };
    }>;
  };
  const stringKeys = keys.map((k) => k.toString());
  const args = connection._buildArgs([stringKeys], commitment, "base64");

  const unsafeRes = await connection._rpcRequest("getMultipleAccounts", args);
  if (unsafeRes.error) {
    throw new Error(
      "failed to get info about account " + unsafeRes.error.message
    );
  }

  if (unsafeRes.result.value) {
    const array = unsafeRes.result.value;
    return { keys, array };
  }

  throw new Error("getMultipleAccountsCore could not get info");
};

export class SolanaGetMultipleAccountsError extends Error {
  constructor(
    public readonly keys: readonly PublicKey[],
    public readonly commitment: Commitment,
    public readonly originalError: Error
  ) {
    super(`Error fetching accounts: ${originalError.message}`);
    this.name = "SolanaGetMultipleAccountsError";
  }
}

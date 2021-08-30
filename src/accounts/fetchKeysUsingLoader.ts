import type { PublicKey } from "@solana/web3.js";
import zip from "lodash.zip";
import invariant from "tiny-invariant";

import type { AccountDatum } from "../types";
import type { AccountLoader } from "./useAccountsInternal";

/**
 * Thrown if an account could not be loaded.
 */
export class SolanaAccountLoadError extends Error {
  constructor(
    public readonly originalError: Error,
    public readonly accountId: PublicKey
  ) {
    super(`Error loading account: ${originalError.message}`);
    this.name = "SolanaAccountLoadError";
  }

  get userMessage(): string {
    return `Error loading account ${this.accountId.toString()}`;
  }
}

export const fetchKeysUsingLoader = async (
  loader: AccountLoader,
  keys: (PublicKey | null | undefined)[],
  onAccountLoadError: (err: SolanaAccountLoadError) => void
): Promise<AccountDatum[]> => {
  const keysWithIndex = keys.map((k, i) => [k, i]);
  const keysSpecified = keysWithIndex.filter(
    (args): args is [PublicKey, number] => !!args[0]
  );
  const result = await loader.loadMany(keysSpecified.map((k) => k[0]));
  const nextData: AccountDatum[] = keys.map(() => undefined);
  zip(keysSpecified, result).forEach(([indexInfo, keyResult]) => {
    invariant(indexInfo, "index info missing");
    invariant(keyResult !== undefined, "key result missing");

    const [accountId, nextIndex] = indexInfo;
    if (keyResult instanceof Error) {
      const err = new SolanaAccountLoadError(keyResult, accountId);
      onAccountLoadError(err);
      nextData[nextIndex] = null;
      return;
    }
    nextData[nextIndex] = keyResult
      ? {
          accountId,
          accountInfo: keyResult,
        }
      : null;
  });
  return nextData;
};

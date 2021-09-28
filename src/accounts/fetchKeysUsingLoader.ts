import type { PublicKey } from "@solana/web3.js";
import zip from "lodash.zip";
import invariant from "tiny-invariant";

import { SailAccountLoadError } from "../errors";
import type { AccountDatum } from "../types";
import type { AccountLoader } from "./useAccountsInternal";

export const fetchKeysUsingLoader = async (
  loader: AccountLoader,
  keys: (PublicKey | null | undefined)[],
  onAccountLoadError?: (err: SailAccountLoadError) => void
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
      if (onAccountLoadError) {
        const err = new SailAccountLoadError(keyResult, accountId);
        onAccountLoadError(err);
      }
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

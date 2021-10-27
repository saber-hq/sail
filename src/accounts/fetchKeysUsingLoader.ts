import type { PublicKey } from "@solana/web3.js";
import zip from "lodash.zip";
import invariant from "tiny-invariant";

import { SailAccountLoadError } from "../errors";
import type { AccountFetchResult } from "../types";
import type { AccountLoader } from "./useAccountsInternal";

export const fetchKeysUsingLoader = async (
  loader: AccountLoader,
  keys: (PublicKey | null | undefined)[]
): Promise<AccountFetchResult[]> => {
  const keysWithIndex = keys.map((k, i) => [k, i]);
  const keysSpecified = keysWithIndex.filter(
    (args): args is [PublicKey, number] => !!args[0]
  );
  const result = await loader.loadMany(keysSpecified.map((k) => k[0]));
  const nextData: AccountFetchResult[] = keys.map(() => ({ data: undefined }));
  zip(keysSpecified, result).forEach(([indexInfo, keyResult]) => {
    invariant(indexInfo, "index info missing");
    invariant(keyResult !== undefined, "key result missing");

    const [accountId, nextIndex] = indexInfo;
    if (keyResult instanceof Error) {
      return (nextData[nextIndex] = {
        data: null,
        error: new SailAccountLoadError(keyResult, accountId),
      });
    }
    return (nextData[nextIndex] = {
      data: keyResult
        ? {
            accountId,
            accountInfo: keyResult,
          }
        : null,
    });
  });
  return nextData;
};

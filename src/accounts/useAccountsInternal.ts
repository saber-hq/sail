import { exists } from "@saberhq/solana-contrib";
import { useConnectionContext } from "@saberhq/use-solana";
import type { AccountInfo } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import DataLoader from "dataloader";
import { useCallback, useEffect, useMemo, useState } from "react";
import { unstable_batchedUpdates } from "react-dom";
import invariant from "tiny-invariant";

import type { AccountFetchResult, SailError } from "..";
import { SailRefetchSubscriptionsError } from "..";
import type { AccountDatum } from "../types";
import type { CacheBatchUpdateEvent } from "./emitter";
import { AccountsEmitter } from "./emitter";
import { getMultipleAccounts } from "./fetchers";
import { fetchKeysUsingLoader } from "./fetchKeysUsingLoader";

/**
 * Gets the cache key associated with the given pubkey.
 * @param pubkey
 * @returns
 */
export const getCacheKeyOfPublicKey = (pubkey: PublicKey): string =>
  pubkey.toString();

export type AccountLoader = DataLoader<
  PublicKey,
  AccountInfo<Buffer> | null,
  string
>;

interface AccountsProviderState {
  accountsCache: Map<string, AccountInfo<Buffer> | null>;
  emitter: AccountsEmitter;
  subscribedAccounts: Map<string, number>;
}

const newState = (): AccountsProviderState => ({
  accountsCache: new Map<string, AccountInfo<Buffer> | null>(),
  emitter: new AccountsEmitter(),
  subscribedAccounts: new Map(),
});

export interface UseAccountsArgs {
  /**
   * Duration in ms in which to batch all accounts data requests. Defaults to 500ms.
   */
  batchDurationMs?: number;
  /**
   * Milliseconds between each refresh. Defaults to 60_000.
   */
  refreshIntervalMs?: number;
  /**
   * Called whenever an error occurs.
   */
  onError: (err: SailError) => void;
}

/**
 * Function signature for fetching keys.
 */
export type FetchKeysFn = (
  keys: readonly PublicKey[]
) => Promise<AccountFetchResult[]>;

/**
 * Fetches keys, passing through null/undefined values.
 * @param fetchKeys
 * @param keys
 * @returns
 */
export const fetchKeysMaybe = async (
  fetchKeys: FetchKeysFn,
  keys: readonly (PublicKey | null | undefined)[]
): Promise<(AccountFetchResult | null | undefined)[]> => {
  const keysWithIndex = keys.map((k, i) => [k, i] as const);
  const nonEmptyKeysWithIndex = keysWithIndex.filter(
    (key): key is readonly [PublicKey, number] => exists(key[0])
  );
  const nonEmptyKeys = nonEmptyKeysWithIndex.map((n) => n[0]);
  const accountsData = await fetchKeys(nonEmptyKeys);
  return keysWithIndex.map(([key, index]) => {
    const found = nonEmptyKeysWithIndex.findIndex(
      ([_, otherIndex]) => otherIndex === index
    );
    if (found !== -1) {
      return accountsData[found];
    }
    invariant(!key, "key should be empty");
    return key;
  });
};

export interface UseAccounts extends Required<UseAccountsArgs> {
  /**
   * The loader. Usually should not be used directly.
   */
  loader: AccountLoader;

  /**
   * Refetches an account.
   */
  refetch: (key: PublicKey) => Promise<AccountInfo<Buffer> | null>;
  /**
   * Refetches multiple accounts.
   */
  refetchMany: (
    keys: PublicKey[]
  ) => Promise<(AccountInfo<Buffer> | Error | null)[]>;
  /**
   * Refetches all accounts that are being subscribed to.
   */
  refetchAllSubscriptions: () => Promise<void>;

  /**
   * Registers a callback to be called whenever a batch of items is cached.
   */
  onBatchCache: (cb: (args: CacheBatchUpdateEvent) => void) => void;

  /**
   * Fetches the data associated with the given keys, via the AccountLoader.
   */
  fetchKeys: FetchKeysFn;

  /**
   * Causes a key to be refetched periodically.
   */
  subscribe: (key: PublicKey) => () => Promise<void>;

  /**
   * Gets the cached data of an account.
   */
  getCached: (key: PublicKey) => AccountInfo<Buffer> | null | undefined;
  /**
   * Gets an AccountDatum from the cache.
   *
   * If the AccountInfo has never been fetched, this returns undefined.
   * If the AccountInfo has been fetched but wasn't found, this returns null.
   */
  getDatum: (key: PublicKey | null | undefined) => AccountDatum;
}

export const useAccountsInternal = (args: UseAccountsArgs): UseAccounts => {
  const { batchDurationMs = 500, refreshIntervalMs = 60_000, onError } = args;
  const { network, connection } = useConnectionContext();

  // Cache of accounts
  const [{ accountsCache, emitter, subscribedAccounts }, setState] =
    useState<AccountsProviderState>(newState());

  useEffect(() => {
    setState((prevState) => {
      // clear accounts cache and subscriptions whenever the network changes
      prevState.accountsCache.clear();
      prevState.subscribedAccounts.clear();
      prevState.emitter.raiseCacheCleared();
      return newState();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  const accountLoader = useMemo(
    () =>
      new DataLoader<PublicKey, AccountInfo<Buffer> | null, string>(
        async (keys: readonly PublicKey[]) => {
          const result = await getMultipleAccounts(
            connection,
            keys,
            onError,
            "confirmed"
          );
          unstable_batchedUpdates(() => {
            const batch = new Set<string>();
            result.array.forEach((info, i) => {
              const addr = keys[i];
              if (addr && !(info instanceof Error)) {
                const cacheKey = getCacheKeyOfPublicKey(addr);
                accountsCache.set(cacheKey, info);
                batch.add(cacheKey);
              }
            });
            emitter.raiseBatchCacheUpdated(batch);
          });
          return result.array;
        },
        {
          // aggregate all requests over 500ms
          batchScheduleFn: (callback) => setTimeout(callback, batchDurationMs),
          cacheKeyFn: getCacheKeyOfPublicKey,
        }
      ),
    [accountsCache, batchDurationMs, connection, emitter, onError]
  );

  const fetchKeys = useCallback(
    async (keys: readonly PublicKey[]) => {
      return await fetchKeysUsingLoader(accountLoader, keys);
    },
    [accountLoader]
  );

  const onBatchCache = emitter.onBatchCache;

  const refetch = useCallback(
    async (key: PublicKey) => {
      const result = await accountLoader.clear(key).load(key);
      return result;
    },
    [accountLoader]
  );

  const refetchMany = useCallback(
    async (keys: PublicKey[]) => {
      keys.forEach((key) => {
        accountLoader.clear(key);
      });
      return await accountLoader.loadMany(keys);
    },
    [accountLoader]
  );

  const getCached = useCallback(
    (key: PublicKey): AccountInfo<Buffer> | null | undefined => {
      // null: account not found on blockchain
      // undefined: cache miss (not yet fetched)
      return accountsCache.get(getCacheKeyOfPublicKey(key));
    },
    [accountsCache]
  );

  const subscribe = useCallback(
    (key: PublicKey): (() => Promise<void>) => {
      const keyStr = getCacheKeyOfPublicKey(key);
      const amount = subscribedAccounts.get(keyStr);
      if (amount === undefined || amount === 0) {
        subscribedAccounts.set(keyStr, 1);
      } else {
        subscribedAccounts.set(keyStr, amount + 1);
      }
      return () => {
        const currentAmount = subscribedAccounts.get(keyStr);
        if ((currentAmount ?? 0) > 1) {
          subscribedAccounts.set(keyStr, (currentAmount ?? 0) - 1);
        } else {
          subscribedAccounts.delete(keyStr);
        }
        return Promise.resolve();
      };
    },
    [subscribedAccounts]
  );

  const refetchAllSubscriptions = useCallback(async () => {
    const keysToFetch = [...subscribedAccounts.keys()].map((keyStr) => {
      return new PublicKey(keyStr);
    });
    await refetchMany(keysToFetch);
  }, [refetchMany, subscribedAccounts]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refetchAllSubscriptions().catch((e) => {
        onError(new SailRefetchSubscriptionsError(e));
      });
    }, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [onError, refetchAllSubscriptions, refreshIntervalMs]);

  const getDatum = useCallback(
    (k: PublicKey | null | undefined) => {
      if (!k) {
        return k;
      }
      const accountInfo = getCached(k);
      if (accountInfo) {
        return {
          accountId: k,
          accountInfo,
        };
      }
      return accountInfo;
    },
    [getCached]
  );

  return {
    loader: accountLoader,
    getCached,
    getDatum,
    refetch,
    refetchMany,
    refetchAllSubscriptions,

    onBatchCache,

    fetchKeys,
    subscribe,

    batchDurationMs,
    refreshIntervalMs,
    onError,
  };
};

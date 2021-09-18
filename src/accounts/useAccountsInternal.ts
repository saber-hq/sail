import { useConnectionContext } from "@saberhq/use-solana";
import type { AccountInfo } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import DataLoader from "dataloader";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { SailAccountParseError, SailCacheRefetchError } from "..";
import { SailRefetchSubscriptionsError } from "..";
import type { AccountDatum } from "../types";
import type { CacheUpdateEvent } from "./emitter";
import { AccountsEmitter } from "./emitter";
import type { SolanaGetMultipleAccountsError } from "./fetchers";
import { getMultipleAccounts } from "./fetchers";
import type { SolanaAccountLoadError } from "./fetchKeysUsingLoader";
import { fetchKeysUsingLoader } from "./fetchKeysUsingLoader";

/**
 * Gets the cache key associated with the given pubkey.
 * @param pubkey
 * @returns
 */
export const getCacheKeyOfPublicKey = (pubkey: PublicKey): string =>
  pubkey.toBuffer().toString("base64");

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
   * Callback called whenever an account fails to load.
   */
  onAccountLoadError?: (err: SolanaAccountLoadError) => void;
  /**
   * Callback called whenever getMultipleAccounts fails.
   */
  onGetMultipleAccountsError?: (err: SolanaGetMultipleAccountsError) => void;
  /**
   * Called if an error happens.
   */
  onRefetchSubscriptionsError?: (err: SailRefetchSubscriptionsError) => void;
  /**
   * Called if a cache refetch results in an error.
   */
  onCacheRefetchError?: (err: SailCacheRefetchError) => void;
  /**
   * Called if there is an error parsing an account.
   */
  onAccountParseError?: (err: SailAccountParseError) => void;
}

export interface UseAccounts extends Required<UseAccountsArgs> {
  /**
   * The loader. Usually should not be used directly.
   */
  loader: AccountLoader;

  /**
   * Gets the cached data of an account.
   */
  getCached: (key: PublicKey) => AccountInfo<Buffer> | null | undefined;

  /**
   * Refetches an account.
   */
  refetch: (key: PublicKey) => Promise<AccountInfo<Buffer> | null>;

  /**
   * Registers a callback to be called whenever an item is cached.
   */
  onCache: (cb: (args: CacheUpdateEvent) => void) => void;

  /**
   * Fetches the data associated with the given keys, via the AccountLoader.
   */
  fetchKeys: (
    keys: (PublicKey | null | undefined)[]
  ) => Promise<AccountDatum[]>;

  /**
   * Causes a key to be refetched periodically.
   */
  subscribe: (key: PublicKey) => () => Promise<void>;
}

export const useAccountsInternal = (
  args: UseAccountsArgs = {}
): UseAccounts => {
  const {
    batchDurationMs = 500,
    refreshIntervalMs = 60_000,

    onAccountLoadError = (err) => {
      console.warn(`Error loading account ${err.accountId.toString()}:`, err);
    },
    onGetMultipleAccountsError = (err) => {
      console.warn(
        `Error fetching multiple accounts (${err.keys.length}):`,
        err
      );
    },
    onRefetchSubscriptionsError = (err) => {
      console.warn(`Error refetching subscriptions:`, err);
    },
    onAccountParseError = (err) => {
      console.warn(
        `Error parsing account ${err.data.accountId.toString()}:`,
        err
      );
    },
    onCacheRefetchError = (err) => {
      console.warn(`Error refetching from cache:`, err);
    },
  } = args;
  const { network, connection } = useConnectionContext();

  // Cache of accounts
  const [{ accountsCache, emitter, subscribedAccounts }, setState] =
    useState<AccountsProviderState>(newState());

  useEffect(() => {
    // clear accounts cache and subscriptions whenever the network changes
    accountsCache.clear();
    subscribedAccounts.clear();
    emitter.raiseCacheCleared();

    setState(newState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  const accountLoader = useMemo(
    () =>
      new DataLoader<PublicKey, AccountInfo<Buffer> | null, string>(
        async (keys: readonly PublicKey[]) => {
          const result = await getMultipleAccounts(
            connection,
            keys,
            onGetMultipleAccountsError,
            "recent"
          );
          result.array.forEach((info, i) => {
            const addr = keys[i];
            if (addr && !(info instanceof Error)) {
              accountsCache.set(getCacheKeyOfPublicKey(addr), info);
              emitter.raiseCacheUpdated(addr, true);
            }
          });
          return result.array;
        },
        {
          // aggregate all requests over 500ms
          batchScheduleFn: (callback) => setTimeout(callback, batchDurationMs),
          cacheKeyFn: getCacheKeyOfPublicKey,
        }
      ),
    [
      accountsCache,
      batchDurationMs,
      connection,
      emitter,
      onGetMultipleAccountsError,
    ]
  );

  const fetchKeys = useCallback(
    async (keys: (PublicKey | null | undefined)[]) => {
      return await fetchKeysUsingLoader(
        accountLoader,
        keys,
        onAccountLoadError
      );
    },
    [accountLoader, onAccountLoadError]
  );

  const onCache = useMemo(() => emitter.onCache.bind(emitter), [emitter]);

  const refetch = useCallback(
    async (key: PublicKey) => {
      const result = await accountLoader.clear(key).load(key);
      return result;
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
    return await Promise.all(
      [...subscribedAccounts.keys()].map(async (keyStr) => {
        const key = new PublicKey(Buffer.from(keyStr, "base64"));
        await refetch(key);
      })
    );
  }, [refetch, subscribedAccounts]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refetchAllSubscriptions().catch((e) => {
        onRefetchSubscriptionsError?.(new SailRefetchSubscriptionsError(e));
      });
    }, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [onRefetchSubscriptionsError, refetchAllSubscriptions, refreshIntervalMs]);

  return {
    loader: accountLoader,
    getCached,
    refetch,
    onCache,
    fetchKeys,
    subscribe,

    batchDurationMs,
    refreshIntervalMs,
    onAccountLoadError,
    onGetMultipleAccountsError,
    onRefetchSubscriptionsError,
    onAccountParseError,
    onCacheRefetchError,
  };
};

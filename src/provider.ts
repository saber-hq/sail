import { useConnectionContext } from "@saberhq/use-solana";
import type { AccountInfo } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import DataLoader from "dataloader";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createContainer } from "unstated-next";

import type { CacheUpdateEvent } from "./emitter";
import { AccountsEmitter } from "./emitter";
import { getMultipleAccounts } from "./fetchers";
import type { SolanaAccountLoadError } from "./fetchKeysFromLoader";
import { fetchKeysUsingLoader } from "./fetchKeysFromLoader";
import type { UseHandleTXs, UseHandleTXsArgs } from "./tx/useHandleTXs";
import { useHandleTXs } from "./tx/useHandleTXs";
import type { AccountDatum } from "./types";

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

export interface AccountsContext extends UseHandleTXs {
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
   * Causes a key to be refetched periodically.
   */
  subscribe: (key: PublicKey) => () => Promise<void>;

  /**
   * Fetches the data associated with the given keys, via the AccountLoader.
   */
  fetchKeys: (
    keys: (PublicKey | null | undefined)[]
  ) => Promise<AccountDatum[]>;
}

export const DEFAULT_ACCOUNT_LOAD_ERROR_HANDLER = (
  err: SolanaAccountLoadError
): void => {
  console.error(err.userMessage, err.originalError);
};

export interface UseAccountsContext extends Omit<UseHandleTXsArgs, "refetch"> {
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
}

const useAccountsContextInternal = ({
  batchDurationMs = 500,
  refreshIntervalMs = 60_000,
  onAccountLoadError = DEFAULT_ACCOUNT_LOAD_ERROR_HANDLER,
}: UseAccountsContext = {}): AccountsContext => {
  const { network, connection } = useConnectionContext();

  // Cache of accounts
  const [{ accountsCache, emitter, subscribedAccounts }, setState] =
    useState<AccountsProviderState>(newState());

  const subscribe = useCallback(
    (key: PublicKey): (() => Promise<void>) => {
      const keyStr = key.toString();
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

  const getCached = useCallback(
    (key: PublicKey): AccountInfo<Buffer> | null | undefined => {
      // null: account not found on blockchain
      // undefined: cache miss (not yet fetched)
      return accountsCache.get(key.toString());
    },
    [accountsCache]
  );

  useEffect(() => {
    // clear accounts cache and subscriptions whenever the network changes
    accountsCache.clear();
    subscribedAccounts.clear();
    emitter.raiseCacheCleared();

    setState(newState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  // account loader
  const accountLoader = useMemo(
    () =>
      new DataLoader<PublicKey, AccountInfo<Buffer> | null, string>(
        async (keys: readonly PublicKey[]) => {
          const result = await getMultipleAccounts(
            connection,
            keys,
            "processed"
          );
          result.array.forEach((info, i) => {
            const addr = keys[i];
            if (addr) {
              accountsCache.set(addr.toString(), info);
              emitter.raiseCacheUpdated(addr, true);
            }
          });
          return result.array;
        },
        {
          // aggregate all requests over 500ms
          batchScheduleFn: (callback) => setTimeout(callback, batchDurationMs),
          cacheKeyFn: (k) => k.toString(),
        }
      ),
    [accountsCache, batchDurationMs, connection, emitter]
  );

  const refetch = useCallback(
    async (key: PublicKey) => {
      const result = await accountLoader.clear(key).load(key);
      return result;
    },
    [accountLoader]
  );

  const onCache = useMemo(() => emitter.onCache.bind(emitter), [emitter]);

  const refetchAllSubscriptions = useCallback(async () => {
    return await Promise.all(
      [...subscribedAccounts.keys()].map(async (keyStr) => {
        const key = new PublicKey(keyStr);
        await refetch(key);
      })
    );
  }, [refetch, subscribedAccounts]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refetchAllSubscriptions();
    }, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [refetchAllSubscriptions, refreshIntervalMs]);

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

  const handleTXsContext = useHandleTXs({ refetch });

  return {
    loader: accountLoader,
    getCached,
    refetch,
    onCache,
    subscribe,
    fetchKeys,
    ...handleTXsContext,
  };
};

export const { Provider: AccountsProvider, useContainer: useAccountsContext } =
  createContainer(useAccountsContextInternal);

import { networkToChainId } from "@saberhq/token-utils";
import { useConnectionContext } from "@saberhq/use-solana";
import type { AccountInfo, SlotInfo } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import DataLoader from "dataloader";
import { zip } from "lodash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-dom";
import { QueryClient } from "react-query";

import type {
  AccountFetchResult,
  AccountParser,
  ParsedAccountDatum,
  SailError,
} from "..";
import { SailRefetchSubscriptionsError } from "..";
import type { AccountDatum } from "../types";
import type { CacheUpdateEvent } from "./emitter";
import { AccountsEmitter } from "./emitter";
import { getMultipleAccounts } from "./fetchers";
import { fetchKeysUsingLoader } from "./fetchKeysUsingLoader";
import { createAccountStore, AccountStore } from "./store";
import { useUpdater } from "./useUpdater";

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
   * Called whenever an error occurs.
   */
  onError: (err: SailError) => void;
}

export interface UseAccounts extends Required<UseAccountsArgs> {
  queryClient: QueryClient;
  accountStore: AccountStore;
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
   * Registers a callback to be called whenever an item is cached.
   */
  onCache: (cb: (args: CacheUpdateEvent) => void) => void;

  /**
   * Fetches the data associated with the given keys, via the AccountLoader.
   */
  fetchKeys: (
    keys: (PublicKey | null | undefined)[]
  ) => Promise<AccountFetchResult[]>;

  /**
   * Causes a key to be refetched periodically.
   */
  subscribe: (key: PublicKey) => () => Promise<void>;

  /**
   * Gets the cached data of an account.
   */
  getCached: (key: PublicKey) => AccountInfo<Buffer> | null | undefined;
  /**
   * Gets an AccountDatum from a key.
   */
  getDatum: (key: PublicKey | null | undefined) => AccountDatum;

  // registerParsers: (parsersConfig: {
  //   [key: string]: AccountParser<unknown>;
  // }) => void;
}

interface NamedParsers {
  [key: string]: AccountParser<unknown>;
}

// dataloader will not worry about caching
export const useAccountsInternal = (args: UseAccountsArgs): UseAccounts => {
  const queryClientRef = useRef<QueryClient>();
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }

  const accountStoreRef = useRef<AccountStore>();
  if (!accountStoreRef.current) {
    accountStoreRef.current = createAccountStore();
  }

  // const parsers = useRef<NamedParsers>({});
  // const registerParsers = useCallback(
  //   (parsersConfig: { [key: string]: AccountParser<unknown> }) => {
  //     for (let [key, parser] of Object.entries(parsersConfig)) {
  //       parsers.current[key] = parser;
  //     }
  //   },
  //   []
  // );

  const { batchDurationMs = 500, refreshIntervalMs = 60_000, onError } = args;
  const { network, connection } = useConnectionContext();
  const chainId = networkToChainId(network);

  const set = accountStoreRef.current!((state) => state.set);

  useEffect(() => {
    const slotUpdateHandler = (slotUpdate: SlotInfo) => {
      try {
        // const slotNumber = await provider.connection.getSlot();
        const slotNumber = slotUpdate.slot;
        set((state) => {
          state.slotNumber[chainId] = slotNumber;
        });
      } catch (e) {
        console.log({ error: e });
      }

      // if (networkCheckTimeoutId.current) {
      //   clearTimeout(networkCheckTimeoutId.current);
      // }

      // // trailing check after NETWORK_CHECK_TIMEOUT
      // networkCheckTimeoutId.current = setTimeout(() => {
      //   void networkCheck();
      // }, NETWORK_CHECK_TIMEOUT);
    };

    const cid = connection.onSlotChange(slotUpdateHandler);

    return () => {
      if (cid) {
        void connection.removeSlotChangeListener(cid);
      }
    };
  }, [connection, chainId]);

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
            "recent"
          );

          // unstable_batchedUpdates(() => {
          //   result.array.forEach((info, i) => {
          //     const addr = keys[i];
          //     if (addr && !(info instanceof Error)) {
          //       accountsCache.set(getCacheKeyOfPublicKey(addr), info);
          //       emitter.raiseCacheUpdated(addr, true);
          //     }
          //   });
          // });
          return result.array;
        },
        {
          // aggregate all requests over 500ms
          batchScheduleFn: (callback) => setTimeout(callback, batchDurationMs),
          cacheKeyFn: getCacheKeyOfPublicKey,
          cache: false,
        }
      ),
    [batchDurationMs, connection, onError]
  );

  const fetchKeys = useCallback(
    async (keys: (PublicKey | null | undefined)[]) => {
      return await fetchKeysUsingLoader(accountLoader, keys);
    },
    [accountLoader]
  );

  const onCache = useMemo(() => emitter.onCache.bind(emitter), [emitter]);

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
      return new PublicKey(Buffer.from(keyStr, "base64"));
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
      if (k) {
        const accountInfo = getCached(k);
        if (accountInfo) {
          return {
            accountId: k,
            accountInfo,
          };
        }
        if (accountInfo === null) {
          // Cache hit but null entry in cache
          return null;
        }
      }
      return k === undefined ? undefined : null;
    },
    [getCached]
  );

  useUpdater({ accountStore: accountStoreRef.current, fetchKeys });

  return {
    queryClient: queryClientRef.current,
    loader: accountLoader,
    getCached,
    getDatum,
    refetch,
    refetchMany,
    refetchAllSubscriptions,
    onCache,
    fetchKeys,
    subscribe,
    accountStore: accountStoreRef.current,
    batchDurationMs,
    refreshIntervalMs,
    onError,
    // registerParsers,
  };
};

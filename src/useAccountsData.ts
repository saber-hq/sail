import type { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

import { SailCacheRefetchError, useSail } from ".";
import type { AccountDatum } from "./types";

/**
 * Fetches data of the given accounts.
 * @param keys Keys to fetch. Ensure that this is memoized or unlikely to change.
 *
 * @returns One of three types:
 * - Buffer -- the account was found
 * - null -- account not found or an error occurred while loading the account
 * - undefined -- account key not provided or not yet loaded
 */
export const useAccountsData = (
  keys: (PublicKey | null | undefined)[]
): readonly AccountDatum[] => {
  const { getCached, onCache, subscribe, fetchKeys, onCacheRefetchError } =
    useSail();

  // makes a datum from a public key
  const makeDatumFromKey = useCallback(
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

  const [data, setData] = useState<{ [cacheKey: string]: AccountDatum }>(() =>
    keys.reduce(
      (acc, key) =>
        key ? { ...acc, [key.toString()]: makeDatumFromKey(key) } : acc,
      {}
    )
  );

  const fetchAndSetKeys = useDebouncedCallback(
    async (
      fetchKeys: (
        keys: (PublicKey | null | undefined)[]
      ) => Promise<AccountDatum[]>,
      keys: (PublicKey | null | undefined)[]
    ) => {
      const keysData = await fetchKeys(keys);
      const nextData = keys
        .filter((key): key is PublicKey => !!key)
        .reduce(
          (cacheState, key, keyIndex) => ({
            ...cacheState,
            [key.toString()]: keysData[keyIndex],
          }),
          {}
        );
      setData(nextData);
    },
    100
  );

  useEffect(() => {
    void (async () => {
      await fetchAndSetKeys(fetchKeys, keys)?.catch((e) => {
        onCacheRefetchError?.(new SailCacheRefetchError(e, keys));
      });
    })();
  }, [keys, fetchAndSetKeys, fetchKeys, onCacheRefetchError]);

  // subscribe to account changes
  useEffect(() => {
    const allKeysUnsubscribe = keys
      .filter((k): k is PublicKey => !!k)
      .map(subscribe);
    return () => {
      allKeysUnsubscribe.map((fn) => fn());
    };
  }, [keys, subscribe]);

  // refresh from the cache whenever the cache is updated
  useEffect(() => {
    return onCache((e) => {
      if (keys.find((key) => key?.equals(e.id))) {
        void fetchAndSetKeys(fetchKeys, keys)?.catch((e) => {
          onCacheRefetchError?.(new SailCacheRefetchError(e, keys));
        });
      }
    });
  }, [keys, onCache, fetchAndSetKeys, fetchKeys, onCacheRefetchError]);

  // unload debounces when the component dismounts
  useEffect(() => {
    return () => {
      fetchAndSetKeys.cancel();
    };
  }, [fetchAndSetKeys]);

  return useMemo(() => {
    return keys.map((key) => {
      if (key) {
        return data[key.toString()];
      }

      return key;
    });
  }, [data, keys]);
};

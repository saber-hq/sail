import { exists } from "@saberhq/solana-contrib";
import type { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

import type { AccountFetchResult } from ".";
import { getCacheKeyOfPublicKey, SailCacheRefetchError, useSail } from ".";
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
  const { getDatum, onCache, subscribe, fetchKeys, onError } = useSail();

  const [data, setData] = useState<{ [cacheKey: string]: AccountDatum }>(() =>
    keys.reduce<{ [cacheKey: string]: AccountDatum }>((acc, key) => {
      if (key) {
        acc[getCacheKeyOfPublicKey(key)] = getDatum(key);
      }

      return acc;
    }, {})
  );

  // TODO: add cancellation
  const fetchAndSetKeys = useDebouncedCallback(
    async (
      fetchKeys: (keys: readonly PublicKey[]) => Promise<AccountFetchResult[]>,
      keys: readonly PublicKey[]
    ) => {
      const keysData = await fetchKeys(keys);
      const nextData = keys.reduce<{ [cacheKey: string]: AccountDatum }>(
        (cacheState, key, keyIndex) => {
          if (key) {
            cacheState[getCacheKeyOfPublicKey(key)] = keysData[keyIndex]?.data;
          }

          return cacheState;
        },
        {}
      );
      setData(nextData);
    },
    100
  );

  useEffect(() => {
    void (async () => {
      await fetchAndSetKeys(fetchKeys, keys.filter(exists))?.catch((e) => {
        onError(new SailCacheRefetchError(e, keys));
      });
    })();
  }, [keys, fetchAndSetKeys, fetchKeys, onError]);

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
        void fetchAndSetKeys(fetchKeys, keys.filter(exists))?.catch((e) => {
          onError(new SailCacheRefetchError(e, keys));
        });
      }
    });
  }, [keys, onCache, fetchAndSetKeys, fetchKeys, onError]);

  // unload debounces when the component dismounts
  useEffect(() => {
    return () => {
      fetchAndSetKeys.cancel();
    };
  }, [fetchAndSetKeys]);

  return useMemo(() => {
    return keys.map((key) => {
      if (key) {
        return data[getCacheKeyOfPublicKey(key)];
      }

      return key;
    });
  }, [data, keys]);
};

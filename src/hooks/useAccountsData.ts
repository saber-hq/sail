import type { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

import type { FetchKeysFn } from "..";
import {
  fetchKeysMaybe,
  getCacheKeyOfPublicKey,
  SailCacheRefetchError,
  useAccountsSubscribe,
  useSail,
} from "..";
import type { AccountDatum } from "../types";

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
  const { getDatum, onBatchCache, fetchKeys, onError } = useSail();

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
      fetchKeys: FetchKeysFn,
      keys: readonly (PublicKey | null | undefined)[]
    ) => {
      const keysData = await fetchKeysMaybe(fetchKeys, keys);

      const nextData: Record<string, AccountDatum> = {};
      keys.forEach((key, keyIndex) => {
        if (key) {
          const keyData = keysData[keyIndex];
          if (keyData) {
            nextData[getCacheKeyOfPublicKey(key)] = keyData.data;
          } else {
            nextData[getCacheKeyOfPublicKey(key)] = keyData;
          }
        }
      });
      setData(nextData);
    },
    100
  );

  useEffect(() => {
    void (async () => {
      await fetchAndSetKeys(fetchKeys, keys)?.catch((e) => {
        onError(new SailCacheRefetchError(e, keys));
      });
    })();
  }, [keys, fetchAndSetKeys, fetchKeys, onError]);

  useAccountsSubscribe(keys);

  // refresh from the cache whenever the cache is updated
  useEffect(() => {
    return onBatchCache((e) => {
      if (keys.find((key) => key && e.hasKey(key))) {
        void fetchAndSetKeys(fetchKeys, keys)?.catch((e) => {
          onError(new SailCacheRefetchError(e, keys));
        });
      }
    });
  }, [keys, fetchAndSetKeys, fetchKeys, onError, onBatchCache]);

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

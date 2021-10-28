import { chainIdToNetwork, networkToChainId } from "@saberhq/token-utils";
import { useConnectionContext } from "@saberhq/use-solana";
import type { PublicKey } from "@solana/web3.js";
import shallow from "zustand/shallow";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  notifyManager,
  QueriesObserver,
  QueryKey,
  QueryObserverOptions,
  QueryOptions,
  useQuery,
} from "react-query";
import invariant from "tiny-invariant";

import type { AccountFetchResult } from ".";
import { useSail } from ".";
import { useUpdater } from "./accounts/useUpdater";
import type { AccountDatum } from "./types";
import { AccountState } from "./accounts/store";

/**
 * Fetches data of the given accounts.
 * @param keys Keys to fetch. Ensure that this is memoized or unlikely to change.
 *
 * @returns One of three types:
 * - Buffer -- the account was found
 * - null -- account not found or an error occurred while loading the account
 * - undefined -- account key not provided or not yet loaded
 */
const selectAccounts = (state: AccountState) => state.accounts;

export const useAccountsData = (
  keys: (PublicKey | null | undefined)[]
): readonly AccountDatum[] => {
  const { accountStore } = useSail();

  const setState = accountStore(useCallback((state) => state.set, []));
  const accounts = accountStore(selectAccounts);
  const { network } = useConnectionContext();
  const chainId = networkToChainId(network);

  useEffect(() => {
    setState((state) => {
      keys.forEach((key) => {
        if (!key || !chainId) return;

        const k = key.toString();
        state.listeningKeys[chainId] = state.listeningKeys[chainId] ?? {};

        state.listeningKeys[chainId]![k] =
          state.listeningKeys[chainId]![k] ?? {};

        state.listeningKeys[chainId]![k]!.slotsPerFetch = 500;
      });
    });

    return () => {
      setState((state) => {
        keys.forEach((key) => {
          if (!key || !chainId) return;

          const k = key.toString();
          state.listeningKeys[chainId] = state.listeningKeys[chainId] ?? {};

          // delete state.listeningKeys[chainId]![k];
        });
      });
    };
  }, [keys, chainId]);

  return useMemo(() => {
    return keys.map((key) => {
      if (!key) return key;
      const result = accounts[key.toString()];

      return result?.data;
    });
  }, [accounts]);
};

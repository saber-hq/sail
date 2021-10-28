import { networkToChainId } from "@saberhq/token-utils";
import { useConnectionContext } from "@saberhq/use-solana";
import { PublicKey } from "@solana/web3.js";
import { debounce } from "lodash";
import zip from "lodash.zip";
import { useCallback, useEffect, useMemo, useRef } from "react";
import shallow from "zustand/shallow";
import { AccountFetchResult, useSail } from "..";
import { AccountStore } from "./store";

export const useUpdater = ({
  fetchKeys,
  accountStore,
}: {
  fetchKeys: (
    keys: (PublicKey | null | undefined)[]
  ) => Promise<AccountFetchResult[]>;
  accountStore: AccountStore;
}) => {
  const { network, connection } = useConnectionContext();
  const chainId = networkToChainId(network);

  const {
    slotNumber: _slotNumber,
    listeningKeys: _listeningKeys,
    accounts,
  } = accountStore(
    (state) => ({
      slotNumber: state.slotNumber,
      listeningKeys: state.listeningKeys,
      accounts: state.accounts,
    }),
    shallow
  );

  const setState = accountStore(useCallback((state) => state.set, []));

  const slotNumber = _slotNumber[chainId];
  const listeningKeys = _listeningKeys[chainId] ?? {};

  const outdatedListeningKeys = useMemo(
    () =>
      Object.keys(listeningKeys).filter((lkey) => {
        if (!lkey || !slotNumber || !chainId) return false;

        const data = accounts[lkey];
        if (!data) return true;

        const slotPer = listeningKeys[lkey]?.slotsPerFetch ?? 1000;
        const minDataBlockNumber = slotNumber - (slotPer - 1);

        if (
          data.fetchingSlotNumber &&
          data.fetchingSlotNumber > minDataBlockNumber
        ) {
          return false;
        }
        return !data.slotNumber || data.slotNumber < minDataBlockNumber;
      }),
    [listeningKeys, accounts, slotNumber]
  );

  const serializedOutdatedKeys = useMemo(
    () => JSON.stringify(outdatedListeningKeys),
    [outdatedListeningKeys]
  );

  const callUpdate = useRef(
    debounce(
      async (
        chainId: number,
        slotNumber: number,
        outdatedListeningKeys: string[]
      ) => {
        const keys = outdatedListeningKeys.map((key) => new PublicKey(key));

        // am fetching
        setState((state) => {
          keys.forEach((key) => {
            state.accounts[key.toString()] =
              state.accounts[key.toString()] ?? {};

            state.accounts[key.toString()]!.fetchingSlotNumber = slotNumber;
          });
        });

        const newResults = await fetchKeys(keys);

        setState((state) => {
          zip(keys, newResults).forEach(([key, result]) => {
            if (!key || !result) return;
            state.accounts[key.toString()] = {
              data: result.data,
              error: result.error,
              slotNumber,
              // fetchingSlotNumber
            };
          });
        });
      },
      100
    )
  );

  // Connect to the store on mount, disconnect on unmount, catch state-changes in a reference
  useEffect(() => {
    if (slotNumber && chainId && outdatedListeningKeys.length > 0) {
      callUpdate.current(chainId, slotNumber, outdatedListeningKeys);
    }
  }, [chainId, slotNumber, serializedOutdatedKeys]);
};

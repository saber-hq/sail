import type { PublicKey } from "@solana/web3.js";
import { useEffect } from "react";

import { useSail } from "../provider";

/**
 * Mark that you desire to subscribe to changes on an account.
 *
 * This is for advanced users only.
 */
export const useAccountsSubscribe = (
  keys: readonly (PublicKey | null | undefined)[] | null | undefined
) => {
  const { subscribe } = useSail();
  // subscribe to account changes
  useEffect(() => {
    if (!keys) {
      return;
    }
    const allKeysUnsubscribe = keys
      .filter((k): k is PublicKey => !!k)
      .map(subscribe);
    return () => {
      allKeysUnsubscribe.map((fn) => fn());
    };
  }, [keys, subscribe]);
};

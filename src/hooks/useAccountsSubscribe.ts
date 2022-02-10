import type { PublicKey } from "@solana/web3.js";
import { useEffect } from "react";

import { useSail } from "../provider";

/**
 * Mark that you desire to subscribe to changes on an account.
 *
 * This is for advanced users only.
 */
export const useAccountsSubscribe = (
  keys: (PublicKey | null | undefined)[]
) => {
  const { subscribe } = useSail();
  // subscribe to account changes
  useEffect(() => {
    const allKeysUnsubscribe = keys
      .filter((k): k is PublicKey => !!k)
      .map(subscribe);
    return () => {
      allKeysUnsubscribe.map((fn) => fn());
    };
  }, [keys, subscribe]);
};

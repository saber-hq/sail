import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";

/**
 * Parses a Pubkey.
 * @param raw The string or Pubkey representation of the key.
 * @returns
 */
export const usePubkey = (
  raw: PublicKey | string | null | undefined
): PublicKey | null | undefined => {
  return useMemo(() => {
    if (raw === undefined) {
      return raw;
    }
    if (!raw) {
      return null;
    }
    if (raw instanceof PublicKey) {
      return raw;
    }
    try {
      return new PublicKey(raw);
    } catch (e) {
      return null;
    }
  }, [raw]);
};

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

/**
 * Uses a {@link PublicKey}, ensuring the reference does not change if the key changes.
 * @param raw The string or Pubkey representation of the key.
 * @returns
 */
export const useMemoPubkey = (
  raw: PublicKey | string | null | undefined
): PublicKey | null | undefined => {
  const keyNoMemo = usePubkey(raw);
  return useMemo(() => {
    return keyNoMemo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyNoMemo?.toString()]);
};

import { Keypair } from "@solana/web3.js";
import { useMemo } from "react";

/**
 * Parses a Keypair from a JSON secret key.
 * @param valueStr The string representation of the JSON secret key.
 * @returns
 */
export const useKeypair = (
  valueStr: string | null | undefined
): Keypair | null | undefined => {
  return useMemo(() => {
    if (typeof valueStr !== "string") {
      return valueStr;
    }
    if (!valueStr) {
      return null;
    }
    try {
      return Keypair.fromSecretKey(
        Uint8Array.from([...(JSON.parse(valueStr) as number[])])
      );
    } catch (e) {
      return null;
    }
  }, [valueStr]);
};

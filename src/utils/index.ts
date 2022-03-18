import type { PublicKey } from "@solana/web3.js";

import type { AccountDatum } from "../types";

export * from "./falsy";
export * from "./fetchNullable";

export const accountsEqual = (a: AccountDatum, b: AccountDatum): boolean => {
  if (a && b) {
    return a.accountInfo.data.equals(b.accountInfo.data);
  }
  return false;
};

export const serializeKeys = (
  keys: readonly (PublicKey | string | null | undefined)[]
): (string | null | undefined)[] => {
  return keys.map((k) => (k ? k.toString() : k));
};

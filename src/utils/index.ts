import { PublicKey } from "@solana/web3.js";
import uniq from "lodash.uniq";

import type { AccountDatum } from "../types";
import { mapSome } from "./falsy";

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

/**
 * Generates a list of unique {@link PublicKey}s.
 * @param keys
 * @returns
 */
export const uniqKeys = (
  keys: readonly (PublicKey | string)[]
): readonly PublicKey[] =>
  uniq(keys.map((key) => key.toString())).map((key) => new PublicKey(key));

/**
 * Makes a memo key for a list of strings.
 * @param list
 * @returns
 */
export const makeListMemoKey = <T extends { toString: () => string }>(
  list: (NonNullable<T> | null | undefined)[] | null | undefined
): string | null | undefined => {
  return mapSome(list, (ms) =>
    JSON.stringify(ms.map((mint) => mapSome(mint, (m) => m.toString())))
  );
};

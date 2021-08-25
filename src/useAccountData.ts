import type { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";

import type { AccountDatum, ParsedAccountDatum } from "./types";
import { useAccountsData } from "./useAccountsData";
import type { AccountParser } from "./useParsedAccountsData";
import { useParsedAccountsData } from "./useParsedAccountsData";

export const useAccountData = (
  key?: PublicKey | null
): { loading: boolean; data: AccountDatum } => {
  const theKey = useMemo(() => [key], [key]);
  const [data] = useAccountsData(theKey);
  return {
    loading: key !== undefined && data === undefined,
    data,
  };
};

/**
 * Loads the parsed data of a single account.
 * @returns
 */
export const useParsedAccountData = <T extends unknown>(
  key: PublicKey | null | undefined,
  parser: AccountParser<T>
): { loading: boolean; data: ParsedAccountDatum<T> } => {
  const theKey = useMemo(() => [key], [key]);
  const [data] = useParsedAccountsData(theKey, parser);
  return {
    loading: key !== undefined && data === undefined,
    data,
  };
};

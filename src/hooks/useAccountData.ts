import type { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";

import type { AccountDatum } from "../types";
import { useAccountsData } from "./useAccountsData";

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

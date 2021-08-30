import { createContainer } from "unstated-next";

import type {
  UseAccounts,
  UseAccountsArgs,
} from "./accounts/useAccountsInternal";
import { useAccountsInternal } from "./accounts/useAccountsInternal";
import type { UseHandleTXs, UseHandleTXsArgs } from "./tx/useHandleTXs";
import { useHandleTXsInternal } from "./tx/useHandleTXs";

export interface UseSail extends UseAccounts, UseHandleTXs {}

export interface UseSailArgs
  extends UseAccountsArgs,
    Omit<UseHandleTXsArgs, "refetch"> {}

const useSailInternal = (args: UseSailArgs = {}): UseSail => {
  const accounts = useAccountsInternal(args);
  const handleTXs = useHandleTXsInternal({
    ...args,
    refetch: accounts.refetch,
  });

  return {
    ...accounts,
    ...handleTXs,
  };
};

export const { Provider: SailProvider, useContainer: useSail } =
  createContainer(useSailInternal);

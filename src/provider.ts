import { createContainer } from "unstated-next";

import type { SailError } from ".";
import type {
  UseAccounts,
  UseAccountsArgs,
} from "./accounts/useAccountsInternal";
import { useAccountsInternal } from "./accounts/useAccountsInternal";
import type { UseHandleTXs, UseHandleTXsArgs } from "./tx/useHandleTXs";
import { useHandleTXsInternal } from "./tx/useHandleTXs";

export interface UseSail extends UseAccounts, UseHandleTXs {}

export type UseSailArgs = Omit<
  UseAccountsArgs & Omit<UseHandleTXsArgs, "refetchMany">,
  "onError"
> & {
  onSailError?: (err: SailError) => void;
};

const defaultOnError = (err: SailError) => console.error(err.message, err);

const useSailInternal = ({
  onSailError = defaultOnError,
  ...args
}: UseSailArgs = {}): UseSail => {
  const accounts = useAccountsInternal({ ...args, onError: onSailError });
  const handleTXs = useHandleTXsInternal({
    ...args,
    onError: onSailError,
    refetchMany: accounts.refetchMany,
  });

  return {
    ...accounts,
    ...handleTXs,
  };
};

export const { Provider: SailProvider, useContainer: useSail } =
  createContainer(useSailInternal);

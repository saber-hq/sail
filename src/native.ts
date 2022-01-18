import { RAW_SOL, TokenAmount } from "@saberhq/token-utils";
import { useConnectedWallet, useConnectionContext } from "@saberhq/use-solana";
import type { AccountInfo } from "@solana/web3.js";
import { useCallback, useMemo } from "react";

import type { AccountParser } from "./parsers/useParsedAccountsData";
import { useParsedAccountData } from "./parsers/useParsedAccountsData";

/**
 * Uses the data of the raw SOL account.
 * @returns
 */
export function useNativeAccount(): {
  account?: AccountInfo<TokenAmount> | null;
  nativeBalance?: TokenAmount | undefined;
} {
  const wallet = useConnectedWallet();
  const { network } = useConnectionContext();
  const sol = RAW_SOL[network];
  const parser: AccountParser<TokenAmount> = useCallback(
    (data) => {
      return new TokenAmount(sol, data.accountInfo.lamports);
    },
    [sol]
  );
  const { data } = useParsedAccountData(wallet?.publicKey, parser);
  const balance = data?.accountInfo.lamports;

  return useMemo(() => {
    if (data === null) {
      return {
        account: null,
        nativeBalance: new TokenAmount(sol, 0),
      };
    }

    if (!data || wallet === null || balance === undefined) {
      return {
        account: data?.accountInfo,
        nativeBalance: undefined,
      };
    }

    return {
      account: data.accountInfo,
      nativeBalance: data.accountInfo.data,
    };
  }, [balance, data, sol, wallet]);
}

import type { Token } from "@saberhq/token-utils";
import { getATAAddress, RAW_SOL_MINT, TokenAmount } from "@saberhq/token-utils";
import { useConnectedWallet } from "@saberhq/use-solana";
import type { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import { useQuery } from "react-query";

import { useSOLBalance } from "../native";
import { useBatchedTokenAccounts } from "../parsers/splHooks";

/**
 * A user's associated token account.
 */
export interface AssociatedTokenAccount {
  /**
   * Account key. If the token is {@link RAW_SOL_MINT}, this will be the user's account.
   */
  key: PublicKey;
  /**
   * Token balance of the account.
   */
  balance: TokenAmount;
  /**
   * Whether or not the token account is initialized.
   */
  isInitialized?: boolean;
}

/**
 * Cache of token/owner mapped to its ATA.
 */
const ataCache: Record<string, PublicKey> = {};

const useUserATAsArray = (
  tokens: readonly (Token | null | undefined)[]
):
  | readonly (AssociatedTokenAccount | null | undefined)[]
  | null
  | undefined => {
  const wallet = useConnectedWallet();
  const owner = wallet?.publicKey;
  const solBalance = useSOLBalance(owner);

  const memoTokens = useMemo(
    () => tokens,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(tokens.map((tok) => tok?.mintAccount.toString()))]
  );

  const { data: userATAKeys } = useQuery(
    [
      "userATAKeys",
      owner?.toString(),
      ...memoTokens.map((tok) => tok?.address),
    ],
    async () => {
      return await Promise.all(
        memoTokens.map(async (token) => {
          if (!token) {
            return token;
          }
          if (!owner) {
            return null;
          }
          const cacheKey = `${token.address}_${owner.toString()}`;
          if (ataCache[cacheKey]) {
            return ataCache[cacheKey];
          }
          const ata = await getATAAddress({
            mint: token.mintAccount,
            owner,
          });
          ataCache[cacheKey] = ata;
          return ata;
        })
      );
    },
    {
      staleTime: Infinity,
    }
  );
  const { data: atas } = useBatchedTokenAccounts(userATAKeys);

  return useMemo(() => {
    if (!owner) {
      return null;
    }
    if (!atas) {
      return atas;
    }
    return atas.map((datum, i) => {
      const token = memoTokens[i];
      if (token?.mintAccount.equals(RAW_SOL_MINT)) {
        return {
          key: owner,
          balance: solBalance ?? new TokenAmount(token, 0),
          isInitialized: !!(solBalance && !solBalance.isZero()),
        };
      }
      if (!token) {
        return token;
      }
      const key = userATAKeys?.[i];
      if (!key) {
        return key;
      }
      return {
        key,
        balance: new TokenAmount(token, datum?.account.amount ?? 0),
        isInitialized: datum?.account.isInitialized,
      };
    });
  }, [atas, memoTokens, owner, solBalance, userATAKeys]);
};

export type Tuple<T, N extends number> = N extends N
  ? number extends N
    ? T[]
    : _TupleOf<T, N, []>
  : never;
export type _TupleOf<
  T,
  N extends number,
  R extends unknown[]
> = R["length"] extends N ? R : _TupleOf<T, N, [T, ...R]>;

/**
 * Loads ATAs owned by a user.
 * @param tokens
 * @returns
 */
export const useUserATAs = <N extends number>(
  ...tokens: Tuple<Token | null | undefined, N>
): Tuple<AssociatedTokenAccount | null | undefined, N> => {
  const atasList = useUserATAsArray(tokens);
  if (!atasList) {
    return tokens.map(() => atasList) as Tuple<
      AssociatedTokenAccount | null | undefined,
      N
    >;
  }
  return atasList as Tuple<AssociatedTokenAccount | null | undefined, N>;
};

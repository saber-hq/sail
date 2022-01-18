import type { MintData, TokenAccountData } from "@saberhq/token-utils";
import { deserializeAccount, deserializeMint } from "@saberhq/token-utils";

import type { AccountParser } from "./useParsedAccountsData";

/**
 * Parses token accounts.
 */
export const TOKEN_ACCOUNT_PARSER: AccountParser<TokenAccountData> = (info) => {
  return {
    address: info.accountId,
    ...deserializeAccount(info.accountInfo.data),
  };
};

/**
 * Parses mint accounts.
 */
export const MINT_PARSER: AccountParser<MintData> = (d) => {
  return deserializeMint(d.accountInfo.data);
};

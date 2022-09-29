import type { MintData } from "@saberhq/token-utils";
import { deserializeAccount, deserializeMint } from "@saberhq/token-utils";
import type { AccountInfo } from "@solana/spl-token";
import type { AccountParser } from "./useParsedAccountsData";

/**
 * Parses token accounts.
 */
export const TOKEN_ACCOUNT_PARSER: AccountParser<AccountInfo> = (info) => {
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

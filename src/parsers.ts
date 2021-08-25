import type { MintData, TokenAccountData } from "@saberhq/token-utils";
import { deserializeAccount, deserializeMint } from "@saberhq/token-utils";

import type { AccountParser } from "./useParsedAccountsData";

/**
 * Parses token accounts.
 */
export const TOKEN_ACCOUNT_PARSER: AccountParser<TokenAccountData> = (info) => {
  return deserializeAccount(info.accountId, info.accountInfo.data);
};

/**
 * Parses mint accounts.
 */
export const MINT_PARSER: AccountParser<MintData | null> = (d) => {
  try {
    return deserializeMint(d.accountInfo.data);
  } catch (e) {
    console.warn(
      `Could not deserialize mint for ${d.accountId?.toString() ?? "(none)"}`
    );
    return null;
  }
};

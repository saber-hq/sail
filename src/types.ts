import type { AccountInfo, KeyedAccountInfo, PublicKey } from "@solana/web3.js";

import type { SailAccountLoadError } from "./errors/errors";

/**
 * Account id + info.
 * This is null if the account could not be found, or undefined
 * if the data is still loading.
 */
export type AccountDatum = KeyedAccountInfo | null | undefined;

/**
 * Result of the fetching of an account.
 */
export interface AccountFetchResult {
  data: AccountDatum;
  error?: SailAccountLoadError;
}

/**
 * Parsed account with additional info.
 */
export type ParsedAccountInfo<T> = {
  accountId: PublicKey;
  accountInfo: AccountInfo<T>;
  raw: Buffer;
};

export type ParsedAccountDatum<T> = ParsedAccountInfo<T> | undefined | null;

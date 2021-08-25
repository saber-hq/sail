import type { AccountInfo, KeyedAccountInfo, PublicKey } from "@solana/web3.js";

export type AccountDatum = KeyedAccountInfo | null | undefined;

/**
 * Parsed account with additional info.
 */
export type ParsedAccountInfo<T> = {
  accountId: PublicKey;
  accountInfo: AccountInfo<T>;
  raw: Buffer;
};

export type ParsedAccountDatum<T> = ParsedAccountInfo<T> | undefined | null;

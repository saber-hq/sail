import type { Network, TransactionEnvelope } from "@saberhq/solana-contrib";
import type {
  Commitment,
  KeyedAccountInfo,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";

import type { TransactionErrorType } from "./categorizeTransactionError";
import { categorizeTransactionError } from "./categorizeTransactionError";

export type SailErrorName = `Sail${
  | "UnknownTXFail"
  | "Transaction"
  | "InsufficientSOL"
  | "RefetchAfterTX"
  | "RefetchSubscriptions"
  | "TransactionSign"
  | "CacheRefetch"
  | "AccountParse"
  | "AccountLoad"
  | "GetMultipleAccounts"}Error`;

export const ERROR_TITLES: { [N in SailErrorName]: string } = {
  SailUnknownTXFailError: "Transaction failed",
  SailTransactionError: "Transaction processing failed",
  SailInsufficientSOLError: "Insufficient SOL balance",
  SailRefetchAfterTXError: "Error fetching changed accounts",
  SailRefetchSubscriptionsError: "Error refetching subscribed accounts",
  SailTransactionSignError: "Error signing transactions",
  SailCacheRefetchError: "Error refetching from cache",
  SailAccountParseError: "Error parsing account",
  SailAccountLoadError: "Error loading account",
  SailGetMultipleAccountsError: "Error fetching multiple accounts",
};

/**
 * Extracts the message from an error.
 * @param errLike Error-like object.
 * @returns
 */
export const extractErrorMessage = (errLike: unknown): string | null => {
  return "message" in (errLike as { message?: string })
    ? (errLike as { message?: string }).message ?? null
    : null;
};

/**
 * Error originating from Sail.
 */
export class SailError extends Error {
  _isSailError = true;

  constructor(
    /**
     * Name of the Sail error.
     */
    readonly sailErrorName: SailErrorName,
    /**
     * The original error thrown, if applicable.
     */
    readonly originalError: unknown,
    /**
     * Underlying error message.
     */
    readonly cause = `${extractErrorMessage(originalError) ?? "unknown"}`
  ) {
    super(`${ERROR_TITLES[sailErrorName]}: ${cause}`);
    this.name = sailErrorName;
    if (originalError instanceof Error) {
      this.stack = originalError.stack;
    }
  }

  /**
   * Title of the error.
   */
  get title(): string {
    return ERROR_TITLES[this.sailErrorName];
  }
}

/**
 * Error originating from Sail.
 */
export class SailUnknownTXFailError extends SailError {
  constructor(
    originalError: unknown,
    readonly network: Network,
    readonly txs: readonly TransactionEnvelope[]
  ) {
    super("SailUnknownTXFailError", originalError);
  }
}

/**
 * Error on a Solana transaction
 */
export class SailTransactionError extends SailError {
  constructor(
    readonly network: Network,
    originalError: unknown,
    readonly tx: TransactionEnvelope,
    /**
     * User message representing the transaction.
     */
    readonly userMessage?: string
  ) {
    super("SailTransactionError", originalError);
  }

  /**
   * Tag used for grouping errors together.
   */
  get tag(): TransactionErrorType | null {
    return categorizeTransactionError(this.message);
  }

  /**
   * Returns true if this error is associated with a simulation.
   */
  get isSimulation(): boolean {
    return this.message.includes("Transaction simulation failed: ");
  }

  /**
   * Fingerprint used for grouping errors.
   */
  get fingerprint(): string[] {
    const tag = this.tag;
    if (tag) {
      return [this.name, tag];
    }
    return [this.name, ...this.message.split(": ")];
  }

  /**
   * Generates a debug string representation of the transactions involved in this error.
   * @param network
   * @returns
   */
  generateLogMessage(): string {
    const parts = [this.tx.debugStr];
    if (this.network !== "localnet") {
      parts.push(
        `View on Solana Explorer: ${this.tx.generateInspectLink(this.network)}`
      );
    }
    return parts.join("\n");
  }
}

/**
 * Thrown if there is not enough SOL to pay for a transaction.
 */
export class InsufficientSOLError extends SailError {
  constructor(readonly currentBalance?: number) {
    super("SailInsufficientSOLError", null, "Insufficient SOL balance");
  }
}

/**
 * Thrown if there is an error refetching accounts after a transaction.
 */
export class SailRefetchAfterTXError extends SailError {
  constructor(
    originalError: unknown,
    readonly writable: readonly PublicKey[],
    readonly txSigs: readonly TransactionSignature[]
  ) {
    super("SailRefetchAfterTXError", originalError);
  }
}

/**
 * Thrown if an error occurs when refetching subscriptions.
 */
export class SailRefetchSubscriptionsError extends SailError {
  constructor(originalError: unknown) {
    super("SailRefetchSubscriptionsError", originalError);
  }
}

/**
 * Thrown if transactions could not be signed.
 */
export class SailTransactionSignError extends SailError {
  constructor(
    originalError: unknown,
    readonly txs: readonly TransactionEnvelope[]
  ) {
    super("SailTransactionSignError", originalError);
  }
}

/**
 * Thrown if a cache refetch results in an error.
 */
export class SailCacheRefetchError extends SailError {
  constructor(
    originalError: unknown,
    readonly keys: readonly (PublicKey | null | undefined)[]
  ) {
    super("SailCacheRefetchError", originalError);
  }
}

/**
 * Thrown if there is an error parsing an account.
 */
export class SailAccountParseError extends SailError {
  constructor(originalError: unknown, readonly data: KeyedAccountInfo) {
    super("SailAccountParseError", originalError);
  }
}

/**
 * Thrown if an account could not be loaded.
 */
export class SailAccountLoadError extends SailError {
  constructor(originalError: unknown, readonly accountId: PublicKey) {
    super("SailAccountLoadError", originalError);
  }

  get userMessage(): string {
    return `Error loading account ${this.accountId.toString()}`;
  }
}

/**
 * Callback called whenever getMultipleAccounts fails.
 */
export class SailGetMultipleAccountsError extends SailError {
  constructor(
    readonly keys: readonly PublicKey[],
    readonly commitment: Commitment,
    originalError: unknown
  ) {
    super("SailGetMultipleAccountsError", originalError);
  }
}

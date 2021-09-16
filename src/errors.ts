import type { Network, TransactionEnvelope } from "@saberhq/solana-contrib";
import type {
  KeyedAccountInfo,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";

import { categorizeTransactionError } from "./tx/categorizeTransactionError";
import type { TransactionErrorType } from "./tx/types";

/**
 * Error on a Solana transaction
 */
export class SolanaTransactionError extends Error {
  constructor(
    public readonly network: Network,
    public readonly originalError: Error,
    public readonly txs: readonly TransactionEnvelope[]
  ) {
    super(originalError.message);
    this.name = "SolanaTransactionError";
    this.stack = originalError.stack;
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
  generateTXsString(network: Network = "mainnet-beta"): string {
    return this.txs
      .map((tx, i) => {
        const parts = [`TX #${i + 1} of ${this.txs.length}:`, tx.debugStr];
        if (network !== "localnet") {
          parts.push(
            `View on Solana Explorer: ${tx.generateInspectLink(network)}`
          );
        }
        return parts.join("\n");
      })
      .join("\n\n");
  }
}

export class InsufficientSOLError extends Error {
  constructor() {
    super("Insufficient SOL balance");
    this.name = "InsufficientSOLError";
  }
}

export class SailRefetchAfterTXError extends Error {
  constructor(
    public readonly originalError: unknown,
    public readonly writable: readonly PublicKey[],
    public readonly txSigs: readonly TransactionSignature[]
  ) {
    super(
      `Error refetching accounts after transaction: ${
        originalError instanceof Error ? originalError.message : "unknown"
      }`
    );
    this.name = "SailRefetchAfterTXError";
  }
}

export class SailRefetchSubscriptionsError extends Error {
  constructor(public readonly originalError: unknown) {
    super(
      `Error refetching subscribed accounts: ${
        originalError instanceof Error ? originalError.message : "unknown"
      }`
    );
    this.name = "SailRefetchSubscriptionsError";
  }
}

export class SailCacheRefetchError extends Error {
  constructor(
    public readonly originalError: unknown,
    public readonly keys: readonly (PublicKey | null | undefined)[]
  ) {
    super(
      `Error refetching from cache: ${
        originalError instanceof Error ? originalError.message : "unknown"
      }`
    );
    this.name = "SailCacheRefetchError";
  }
}

export class SailAccountParseError extends Error {
  constructor(
    public readonly originalError: unknown,
    public readonly data: KeyedAccountInfo
  ) {
    super(
      `Error parsing account: ${
        originalError instanceof Error ? originalError.message : "unknown"
      }`
    );
    this.name = "SailAccountParseError";
  }
}

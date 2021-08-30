import type { Network } from "@saberhq/solana-contrib";

import { categorizeTransactionError } from "./categorizeTransactionError";
import type { TransactionErrorType } from "./types";

/**
 * Error on a Solana transaction
 */
export class SolanaTransactionError extends Error {
  constructor(
    public readonly network: Network,
    public readonly originalError: Error
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
   * Fingerprint used for grouping errors.
   */
  get fingerprint(): string[] {
    const tag = this.tag;
    if (tag) {
      return [this.name, tag];
    }
    return [this.name, ...this.message.split(": ")];
  }
}

export class InsufficientSOLError extends Error {
  constructor() {
    super("Insufficient SOL balance");
    this.name = "InsufficientSOLError";
  }
}

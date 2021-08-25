import type { Network } from "@saberhq/solana-contrib";

export enum TransactionErrorType {
  NotConfirmed = "not-confirmed",
  Cancelled = "cancelled",
  NodeBehind = "node-behind",
  SignatureRequestDenied = "signature-request-denied",
  InsufficientSOL = "insufficient-sol",
}

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
    if (this.message.startsWith("Transaction was not confirmed in")) {
      return TransactionErrorType.NotConfirmed;
    }
    if (this.message.startsWith("Transaction cancelled")) {
      return TransactionErrorType.Cancelled;
    }
    if (
      this.message.startsWith("failed to send transaction: Node is behind by")
    ) {
      return TransactionErrorType.NodeBehind;
    }
    if (this.message === "Signature request denied") {
      return TransactionErrorType.SignatureRequestDenied;
    }
    if (this.message === "Insufficient SOL balance") {
      return TransactionErrorType.InsufficientSOL;
    }
    return null;
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

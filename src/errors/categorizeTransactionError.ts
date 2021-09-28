export enum TransactionErrorType {
  NotConfirmed = "not-confirmed",
  Cancelled = "cancelled",
  NodeBehind = "node-behind",
  SignatureRequestDenied = "signature-request-denied",
  InsufficientSOL = "insufficient-sol",
  BlockhashNotFound = "blockhash-not-found",
}

/**
 * Categorizes an error coming from the Solana Web3 SDK.
 * @param msg
 * @returns
 */
export const categorizeTransactionError = (
  msg: string
): TransactionErrorType | null => {
  if (msg.startsWith("Transaction was not confirmed in")) {
    return TransactionErrorType.NotConfirmed;
  }
  if (msg.startsWith("Transaction cancelled")) {
    return TransactionErrorType.Cancelled;
  }
  if (msg.startsWith("failed to send transaction: Node is behind by")) {
    return TransactionErrorType.NodeBehind;
  }
  if (msg === "Signature request denied") {
    return TransactionErrorType.SignatureRequestDenied;
  }
  if (msg === "Insufficient SOL balance") {
    return TransactionErrorType.InsufficientSOL;
  }
  if (msg.endsWith("Blockhash not found")) {
    return TransactionErrorType.BlockhashNotFound;
  }
  return null;
};

export enum TransactionErrorType {
  NotConfirmed = "not-confirmed",
  Cancelled = "cancelled",
  NodeBehind = "node-behind",
  SignatureRequestDenied = "signature-request-denied",
  InsufficientSOL = "insufficient-sol",
  BlockhashNotFound = "blockhash-not-found",
}

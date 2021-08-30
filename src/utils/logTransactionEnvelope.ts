import type { TransactionEnvelope } from "@saberhq/solana-contrib";

/**
 * Logs the contents of a {@link TransactionEnvelope} at the debug level.
 * @param tx
 */
export const logTransactionEnvelope = (tx: TransactionEnvelope): void => {
  console.debug(
    "=> Instructions",
    tx.instructions
      .map((ser, i) => {
        return [
          `Instruction ${i}: ${ser.programId.toString()}`,
          ...ser.keys.map(
            (k, i) =>
              `  [${i}] ${k.pubkey.toString()} ${k.isWritable ? "(mut)" : ""} ${
                k.isSigner ? "(signer)" : ""
              }`
          ),
          `  Data (base64): ${ser.data.toString("base64")}`,
        ].join("\n");
      })
      .join("\n")
  );
  console.debug(
    "=> Signers",
    tx.signers.map((sg) => sg.publicKey.toString()).join("\n")
  );
};

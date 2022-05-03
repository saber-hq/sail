import type {
  TransactionEnvelope,
  TransactionReceipt,
} from "@saberhq/solana-contrib";
import { useCallback } from "react";

import { SailSignAndConfirmError } from "../errors/errors";
import { useSail } from "../provider";
import type { HandleTXOptions } from "./useHandleTXs";

/**
 * Transaction handler helpers.
 */
export interface TXHandlers {
  /**
   * Signs and confirms a transaction before returning.
   */
  signAndConfirmTX: (
    txEnv: TransactionEnvelope,
    msg?: string,
    options?: HandleTXOptions
  ) => Promise<TransactionReceipt>;

  /**
   * Signs and confirms multiple transactions before returning.
   */
  signAndConfirmTXs: (
    txEnvs: readonly TransactionEnvelope[],
    msg?: string,
    options?: HandleTXOptions
  ) => Promise<readonly TransactionReceipt[]>;
}

export const useTXHandlers = (): TXHandlers => {
  const { handleTX, handleTXs } = useSail();
  const signAndConfirmTX = useCallback(
    async (
      txEnv: TransactionEnvelope,
      msg?: string,
      options?: HandleTXOptions
    ): Promise<TransactionReceipt> => {
      const { pending, success, errors } = await handleTX(txEnv, msg, options);
      if (!pending || !success) {
        throw new SailSignAndConfirmError(errors);
      }
      return await pending.wait({ useWebsocket: true });
    },
    [handleTX]
  );

  const signAndConfirmTXs = useCallback(
    async (
      txEnvs: readonly TransactionEnvelope[],
      msg?: string,
      options?: HandleTXOptions
    ): Promise<readonly TransactionReceipt[]> => {
      const { pending, success, errors } = await handleTXs(
        txEnvs,
        msg,
        options
      );
      if (!pending || !success) {
        throw new SailSignAndConfirmError(errors);
      }
      return await Promise.all(
        pending.map((p) => p.wait({ useWebsocket: true }))
      );
    },
    [handleTXs]
  );

  return { signAndConfirmTX, signAndConfirmTXs };
};

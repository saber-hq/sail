import type {
  Network,
  PendingTransaction,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import { generateUncheckedInspectLink } from "@saberhq/solana-contrib";
import { useSolana } from "@saberhq/use-solana";
import type { ConfirmOptions, Finality, Transaction } from "@solana/web3.js";
import { useCallback } from "react";
import type { OperationOptions } from "retry";
import invariant from "tiny-invariant";

import type { UseAccounts } from "..";
import {
  extractErrorMessage,
  InsufficientSOLError,
  SailError,
  SailRefetchAfterTXError,
  SailTransactionError,
  SailTransactionSignError,
  SailUnknownTXFailError,
} from "../errors";

const DEBUG_MODE =
  (!!process.env.REACT_APP_LOCAL_PUBKEY || !!process.env.LOCAL_PUBKEY) ??
  !!process.env.DEBUG_MODE;

export interface HandleTXResponse {
  success: boolean;
  pending: PendingTransaction | null;
  errors?: SailError[];
}

export interface HandleTXsResponse {
  success: boolean;
  pending: PendingTransaction[];
  errors?: SailError[];
}

export interface UseHandleTXsArgs extends Pick<UseAccounts, "refetchMany"> {
  /**
   * Delay for the writable accounts to be refetched into the cache after a transaction.
   */
  txRefetchDelayMs?: number;

  /**
   * Called whenever a Transaction is sent.
   */
  onTxSend?: (args: {
    network: Network;
    pending: PendingTransaction[];
    message?: string;
  }) => void;

  /**
   * Called whenever an error occurs.
   */
  onError: (err: SailError) => void;

  /**
   * If true, waits for a confirmation before proceeding to the next transaction.
   */
  waitForConfirmation?: boolean;
}

export interface HandleTXOptions extends ConfirmOptions {
  /**
   * Options to pass in after a refetch has occured.
   */
  refetchAfterTX?: OperationOptions & {
    commitment?: Finality;
    /**
     * Delay for the writable accounts to be refetched into the cache after a transaction.
     */
    refetchDelayMs?: number;
  };
}

export interface UseHandleTXs {
  handleTX: (
    txEnv: TransactionEnvelope,
    msg?: string,
    options?: HandleTXOptions
  ) => Promise<HandleTXResponse>;
  handleTXs: (
    txEnv: TransactionEnvelope[],
    msg?: string,
    options?: HandleTXOptions
  ) => Promise<HandleTXsResponse>;
}

export const useHandleTXsInternal = ({
  refetchMany,
  onTxSend,
  onError,
  txRefetchDelayMs = 1_000,
  waitForConfirmation = false,
}: UseHandleTXsArgs): UseHandleTXs => {
  const { network } = useSolana();

  const handleTXs = useCallback(
    async (
      txs: TransactionEnvelope[],
      message?: string,
      options?: HandleTXOptions
    ): Promise<{
      success: boolean;
      pending: PendingTransaction[];
      errors?: SailError[];
    }> => {
      if (txs.length === 0) {
        return {
          success: true,
          pending: [],
        };
      }

      if (DEBUG_MODE) {
        txs.forEach(async (tx, i) => {
          console.debug("tx:", i);
          if (network !== "localnet") {
            console.debug(generateUncheckedInspectLink(network, tx.build()));
          }
          console.debug(await tx.simulateTable(options));
        });
      }

      try {
        const firstTX = txs[0];
        invariant(firstTX, "firstTX");
        const provider = firstTX.provider;

        // TODO(igm): when we support other accounts being the payer,
        // we need to alter this check
        const nativeBalance = (
          await provider.getAccountInfo(provider.wallet.publicKey)
        )?.accountInfo.lamports;
        if (!nativeBalance || nativeBalance === 0) {
          const error = new InsufficientSOLError(nativeBalance);
          onError(error);
          return {
            success: false,
            pending: [],
            errors: [error],
          };
        }

        let signedTXs: Transaction[];
        try {
          signedTXs = await provider.signer.signAll(
            txs.map((tx) => ({ tx: tx.build(), signers: tx.signers })),
            options
          );
        } catch (e) {
          const fail = new SailTransactionSignError(e, txs);
          onError(fail);
          return {
            success: false,
            pending: [],
            errors: [fail],
          };
        }

        const errors: SailError[] = [];
        const maybePending = await Promise.all(
          signedTXs.map(async (signedTX, i) => {
            try {
              return await provider.broadcaster.broadcast(signedTX, options);
            } catch (e) {
              const txEnvelope = txs[i];
              if (!txEnvelope) {
                // should be impossible
                throw new Error(`Unknown TX: ${i} of ${txs.length}`);
              }
              const txError = new SailTransactionError(
                network,
                e,
                txEnvelope,
                message
              );
              console.error(`Error sending TX ${i}: ${txError.message}`);
              console.debug(txError.generateLogMessage());
              errors.push(txError);
              onError(txError);
              return null;
            }
          })
        );

        // if any TXs could not send, do not continue.
        const pending = maybePending.filter(
          (p): p is PendingTransaction => !!p
        );
        if (errors.length > 0) {
          // don't throw anything here because we already threw the errors above
          return {
            success: false,
            pending,
            errors,
          };
        }

        // get the unique writable keys for every transaction
        const writable = [
          ...new Set([...txs.flatMap((tx) => tx.writableKeys)]),
        ];

        // refetch everything
        void (async () => {
          const refetchAfterTX = options?.refetchAfterTX;
          try {
            // wait for the tx to be confirmed
            // it is possible that it never gets
            await Promise.all(
              pending.map((p) =>
                p
                  .wait({
                    commitment: "confirmed",
                    minTimeout: 1_000,
                    ...refetchAfterTX,
                  })
                  .catch((err) => {
                    throw new Error(
                      `Could not await confirmation of transaction ${
                        p.signature
                      }: ${extractErrorMessage(err) ?? "unknown"}`
                    );
                  })
              )
            );
            // then fetch, after a delay
            setTimeout(() => {
              void refetchMany(writable).catch((e) => {
                onError(
                  new SailRefetchAfterTXError(
                    e,
                    writable,
                    pending.map((p) => p.signature)
                  )
                );
              });
            }, refetchAfterTX?.refetchDelayMs ?? txRefetchDelayMs);
          } catch (e) {
            onError(
              new SailRefetchAfterTXError(
                e,
                writable,
                pending.map((p) => p.signature)
              )
            );
          }
        })();

        if (waitForConfirmation) {
          // await for the tx to be confirmed
          await Promise.all(pending.map((p) => p.wait()));
        }

        onTxSend?.({ network, pending, message });
        return {
          success: true,
          pending,
        };
      } catch (e) {
        // Log the instruction logs
        console.error("Transaction failed.", e);
        txs.forEach((tx, i) => {
          if (txs.length > 1) {
            console.debug(`TX #${i + 1} of ${txs.length}`);
          }
          console.debug(tx.debugStr);
          if (network !== "localnet") {
            console.debug(
              `View on Solana Explorer: ${tx.generateInspectLink(network)}`
            );
          }
        });

        const sailError: SailError =
          e instanceof SailError ||
          ("_isSailError" in (e as SailError) && (e as SailError)._isSailError)
            ? (e as SailError)
            : new SailUnknownTXFailError(e, network, txs);
        onError(sailError);
        return { success: false, pending: [], errors: [sailError] };
      }
    },
    [
      network,
      onError,
      onTxSend,
      refetchMany,
      txRefetchDelayMs,
      waitForConfirmation,
    ]
  );

  const handleTX = useCallback(
    async (
      txEnv: TransactionEnvelope,
      message?: string,
      options?: HandleTXOptions
    ): Promise<{
      success: boolean;
      pending: PendingTransaction | null;
      errors?: SailError[];
    }> => {
      const { success, pending, errors } = await handleTXs(
        [txEnv],
        message,
        options
      );
      return { success, pending: pending[0] ?? null, errors };
    },
    [handleTXs]
  );

  return { handleTX, handleTXs };
};

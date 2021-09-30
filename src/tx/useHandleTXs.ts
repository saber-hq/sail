import type {
  Network,
  PendingTransaction,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import { useSolana } from "@saberhq/use-solana";
import type { AccountInfo, ConfirmOptions, PublicKey } from "@solana/web3.js";
import { useCallback } from "react";
import invariant from "tiny-invariant";

import {
  InsufficientSOLError,
  SailError,
  SailRefetchAfterTXError,
  SailTransactionError,
  SailUnknownTXFailError,
} from "../errors";

export interface HandleTXResponse {
  success: boolean;
  pending: PendingTransaction | null;
}

export interface HandleTXsResponse {
  success: boolean;
  pending: PendingTransaction[];
}

export interface UseHandleTXsArgs {
  /**
   * Fetches a transaction.
   */
  refetch: (key: PublicKey) => Promise<AccountInfo<Buffer> | null>;

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

export interface UseHandleTXs {
  handleTX: (
    txEnv: TransactionEnvelope,
    msg?: string,
    confirmOptions?: ConfirmOptions
  ) => Promise<HandleTXResponse>;
  handleTXs: (
    txEnv: TransactionEnvelope[],
    msg?: string,
    confirmOptions?: ConfirmOptions
  ) => Promise<HandleTXsResponse>;
}

export const useHandleTXsInternal = ({
  refetch,
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
      confirmOptions?: ConfirmOptions
    ): Promise<{
      success: boolean;
      pending: PendingTransaction[];
      errors: SailError[];
    }> => {
      if (txs.length === 0) {
        return {
          success: true,
          pending: [],
          errors: [],
        };
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
          return {
            success: false,
            pending: [],
            errors: [new InsufficientSOLError(nativeBalance)],
          };
        }

        const signedTXs = await provider.signer.signAll(
          txs.map((tx) => ({ tx: tx.build(), signers: tx.signers })),
          confirmOptions
        );

        const errors: SailError[] = [];
        const maybePending = await Promise.all(
          signedTXs.map(async (signedTX, i) => {
            try {
              return await provider.broadcaster.broadcast(
                signedTX,
                confirmOptions
              );
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
              console.error(txError.generateLogMessage());
              errors.push(txError);
              onError(txError);
            }
          })
        );

        // if any TXs could not send, do not continue.
        const pending = maybePending.filter(
          (p): p is PendingTransaction => !!p
        );
        if (maybePending.find((p) => !p)) {
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
        // TODO(igm): this can fail
        // more importantly, this should be handled server-side
        // with our own websocket server
        void (async () => {
          try {
            // await for the tx to be confirmed
            await Promise.all(pending.map((p) => p.wait()));
            // then fetch
            await Promise.all(
              writable.map(async (wr) => {
                await refetch(wr);
                setTimeout(() => {
                  void refetch(wr).catch((e) => {
                    onError(
                      new SailRefetchAfterTXError(
                        e,
                        writable,
                        pending.map((p) => p.signature)
                      )
                    );
                  });
                }, txRefetchDelayMs);
              })
            );
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
          errors: [],
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

        const error: SailError =
          e instanceof SailError
            ? e
            : new SailUnknownTXFailError(e, network, txs);
        return { success: false, pending: [], errors: [error] };
      }
    },
    [network, onError, onTxSend, refetch, txRefetchDelayMs, waitForConfirmation]
  );

  const handleTX = useCallback(
    async (
      txEnv: TransactionEnvelope,
      message?: string,
      confirmOptions?: ConfirmOptions
    ): Promise<{ success: boolean; pending: PendingTransaction | null }> => {
      const { success, pending } = await handleTXs(
        [txEnv],
        message,
        confirmOptions
      );
      return { success, pending: pending[0] ?? null };
    },
    [handleTXs]
  );

  return { handleTX, handleTXs };
};

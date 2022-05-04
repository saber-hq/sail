import type {
  Network,
  PendingTransaction,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import { mapN } from "@saberhq/solana-contrib";
import { useSolana } from "@saberhq/use-solana";
import type { ConfirmOptions, Finality, Transaction } from "@solana/web3.js";
import { useCallback } from "react";
import type { OperationOptions } from "retry";
import invariant from "tiny-invariant";

import type { UseAccounts } from "..";
import { uniqKeys } from "..";
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
  !!process.env.REACT_APP_LOCAL_PUBKEY ||
  !!process.env.LOCAL_PUBKEY ||
  !!process.env.DEBUG_MODE;

/**
 * Response when transactions are handled.
 */
export interface HandleTXResponse {
  success: boolean;
  pending: PendingTransaction | null;
  errors?: readonly SailError[];
}

export interface HandleTXsResponse {
  success: boolean;
  pending: readonly PendingTransaction[];
  errors?: readonly SailError[];
}

/**
 * Generates a random identifier for a handled transaction.
 * @returns string
 */
const genRandomBundleID = (): string => `bundle-${Math.random()}`;

export interface UseHandleTXsArgs extends Pick<UseAccounts, "refetchMany"> {
  /**
   * Delay for the writable accounts to be refetched into the cache after a transaction.
   */
  txRefetchDelayMs?: number;

  /**
   * Called right before a {@link TransactionEnvelope} is sent.
   */
  onBeforeTxSend?: (args: {
    /**
     * Unique identifier for the bundle of transactions.
     */
    bundleID: string;
    /**
     * The {@link Network} this transaction is taking place on.
     */
    network: Network;
    /**
     * The {@link TransactionEnvelope}s about to be sent.
     */
    txs: readonly TransactionEnvelope[];
    /**
     * Message identifying the transaction.
     */
    message?: string;
  }) => void;

  /**
   * Called whenever a {@link TransactionEnvelope} is sent.
   */
  onTxSend?: (args: {
    /**
     * Unique identifier for the bundle of transactions.
     */
    bundleID: string;
    /**
     * The {@link Network} this transaction is taking place on.
     */
    network: Network;
    /**
     * The {@link TransactionEnvelope}s that were sent.
     */
    txs: readonly TransactionEnvelope[];
    /**
     * Pending transactions.
     */
    pending: readonly PendingTransaction[];
    /**
     * Message identifying the transaction.
     */
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
    /**
     * Commitment of the confirmed transaction to fetch.
     */
    commitment?: Finality;
    /**
     * Delay for the writable accounts to be refetched into the cache after a transaction.
     */
    refetchDelayMs?: number;
    /**
     * Whether or not to use websockets for awaiting confirmation. Defaults to `false`.
     */
    useWebsocket?: boolean;
  };
  /**
   * Whether or not to handle the TX envelope in debug mode.
   */
  debugMode?: boolean;
}

/**
 * Function which signs and sends a {@link TransactionEnvelope}.
 */
export type HandleTX = (
  txEnv: TransactionEnvelope,
  msg?: string,
  options?: HandleTXOptions
) => Promise<HandleTXResponse>;

/**
 * Function which signs and sends a set of {@link TransactionEnvelope}.
 */
export type HandleTXs = (
  txEnv: readonly TransactionEnvelope[],
  msg?: string,
  options?: HandleTXOptions
) => Promise<HandleTXsResponse>;
export interface UseHandleTXs {
  /**
   * Signs and sends a transaction using the provider on the {@link TransactionEnvelope}.
   */
  handleTX: HandleTX;
  /**
   * Signs and sends multiple transactions using the provider on the first {@link TransactionEnvelope}.
   * These transactions are only sent if all of them are signed.
   */
  handleTXs: HandleTXs;
}

export const useHandleTXsInternal = ({
  refetchMany,
  onBeforeTxSend,
  onTxSend,
  onError,
  txRefetchDelayMs = 1_000,
  waitForConfirmation = false,
}: UseHandleTXsArgs): UseHandleTXs => {
  const { network } = useSolana();

  const handleTXs = useCallback(
    async (
      txs: readonly TransactionEnvelope[],
      message?: string,
      options?: HandleTXOptions
    ): Promise<{
      success: boolean;
      pending: readonly PendingTransaction[];
      errors?: readonly SailError[];
    }> => {
      if (txs.length === 0) {
        return {
          success: true,
          pending: [],
        };
      }

      if (options?.debugMode ?? DEBUG_MODE) {
        const txTable = await Promise.all(
          txs.map(async (tx) => {
            return await tx.simulateTable({ verifySigners: false, ...options });
          })
        );
        txs.forEach((tx, i) => {
          const table = txTable[i];
          if (network !== "localnet") {
            console.debug(tx.generateInspectLink(network));
          }
          console.debug(table);
        });
      }

      const bundleID = genRandomBundleID();
      onBeforeTxSend?.({ bundleID, network, txs, message });

      try {
        const firstTX = txs[0];
        invariant(firstTX, "firstTX");
        const provider = firstTX.provider;

        // TODO(igm): when we support other accounts being the payer,
        // we need to alter this check
        const [nativeAccount] = await refetchMany([provider.wallet.publicKey]);
        const nativeBalance = mapN(
          (nativeAccount) =>
            "data" in nativeAccount ? nativeAccount.lamports : null,
          nativeAccount
        );
        if (!nativeBalance) {
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
        const writable = uniqKeys(txs.flatMap((tx) => tx.writableKeys));

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
                onError(new SailRefetchAfterTXError(e, writable, pending));
              });
            }, refetchAfterTX?.refetchDelayMs ?? txRefetchDelayMs);
          } catch (e) {
            onError(new SailRefetchAfterTXError(e, writable, pending));
          }
        })();

        onTxSend?.({ bundleID, network, txs, pending, message });

        if (waitForConfirmation) {
          // await for the tx to be confirmed
          await Promise.all(pending.map((p) => p.wait()));
        }

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
          SailError.tryInto(e) ?? new SailUnknownTXFailError(e, network, txs);
        onError(sailError);
        return { success: false, pending: [], errors: [sailError] };
      }
    },
    [
      network,
      onBeforeTxSend,
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
      errors?: readonly SailError[];
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

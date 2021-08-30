import type { Network, TransactionEnvelope } from "@saberhq/solana-contrib";
import { PendingTransaction, sendAll } from "@saberhq/solana-contrib";
import { useSolana } from "@saberhq/use-solana";
import type { AccountInfo, PublicKey } from "@solana/web3.js";
import { useCallback } from "react";
import invariant from "tiny-invariant";

import { logTransactionEnvelope } from "../utils/logTransactionEnvelope";
import {
  InsufficientSOLError,
  SolanaTransactionError,
} from "./SolanaTransactionError";

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
   * Called whenever a transaction is sent.
   */
  onTxSend?: (args: {
    network: Network;
    pending: PendingTransaction[];
  }) => void;

  /**
   * Called whenever a transaction throws an error.
   */
  onTxError?: (err: SolanaTransactionError) => void;
}

export interface UseHandleTXs {
  handleTX: (txEnv: TransactionEnvelope) => Promise<HandleTXResponse>;
  handleTXs: (txEnv: TransactionEnvelope[]) => Promise<HandleTXsResponse>;
}

export const useHandleTXsInternal = ({
  refetch,
  onTxSend,
  onTxError,
  txRefetchDelayMs = 1_000,
}: UseHandleTXsArgs): UseHandleTXs => {
  const { network } = useSolana();

  const handleTXs = useCallback(
    async (
      txs: TransactionEnvelope[]
    ): Promise<{ success: boolean; pending: PendingTransaction[] }> => {
      if (txs.length === 0) {
        return {
          success: true,
          pending: [],
        };
      }

      try {
        const firstTX = txs[0];
        invariant(firstTX, "firstTX");
        const provider = firstTX.provider;

        // TODO(igm): when we support other accounts being the payer,
        // we need to alter this check
        const nativeBalance = (
          await provider.connection.getAccountInfo(provider.wallet.publicKey)
        )?.lamports;
        if (!nativeBalance || nativeBalance === 0) {
          throw new InsufficientSOLError();
        }

        try {
          const pending = (
            await sendAll({
              provider,
              reqs: txs.map((tx) => ({ tx: tx.build(), signers: tx.signers })),
              opts: {
                preflightCommitment: "recent",
                commitment: "recent",
              },
            })
          ).map((p) => new PendingTransaction(provider, p));

          // get the unique writable keys for every transaction
          const writable = [
            ...new Set([...txs.flatMap((tx) => tx.writableKeys)]),
          ];

          // refetch everything
          // TODO(igm): this can fail
          // more importantly, this should be handled server-side
          // with our own websocket server
          void (async () => {
            // await for the tx to be confirmed
            await Promise.all(pending.map((p) => p.wait()));
            // then fetch
            await Promise.all(
              writable.map(async (wr) => {
                await refetch(wr);
                setTimeout(() => {
                  void refetch(wr);
                }, txRefetchDelayMs);
              })
            );
          })();

          onTxSend?.({ network, pending });
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
            logTransactionEnvelope(tx);
          });

          throw e;
        }
      } catch (e) {
        onTxError?.(new SolanaTransactionError(network, e as Error));
        return { success: false, pending: [] };
      }
    },
    [network, onTxError, onTxSend, refetch, txRefetchDelayMs]
  );

  const handleTX = useCallback(
    async (
      txEnv: TransactionEnvelope
    ): Promise<{ success: boolean; pending: PendingTransaction | null }> => {
      const { success, pending } = await handleTXs([txEnv]);
      return { success, pending: pending[0] ?? null };
    },
    [handleTXs]
  );

  return { handleTX, handleTXs };
};

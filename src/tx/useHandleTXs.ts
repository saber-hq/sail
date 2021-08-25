import type { Network, TransactionEnvelope } from "@saberhq/solana-contrib";
import { PendingTransaction, sendAll } from "@saberhq/solana-contrib";
import { useSolana } from "@saberhq/use-solana";
import type { AccountInfo, PublicKey } from "@solana/web3.js";
import { useCallback } from "react";
import invariant from "tiny-invariant";

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
  refetch: (key: PublicKey) => Promise<AccountInfo<Buffer> | null>;

  /**
   * Delay for the writable accounts to be refetched into the cache after a transaction.
   */
  txRefetchDelayMs?: number;

  onTxSend?: (args: {
    network: Network;
    pending: PendingTransaction[];
  }) => void;
  onTxError?: (err: Error) => void;
}

export interface UseHandleTXs {
  handleTX: (txEnv: TransactionEnvelope) => Promise<HandleTXResponse>;
  handleTXs: (txEnv: TransactionEnvelope[]) => Promise<HandleTXsResponse>;
}

export const useHandleTXs = ({
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
          throw new SolanaTransactionError(network, new InsufficientSOLError());
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
          console.error("Transaction failed.");
          txs.forEach((tx, i) => {
            const serialized = tx.instructionsJSON;
            console.error(`TX #${i + 1} of ${txs.length}`);
            console.error(
              "=> Instructions",
              JSON.stringify(serialized, null, 2)
            );
            console.error(
              "=> Signers",
              JSON.stringify(
                tx.signers.map((sg) => sg.publicKey.toString()),
                null,
                2
              )
            );
          });

          const error = new SolanaTransactionError(network, e);
          throw error;
        }
      } catch (e) {
        onTxError?.(e);
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

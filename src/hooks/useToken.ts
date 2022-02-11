import type { Network } from "@saberhq/solana-contrib";
import type { TokenInfo } from "@saberhq/token-utils";
import { deserializeMint, networkToChainId, Token } from "@saberhq/token-utils";
import { useSolana } from "@saberhq/use-solana";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import type { UseQueryOptions } from "react-query";
import { useQueries, useQuery } from "react-query";

import type { FetchKeysFn } from "..";
import { useSail } from "../provider";
import { usePubkey } from "./usePubkey";

const makeCertifiedTokenInfoURL = (chainId: number, address: string) =>
  `https://cdn.jsdelivr.net/gh/CLBExchange/certified-token-list/${chainId}/${address}.json`;

const normalizeMint = (
  mint: PublicKey | null | undefined
): PublicKey | null | undefined => {
  if (!mint) {
    return mint;
  }
  // default pubkey is treated as null
  if (mint.equals(PublicKey.default)) {
    return null;
  }
  return mint;
};

const makeCertifiedTokenQuery = (
  network: Network,
  address: string | null | undefined
): UseQueryOptions<Token | null | undefined> => ({
  queryKey: ["sail/certifiedTokenInfo", network, address],
  queryFn: async ({ signal }): Promise<Token | null | undefined> => {
    if (address === null || address === undefined) {
      return address;
    }
    const chainId = networkToChainId(network);
    const resp = await fetch(makeCertifiedTokenInfoURL(chainId, address), {
      signal,
    });
    if (resp.status === 404) {
      return null;
    }
    const info = (await resp.json()) as TokenInfo;
    return new Token(info);
  },
  // these should never be stale, since token mints are immutable (other than supply)
  staleTime: Infinity,
});

/**
 * Loads multiple tokens from the Certified Token List.
 * @param mint
 * @returns
 */
export const useCertifiedTokens = (mints: (string | null | undefined)[]) => {
  const { network } = useSolana();
  return useQueries(
    mints.map((mint) => makeCertifiedTokenQuery(network, mint))
  );
};

/**
 * Loads a token from the Certified Token List.
 * @param mint
 * @returns
 */
export const useCertifiedToken = (mint: string | null | undefined) => {
  const { network } = useSolana();
  return useQuery(makeCertifiedTokenQuery(network, mint));
};

/**
 * Constructs a query to load a token from the Certified Token List, or from the blockchain if
 * it cannot be found.
 *
 * @returns Token query
 */
export const makeTokenQuery = ({
  network,
  address,
  fetchKeys,
}: {
  network: Network;
  address: PublicKey | null | undefined;
  fetchKeys: FetchKeysFn;
}): UseQueryOptions<Token | null | undefined> => ({
  queryKey: ["sail/tokenInfo", network, address],
  queryFn: async ({ signal }): Promise<Token | null | undefined> => {
    if (address === null || address === undefined) {
      return address;
    }
    const chainId = networkToChainId(network);
    const resp = await fetch(
      makeCertifiedTokenInfoURL(chainId, address.toString()),
      { signal }
    );
    if (resp.status !== 404) {
      const info = (await resp.json()) as TokenInfo;
      return new Token(info);
    }
    const [tokenData] = await fetchKeys([address]);
    if (!tokenData) {
      return null;
    }
    if (!tokenData.data) {
      return tokenData.data;
    }
    const raw = tokenData.data.accountInfo.data;
    const parsed = deserializeMint(raw);
    return Token.fromMint(address, parsed.decimals, {
      chainId: networkToChainId(network),
    });
  },
  // these should never be stale, since token mints are immutable (other than supply)
  staleTime: Infinity,
});

/**
 * Uses and loads a series of mints as {@link Token}s.
 * @param mints
 * @returns
 */
export const useTokens = (mints: (PublicKey | null | undefined)[]) => {
  const { network } = useSolana();
  const { fetchKeys } = useSail();
  const normalizedMints = useMemo(() => {
    return mints?.map(normalizeMint) ?? [];
  }, [mints]);
  return useQueries(
    normalizedMints?.map((mint) => {
      return makeTokenQuery({
        network,
        address: mint,
        fetchKeys,
      });
    })
  );
};

/**
 * Uses and loads a single token.
 *
 * @param mint
 * @returns
 */
export const useToken = (mintRaw?: PublicKey | string | null) => {
  const mint = usePubkey(mintRaw);
  const { network } = useSolana();
  const { fetchKeys } = useSail();
  const normalizedMint = useMemo(
    () => (mint ? normalizeMint(mint) : mint),
    [mint]
  );
  return useQuery(
    makeTokenQuery({
      network,
      address: normalizedMint,
      fetchKeys,
    })
  );
};

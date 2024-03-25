import type { Network } from "@saberhq/solana-contrib";
import { mapSome } from "@saberhq/solana-contrib";
import type { TokenInfo } from "@saberhq/token-utils";
import { deserializeMint, networkToChainId, Token } from "@saberhq/token-utils";
import { useSolana } from "@saberhq/use-solana";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import type { UseQueryOptions } from "react-query";
import { useQueries, useQuery } from "react-query";

import type { FetchKeysFn } from "..";
import { fetchNullableWithSessionCache } from "..";
import type { BatchedParsedAccountQueryKeys } from "../parsers";
import { useSail } from "../provider";
import { makeListMemoKey } from "../utils";
import { usePubkey } from "./usePubkey";

// const makeCertifiedTokenInfoURLCDN = (chainId: number, address: string) =>
//   `https://cdn.jsdelivr.net/gh/CLBExchange/certified-token-list/${chainId}/${address}.json`;

const makeCertifiedTokenInfoURL = (chainId: number, address: string) =>
  `https://raw.githubusercontent.com/CLBExchange/certified-token-list/master/${chainId}/${address}.json`;

const normalizeMint = (
  mint: PublicKey | null | undefined,
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
  address: string | null | undefined,
): UseQueryOptions<Token | null | undefined> => ({
  queryKey: ["sail/certifiedTokenInfo", network, address],
  queryFn: async ({ signal }): Promise<Token | null | undefined> => {
    if (address === null || address === undefined) {
      return address;
    }
    const chainId = networkToChainId(network);
    const info = await fetchNullableWithSessionCache<TokenInfo>(
      makeCertifiedTokenInfoURL(chainId, address),
      signal,
    );
    if (info === null) {
      return null;
    }
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
    mints.map((mint) => makeCertifiedTokenQuery(network, mint)),
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
export const makeBatchedTokensQuery = ({
  network,
  addresses,
  fetchKeys,
}: {
  network: Network;
  addresses: BatchedParsedAccountQueryKeys;
  fetchKeys: FetchKeysFn;
}): UseQueryOptions<
  readonly (Token | null | undefined)[] | null | undefined
> => ({
  queryKey: [
    "sail/batchedTokens",
    network,
    ...(mapSome(addresses, (a) => a.map((address) => address?.toString())) ?? [
      addresses,
    ]),
  ],
  queryFn: async ({
    signal,
  }): Promise<readonly (Token | null | undefined)[] | null | undefined> => {
    const addressesToFetch: {
      key: PublicKey;
      index: number;
    }[] = [];

    if (!addresses) {
      return addresses;
    }

    const data = await Promise.all(
      addresses.map(async (address, i) => {
        if (address === null || address === undefined) {
          return address;
        }
        const chainId = networkToChainId(network);
        const info = await fetchNullableWithSessionCache<TokenInfo>(
          makeCertifiedTokenInfoURL(chainId, address.toString()),
          signal,
        );
        if (info !== null) {
          return new Token(info);
        }
        addressesToFetch.push({ key: address, index: i });
      }),
    );

    if (signal?.aborted) {
      throw new Error("Query aborted");
    }

    const tokenDatas = await fetchKeys(addressesToFetch.map((a) => a.key));
    tokenDatas.forEach((tokenData, i) => {
      const index = addressesToFetch[i]?.index;
      if (index === undefined) {
        return;
      }
      if (!tokenData || !tokenData.data) {
        data[index] = null;
        return;
      }
      const raw = tokenData.data.accountInfo.data;
      const parsed = deserializeMint(raw);
      const token = Token.fromMint(tokenData.data.accountId, parsed.decimals, {
        chainId: networkToChainId(network),
      });
      data[index] = token;
    });

    return data;
  },
  // these should never be stale, since token mints are immutable (other than supply)
  staleTime: Infinity,
});

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
  queryKey: ["sail/tokenInfo", network, address?.toString()],
  queryFn: async ({ signal }): Promise<Token | null | undefined> => {
    if (address === null || address === undefined) {
      return address;
    }
    const chainId = networkToChainId(network);
    const info = await fetchNullableWithSessionCache<TokenInfo>(
      makeCertifiedTokenInfoURL(chainId, address.toString()),
      signal,
    );
    if (info !== null) {
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

const useNormalizedMints = (
  mints?: readonly (PublicKey | null | undefined)[] | null | undefined,
): (PublicKey | null | undefined)[] => {
  return useMemo(() => {
    return mints?.map(normalizeMint) ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeListMemoKey(mints)]);
};

/**
 * Uses and loads a series of mints as {@link Token}s.
 * @param mints
 * @returns
 */
export const useTokens = (mints?: (PublicKey | null | undefined)[]) => {
  const { network } = useSolana();
  const { fetchKeys } = useSail();
  const normalizedMints = useNormalizedMints(mints);
  return useQueries(
    normalizedMints.map((mint) => {
      return makeTokenQuery({
        network,
        address: mint,
        fetchKeys,
      });
    }),
  );
};

/**
 * Uses and loads a series of mints as {@link Token}s using a batched call.
 * @param mints
 * @returns
 */
export const useBatchedTokens = (mints: BatchedParsedAccountQueryKeys) => {
  const { network } = useSolana();
  const { fetchKeys } = useSail();
  const normalizedMints = useNormalizedMints(mints);
  return useQuery(
    makeBatchedTokensQuery({
      network,
      addresses: normalizedMints,
      fetchKeys,
    }),
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
  const normalizedMint = useMemo(() => mapSome(mint, normalizeMint), [mint]);
  return useQuery(
    makeTokenQuery({
      network,
      address: normalizedMint,
      fetchKeys,
    }),
  );
};

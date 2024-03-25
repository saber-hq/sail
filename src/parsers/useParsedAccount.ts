import type { ProgramAccount } from "@project-serum/anchor";
import type { Network } from "@saberhq/solana-contrib";
import { useSolana } from "@saberhq/use-solana";
import type { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo } from "react";
import type { UseQueryOptions, UseQueryResult } from "react-query";
import { useQueries, useQuery } from "react-query";

import type { FetchKeysFn } from "..";
import {
  fetchKeysMaybe,
  SailProgramAccountParseError,
  useAccountsSubscribe,
  useSail,
} from "..";
import { useAccountsData } from "../hooks/useAccountsData";
import type { ProgramAccountParser } from "./programAccounts";

/**
 * Result of a parsed account query.
 */
export type ParsedAccountQueryResult<T> = UseQueryResult<
  ProgramAccount<T> | null | undefined
>;

/**
 * Parses accounts with the given parser.
 *
 * *NOTE: the reference to the accounts array is not memoized.*
 *
 * @param keys
 * @param parser
 * @returns
 */
export const useParsedAccounts = <T>(
  keys: (PublicKey | null | undefined)[],
  parser: ProgramAccountParser<T>,
  options: Omit<
    UseQueryOptions<ProgramAccount<T> | null | undefined>,
    "queryFn" | "queryKey"
  > = {},
): ParsedAccountQueryResult<T>[] => {
  const { network } = useSolana();
  const data = useAccountsData(keys);
  return useQueries(
    keys.map(
      (key, i): UseQueryOptions<ProgramAccount<T> | null | undefined> => {
        const datum = data[i];
        return {
          queryKey: [
            "sail/parsedAccount",
            network,
            parser.programID.toString(),
            parser.name,
            key ? key.toString() : key,
          ],
          queryFn: () => {
            if (!datum) {
              return datum;
            }
            try {
              const parsed = parser.parse(datum.accountInfo.data);
              return { publicKey: datum.accountId, account: parsed };
            } catch (e) {
              throw new SailProgramAccountParseError(e, datum, parser);
            }
          },
          enabled: key !== undefined && datum !== undefined,
          ...options,
        };
      },
    ),
  );
};

/**
 * Makes the query to fetch a parsed account.
 * @param key
 * @param fetchKeys
 * @param parser
 * @param options
 * @returns
 */
export const makeParsedAccountQuery = <T>(
  key: PublicKey | null | undefined,
  network: Network,
  fetchKeys: FetchKeysFn,
  parser: ProgramAccountParser<T>,
  options: Omit<
    UseQueryOptions<ProgramAccount<T> | null | undefined>,
    "queryFn" | "queryKey"
  > = {},
): UseQueryOptions<ProgramAccount<T> | null | undefined> => ({
  queryKey: [
    "sail/parsedAccount",
    network,
    parser.programID.toString(),
    parser.name,
    key ? key.toString() : key,
  ],
  queryFn: async (): Promise<ProgramAccount<T> | null | undefined> => {
    const [result] = await fetchKeysMaybe(fetchKeys, [key]);
    if (!result) {
      return result;
    }
    const data = result.data;
    if (!data) {
      return null;
    }

    try {
      const parsed = parser.parse(data.accountInfo.data);
      return {
        publicKey: data.accountId,
        account: parsed,
      };
    } catch (e) {
      throw new SailProgramAccountParseError(e, data, parser);
    }
  },
  staleTime: Infinity,
  enabled: key !== undefined,
  ...options,
});

/**
 * Fetches and parses a single account with the given parser.
 *
 * @param keys
 * @param parser
 * @returns
 */
export const useParsedAccount = <T>(
  key: PublicKey | null | undefined,
  parser: ProgramAccountParser<T>,
  options: Omit<
    UseQueryOptions<ProgramAccount<T> | null | undefined>,
    "queryFn" | "queryKey"
  > = {},
): ParsedAccountQueryResult<T> => {
  const { fetchKeys, onBatchCache } = useSail();
  const { network } = useSolana();

  const query = useQuery(
    makeParsedAccountQuery(key, network, fetchKeys, parser, options),
  );

  useAccountsSubscribe(useMemo(() => [key], [key]));

  // refresh from the cache whenever the cache is updated
  const { refetch } = query;
  useEffect(() => {
    if (!key) {
      return;
    }
    return onBatchCache((e) => {
      if (e.hasKey(key)) {
        void refetch();
      }
    });
  }, [key, fetchKeys, onBatchCache, refetch]);

  return query;
};

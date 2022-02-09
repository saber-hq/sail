import type { ProgramAccount } from "@project-serum/anchor";
import type { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import type { UseQueryOptions, UseQueryResult } from "react-query";
import { useQueries } from "react-query";
import invariant from "tiny-invariant";

import { SailProgramAccountParseError } from "..";
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
    UseQueryOptions<
      ProgramAccount<T> | null | undefined,
      unknown,
      unknown,
      (string | undefined)[]
    >,
    "queryFn" | "queryKey"
  > = {}
): ParsedAccountQueryResult<T>[] => {
  const data = useAccountsData(keys);
  return useQueries(
    data.map((datum) => ({
      queryKey: [
        "parsedAccount",
        parser.programID.toString(),
        parser.name,
        datum?.accountId.toString(),
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
      notifyOnChangeProps: ["data" as const],
      ...options,
    }))
  );
};

/**
 * Loads the parsed data of a single account.
 * @returns
 */
export const useParsedAccount = <T>(
  key: PublicKey | null | undefined,
  parser: ProgramAccountParser<T>,
  options: Omit<
    UseQueryOptions<
      ProgramAccount<T> | null | undefined,
      unknown,
      unknown,
      (string | undefined)[]
    >,
    "queryFn" | "queryKey"
  > = {}
): ParsedAccountQueryResult<T> => {
  const theKey = useMemo(() => [key], [key]);
  const [data] = useParsedAccounts(theKey, parser, options);
  invariant(data);
  return data;
};

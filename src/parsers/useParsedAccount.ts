import type { ProgramAccount } from "@project-serum/anchor";
import type { PublicKey } from "@solana/web3.js";
import mapValues from "lodash.mapvalues";
import { useMemo } from "react";
import type { UseQueryResult } from "react-query";
import { useQueries } from "react-query";
import invariant from "tiny-invariant";

import { SailProgramAccountParseError } from "..";
import { useAccountsData } from "../useAccountsData";
import type {
  ProgramAccountParser,
  ProgramAccountParsers,
} from "./programAccounts";
import { makeProgramAccountParsers } from "./programAccounts";
import type { BatchParsedAccountQueryResult } from "./useBatchedParsedAccounts";
import { useBatchedParsedAccounts } from "./useBatchedParsedAccounts";

/**
 * Result of a parsed account query.
 */
export type ParsedAccountQueryResult<T> = UseQueryResult<
  ProgramAccount<T> | null | undefined
>;

/**
 * React hooks for program account parsers.
 */
export type ProgramParserHooks<T> = {
  /**
   * Uses the data of a single key.
   */
  useSingleData: (
    key: PublicKey | null | undefined
  ) => ParsedAccountQueryResult<T>;
  /**
   * Uses the data of multiple keys, batched into a single call.
   */
  useBatchedData: (
    keys: (PublicKey | null | undefined)[]
  ) => BatchParsedAccountQueryResult<T>;
  /**
   * Uses the data of multiple keys.
   */
  useData: (
    keys: (PublicKey | null | undefined)[]
  ) => ParsedAccountQueryResult<T>[];
};

/**
 * Makes hooks for parsers.
 * @param parsers
 * @returns
 */
export const makeProgramParserHooks = <M>(
  parsers: ProgramAccountParsers<M>
): {
  [K in keyof M]: ProgramParserHooks<M[K]>;
} => {
  const sailParsers: { [K in keyof M]: ProgramAccountParser<M[K]> } =
    makeProgramAccountParsers(parsers);
  return mapValues(
    sailParsers,
    <K extends keyof M>(
      parser: ProgramAccountParser<M[K]>
    ): ProgramParserHooks<M[K]> => ({
      useSingleData: (
        key: PublicKey | null | undefined
      ): ParsedAccountQueryResult<M[K]> => useParsedAccount(key, parser),
      useData: (
        keys: (PublicKey | null | undefined)[]
      ): ParsedAccountQueryResult<M[K]>[] => useParsedAccounts(keys, parser),
      useBatchedData: (
        keys: (PublicKey | null | undefined)[]
      ): BatchParsedAccountQueryResult<M[K]> =>
        useBatchedParsedAccounts(keys, parser),
    })
  ) as {
    [K in keyof M]: ProgramParserHooks<M[K]>;
  };
};

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
  parser: ProgramAccountParser<T>
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
    }))
  );
};

/**
 * Loads the parsed data of a single account.
 * @returns
 */
export const useParsedAccount = <T>(
  key: PublicKey | null | undefined,
  parser: ProgramAccountParser<T>
): ParsedAccountQueryResult<T> => {
  const theKey = useMemo(() => [key], [key]);
  const [data] = useParsedAccounts(theKey, parser);
  invariant(data);
  return data;
};

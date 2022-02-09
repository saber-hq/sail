import type { ProgramAccount } from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import mapValues from "lodash.mapvalues";
import type { UseQueryOptions } from "react-query";

import type {
  ProgramAccountParser,
  ProgramAccountParsers,
} from "./programAccounts";
import { makeProgramAccountParsers } from "./programAccounts";
import type { BatchParsedAccountQueryResult } from "./useBatchedParsedAccounts";
import { useBatchedParsedAccounts } from "./useBatchedParsedAccounts";
import type { ParsedAccountQueryResult } from "./useParsedAccount";
import { useParsedAccount, useParsedAccounts } from "./useParsedAccount";

/**
 * React hooks for program account parsers.
 */
export type ProgramParserHooks<T> = {
  /**
   * Uses the data of a single key.
   */
  useSingleData: (
    key: PublicKey | null | undefined,
    options?: Omit<
      UseQueryOptions<
        ProgramAccount<T> | null | undefined,
        unknown,
        unknown,
        (string | undefined)[]
      >,
      "queryFn" | "queryKey"
    >
  ) => ParsedAccountQueryResult<T>;
  /**
   * Uses the data of multiple keys.
   */
  useData: (
    keys: (PublicKey | null | undefined)[],
    options?: Omit<
      UseQueryOptions<
        ProgramAccount<T> | null | undefined,
        unknown,
        unknown,
        (string | undefined)[]
      >,
      "queryFn" | "queryKey"
    >
  ) => ParsedAccountQueryResult<T>[];
  /**
   * Uses the data of multiple keys, batched into a single call.
   */
  useBatchedData: (
    keys: (PublicKey | null | undefined)[],
    options?: Omit<
      UseQueryOptions<readonly (ProgramAccount<T> | null | undefined)[]>,
      "queryFn" | "queryKey"
    >
  ) => BatchParsedAccountQueryResult<T>;
};

/**
 * Makes hooks for parsers.
 * @param parsers
 * @returns
 */
export const makeProgramParserHooks = <M, A extends keyof M>(
  parsers: ProgramAccountParsers<M>
): {
  [K in A]: ProgramParserHooks<M[K]>;
} => {
  const sailParsers = makeProgramAccountParsers<M, A>(parsers);
  const hooks = mapValues(
    sailParsers,
    <T extends M[A]>(
      parser: ProgramAccountParser<T>
    ): ProgramParserHooks<T> => ({
      useSingleData: (
        key: PublicKey | null | undefined,
        options?: Omit<
          UseQueryOptions<
            ProgramAccount<T> | null | undefined,
            unknown,
            unknown,
            (string | undefined)[]
          >,
          "queryFn" | "queryKey"
        >
      ): ParsedAccountQueryResult<T> => useParsedAccount(key, parser, options),
      useData: (
        keys: (PublicKey | null | undefined)[],
        options?: Omit<
          UseQueryOptions<
            ProgramAccount<T> | null | undefined,
            unknown,
            unknown,
            (string | undefined)[]
          >,
          "queryFn" | "queryKey"
        >
      ): ParsedAccountQueryResult<T>[] =>
        useParsedAccounts<T>(keys, parser, options),
      useBatchedData: (
        keys: (PublicKey | null | undefined)[],
        options?: Omit<
          UseQueryOptions<readonly (ProgramAccount<T> | null | undefined)[]>,
          "queryFn" | "queryKey"
        >
      ): BatchParsedAccountQueryResult<T> =>
        useBatchedParsedAccounts<T>(keys, parser, options),
    })
  );
  return hooks as unknown as {
    [K in A]: ProgramParserHooks<M[K]>;
  };
};

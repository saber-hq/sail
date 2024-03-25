import type { AccountParsers } from "@saberhq/anchor-contrib";
import type { PublicKey } from "@solana/web3.js";
import mapValues from "lodash.mapvalues";

import type { ParsedAccountDatum } from "../types";

/**
 * A parser for program-owned accounts.
 */
export type ProgramAccountParser<T> = {
  /**
   * ID of the program.
   */
  programID: PublicKey;
  /**
   * Name of the account.
   */
  name: string;
  /**
   * Function which parses the account.
   */
  parse: (data: Buffer) => T;
};

export interface ProgramAccountParsers<M> {
  /**
   * Program address.
   */
  address: PublicKey;
  /**
   * Parsers.
   */
  accountParsers: AccountParsers<M>;
}

/**
 * Makes program account parsers.
 * @param parsers
 * @returns
 */
export const makeProgramAccountParsers = <M, A extends keyof M>({
  address,
  accountParsers,
}: ProgramAccountParsers<M>): {
  [K in A]: ProgramAccountParser<M[K]>;
} => {
  return mapValues(
    accountParsers,
    <T>(
      parser: (data: Buffer) => T,
      name: string,
    ): ProgramAccountParser<T> => ({
      name,
      programID: address,
      parse: parser,
    }),
  ) as unknown as {
    [K in keyof M]: ProgramAccountParser<M[K]>;
  };
};

export type ParserHooks<T> = {
  useSingleData: (key: PublicKey | null | undefined) => {
    loading: boolean;
    data: ParsedAccountDatum<T>;
  };
  useData: (keys: (PublicKey | null | undefined)[]) => ParsedAccountDatum<T>[];
};

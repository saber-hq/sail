import {
  deserializeAccount,
  deserializeMint,
  TOKEN_PROGRAM_ID,
} from "@saberhq/token-utils";

import { makeProgramParserHooks } from "./makeProgramParserHooks";

export const {
  Mint: {
    useSingleData: useTokenMint,
    useData: useTokenMints,
    useBatchedData: useBatchedTokenMints,
  },
  TokenAccount: {
    useSingleData: useTokenAccount,
    useData: useTokenAccounts,
    useBatchedData: useBatchedTokenAccounts,
  },
} = makeProgramParserHooks({
  address: TOKEN_PROGRAM_ID,
  accountParsers: {
    Mint: deserializeMint,
    TokenAccount: deserializeAccount,
  },
});

import {
  deserializeAccount,
  deserializeMint,
  TOKEN_PROGRAM_ID,
} from "@saberhq/token-utils";

import { makeProgramParserHooks } from "./useParsedAccount";

export const {
  Mint: { useSingleData: useTokenMint, useData: useTokenMints },
  TokenAccount: { useSingleData: useTokenAccount, useData: useTokenAccounts },
} = makeProgramParserHooks({
  address: TOKEN_PROGRAM_ID,
  accountParsers: {
    Mint: deserializeMint,
    TokenAccount: deserializeAccount,
  },
});

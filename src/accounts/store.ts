import produce, { Draft } from "immer";
import create, { SetState, State, StateCreator } from "zustand";

import type {
  AccountDatum,
  ParsedAccountDatum,
  SailAccountLoadError,
} from "..";

const immer =
  <T extends State>(config: StateCreator<T>): StateCreator<T> =>
  (set, get, api) =>
    config(
      (partial, replace) => {
        const nextState =
          typeof partial === "function"
            ? produce(partial as (state: Draft<T>) => T)
            : (partial as T);
        return set(nextState, replace);
      },
      get,
      api
    );
export interface AccountState {
  slotNumber: { [chainId: number]: number };
  accounts: {
    [accountId: string]: {
      data?: AccountDatum | null;
      error?: SailAccountLoadError;
      slotNumber?: number;
      fetchingSlotNumber?: number;
    };
  };
  listeningKeys: {
    [chainId: number]: {
      [accountId: string]: {
        slotsPerFetch?: number;
      };
    };
  };
  parseResults: {
    [accountId: string]: {
      data: ParsedAccountDatum<unknown>;
    };
  };
  set: SetState<AccountState>;
}

const initialState = {
  slotNumber: {},
  listeningKeys: {},
  accounts: {},
  parseResults: {},
};

export const createAccountStore = () =>
  create<AccountState>(
    immer((set, get) => ({
      ...initialState,
      set,
    }))
  );

export type AccountStore = ReturnType<typeof createAccountStore>;

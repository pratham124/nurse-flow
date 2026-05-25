import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

import type { LocalAppState } from "../types/models";

const emptyLocalState: LocalAppState = {
  floorTemplates: [],
};

interface LocalStateContextValue {
  localState: LocalAppState;
  setLocalState: Dispatch<SetStateAction<LocalAppState>>;
}

const LocalStateContext = createContext<LocalStateContextValue | undefined>(
  undefined,
);

export function LocalStateProvider({ children }: PropsWithChildren) {
  const [localState, setLocalState] =
    useState<LocalAppState>(emptyLocalState);

  const value = useMemo(
    () => ({ localState, setLocalState }),
    [localState, setLocalState],
  );

  return (
    <LocalStateContext.Provider value={value}>
      {children}
    </LocalStateContext.Provider>
  );
}

export function useLocalState() {
  const context = useContext(LocalStateContext);

  if (!context) {
    throw new Error("useLocalState must be used inside LocalStateProvider.");
  }

  return context;
}

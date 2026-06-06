import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

import { createDeviceLocalStorageAdapter } from "../services/localStorageAdapters";
import {
  createLocalStorageRepository,
  type LocalStorageRepository,
} from "../services/localStorageRepository";
import type { FloorTemplate, LocalAppState } from "../types/models";

const emptyLocalState: LocalAppState = {
  floorTemplates: [],
};

const localStorageRepository = createLocalStorageRepository(
  createDeviceLocalStorageAdapter(),
);

interface LocalStateContextValue {
  localState: LocalAppState;
  setLocalState: Dispatch<SetStateAction<LocalAppState>>;
  saveFloorTemplates: (floorTemplates: FloorTemplate[]) => Promise<void>;
}

const LocalStateContext = createContext<LocalStateContextValue | undefined>(
  undefined,
);

type LocalStateProviderProps = PropsWithChildren<{
  storageRepository?: LocalStorageRepository;
}>;

export function LocalStateProvider({
  children,
  storageRepository = localStorageRepository,
}: LocalStateProviderProps) {
  const [localState, setLocalState] =
    useState<LocalAppState>(emptyLocalState);
  const saveFloorTemplates = useCallback(
    async (floorTemplates: FloorTemplate[]) => {
      const savedState = await storageRepository.loadAppState();

      await storageRepository.saveAppState({
        ...savedState,
        floorTemplates,
      });
    },
    [storageRepository],
  );

  const value = useMemo(
    () => ({ localState, saveFloorTemplates, setLocalState }),
    [localState, saveFloorTemplates, setLocalState],
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

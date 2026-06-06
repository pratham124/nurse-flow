import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

import { createDeviceLocalStorageAdapter } from "../services/localStorageAdapters";
import {
  createStorageRepository,
  type StorageRepository,
} from "../services/storageRepository";
import type { FloorTemplate, LocalAppState } from "../types/models";

const emptyLocalState: LocalAppState = {
  floorTemplates: [],
};

const storageRepository = createStorageRepository(
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
  storageRepository?: StorageRepository;
}>;

export function LocalStateProvider({
  children,
  storageRepository: appStorageRepository = storageRepository,
}: LocalStateProviderProps) {
  const [localState, setLocalState] = useState<LocalAppState>(emptyLocalState);

  useEffect(() => {
    let shouldUpdateState = true;

    async function loadSavedFloorTemplates() {
      const savedState = await appStorageRepository.loadAppState();

      if (!shouldUpdateState) {
        return;
      }

      setLocalState((currentState) => ({
        ...currentState,
        floorTemplates: savedState.floorTemplates,
      }));
    }

    void loadSavedFloorTemplates();

    return () => {
      shouldUpdateState = false;
    };
  }, [appStorageRepository]);

  const saveFloorTemplates = useCallback(
    async (floorTemplates: FloorTemplate[]) => {
      const savedState = await appStorageRepository.loadAppState();

      await appStorageRepository.saveAppState({
        ...savedState,
        floorTemplates,
      });
    },
    [appStorageRepository],
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

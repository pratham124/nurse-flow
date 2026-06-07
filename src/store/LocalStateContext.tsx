import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import type {
  FloorTemplate,
  LocalAppState,
  PreviousShiftSnapshot,
  Shift,
} from "../types/models";

const emptyLocalState: LocalAppState = {
  floorTemplates: [],
  previousShiftSnapshots: [],
};

const storageRepository = createStorageRepository(
  createDeviceLocalStorageAdapter(),
);

interface LocalStateContextValue {
  localState: LocalAppState;
  setLocalState: Dispatch<SetStateAction<LocalAppState>>;
  saveFloorTemplates: (floorTemplates: FloorTemplate[]) => Promise<void>;
  savePreviousShiftSnapshot: (
    snapshot: PreviousShiftSnapshot,
  ) => Promise<void>;
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
  const hasSavedActiveShiftInSession = useRef(false);

  useEffect(() => {
    let shouldUpdateState = true;

    async function loadSavedLocalState() {
      const savedState = await appStorageRepository.loadAppState();

      if (!shouldUpdateState) {
        return;
      }

      setLocalState((currentState) => ({
        ...currentState,
        activeShift: savedState.activeShift,
        floorTemplates: savedState.floorTemplates,
        previousShiftSnapshots: savedState.previousShiftSnapshots,
      }));
    }

    void loadSavedLocalState();

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

  const saveActiveShift = useCallback(
    async (activeShift?: Shift) => {
      const savedState = await appStorageRepository.loadAppState();

      await appStorageRepository.saveAppState({
        ...savedState,
        activeShift,
      });
    },
    [appStorageRepository],
  );

  const savePreviousShiftSnapshot = useCallback(
    async (snapshot: PreviousShiftSnapshot) => {
      const savedState = await appStorageRepository.loadAppState();
      const nextSnapshots = savedState.previousShiftSnapshots.filter(
        (savedSnapshot) =>
          savedSnapshot.floorTemplateId !== snapshot.floorTemplateId,
      );
      const previousShiftSnapshots = [...nextSnapshots, snapshot];

      await appStorageRepository.saveAppState({
        ...savedState,
        previousShiftSnapshots,
      });

      setLocalState((currentState) => ({
        ...currentState,
        previousShiftSnapshots,
      }));
    },
    [appStorageRepository],
  );

  useEffect(() => {
    if (localState.activeShift) {
      hasSavedActiveShiftInSession.current = true;
      void saveActiveShift(localState.activeShift);
      return;
    }

    if (hasSavedActiveShiftInSession.current) {
      void saveActiveShift(undefined);
    }
  }, [localState.activeShift, saveActiveShift]);

  const value = useMemo(
    () => ({
      localState,
      saveFloorTemplates,
      savePreviousShiftSnapshot,
      setLocalState,
    }),
    [localState, saveFloorTemplates, savePreviousShiftSnapshot, setLocalState],
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

import type { PersistedLocalAppState } from "../types/models";

export const LOCAL_APP_STATE_STORAGE_KEY = "nurseflow.localAppState.v1";

export const CURRENT_LOCAL_STORAGE_VERSION = 1;

export const LOCAL_STORAGE_RECOVERY_MESSAGE =
  "Saved local data could not be loaded, so NurseFlow started with empty local state.";

export interface LocalStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface StorageRepository {
  loadAppState(): Promise<PersistedLocalAppState>;
  saveAppState(state: PersistedLocalAppState): Promise<void>;
  clearAppState(): Promise<void>;
}

export function createEmptyPersistedLocalAppState(): PersistedLocalAppState {
  return {
    storageVersion: CURRENT_LOCAL_STORAGE_VERSION,
    floorTemplates: [],
    previousShiftSnapshots: [],
  };
}

export function isPersistedLocalAppState(
  value: unknown,
): value is PersistedLocalAppState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeState = value as Partial<PersistedLocalAppState>;

  return (
    maybeState.storageVersion === CURRENT_LOCAL_STORAGE_VERSION &&
    Array.isArray(maybeState.floorTemplates) &&
    Array.isArray(maybeState.previousShiftSnapshots) &&
    (!("activeShift" in maybeState) ||
      maybeState.activeShift === undefined ||
      (typeof maybeState.activeShift === "object" &&
        maybeState.activeShift !== null))
  );
}

export function parsePersistedLocalAppState(
  storedState: string,
): PersistedLocalAppState {
  try {
    const parsedState = JSON.parse(storedState) as unknown;

    if (isPersistedLocalAppState(parsedState)) {
      return parsedState;
    }
  } catch {
    return createEmptyPersistedLocalAppState();
  }

  return createEmptyPersistedLocalAppState();
}

export function createStorageRepository(
  storage: LocalStorageAdapter,
): StorageRepository {
  return {
    async loadAppState() {
      let storedState: string | null;

      try {
        storedState = await storage.getItem(LOCAL_APP_STATE_STORAGE_KEY);
      } catch {
        return createEmptyPersistedLocalAppState();
      }

      if (!storedState) {
        return createEmptyPersistedLocalAppState();
      }

      return parsePersistedLocalAppState(storedState);
    },

    async saveAppState(state) {
      await storage.setItem(LOCAL_APP_STATE_STORAGE_KEY, JSON.stringify(state));
    },

    async clearAppState() {
      await storage.removeItem(LOCAL_APP_STATE_STORAGE_KEY);
    },
  };
}

export function createMemoryStorageAdapter(
  initialValues: Record<string, string> = {},
): LocalStorageAdapter {
  const values = new Map(Object.entries(initialValues));

  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },

    async setItem(key, value) {
      values.set(key, value);
    },

    async removeItem(key) {
      values.delete(key);
    },
  };
}

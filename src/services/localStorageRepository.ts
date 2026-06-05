import type { PersistedLocalAppState } from "../types/models";

export const LOCAL_APP_STATE_STORAGE_KEY = "nurseflow.localAppState.v1";

export const CURRENT_LOCAL_STORAGE_VERSION = 1;

export interface LocalStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface LocalStorageRepository {
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

export function createLocalStorageRepository(
  storage: LocalStorageAdapter,
): LocalStorageRepository {
  return {
    async loadAppState() {
      const storedState = await storage.getItem(LOCAL_APP_STATE_STORAGE_KEY);

      if (!storedState) {
        return createEmptyPersistedLocalAppState();
      }

      return JSON.parse(storedState) as PersistedLocalAppState;
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

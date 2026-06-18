import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  getLocalStateFromServerWorkspace,
  loadServerWorkspace,
  saveServerFloorTemplate,
} from "../services/serverWorkspaceRepository";
import { getSupabaseClient } from "../services/supabaseClient";
import { useAuthSession } from "./AuthSessionContext";
import { useLocalState } from "./LocalStateContext";
import type {
  FloorTemplate,
  FloorTemplateRecord,
  ServerSaveStatus,
  ServerWorkspace,
} from "../types/models";

type ServerWorkspaceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty"; workspace: ServerWorkspace }
  | { status: "ready"; workspace: ServerWorkspace }
  | { errorMessage: string; status: "error" };

type ServerWorkspaceContextValue = {
  retryLoadWorkspace: () => Promise<void>;
  saveErrorMessage: string;
  saveFloorTemplate: (
    floorTemplate: FloorTemplate,
  ) => Promise<FloorTemplateRecord>;
  saveStatus: ServerSaveStatus;
  workspaceState: ServerWorkspaceState;
};

type ServerWorkspaceProviderProps = PropsWithChildren;

const ServerWorkspaceContext =
  createContext<ServerWorkspaceContextValue | undefined>(undefined);

function getWorkspaceState(workspace: ServerWorkspace): ServerWorkspaceState {
  const isEmpty =
    workspace.floorTemplates.length === 0 &&
    !workspace.activeShift &&
    workspace.previousShiftSnapshots.length === 0;

  return {
    status: isEmpty ? "empty" : "ready",
    workspace,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function ServerWorkspaceProvider({
  children,
}: ServerWorkspaceProviderProps) {
  const { authState } = useAuthSession();
  const { setLocalState } = useLocalState();
  const [workspaceState, setWorkspaceState] = useState<ServerWorkspaceState>({
    status: "idle",
  });
  const [saveStatus, setSaveStatus] = useState<ServerSaveStatus>("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");

  const loadWorkspace = useCallback(async () => {
    if (
      authState.status !== "signed_in" ||
      authState.profile.role !== "charge_nurse"
    ) {
      setWorkspaceState({ status: "idle" });
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setWorkspaceState({
        errorMessage: "Supabase is not configured yet.",
        status: "error",
      });
      return;
    }

    setWorkspaceState({ status: "loading" });

    try {
      const workspace = await loadServerWorkspace(supabase, authState.profile);
      const serverLocalState = getLocalStateFromServerWorkspace(workspace);

      setLocalState((currentState) => ({
        ...currentState,
        ...serverLocalState,
      }));
      setWorkspaceState(getWorkspaceState(workspace));
    } catch (error) {
      setWorkspaceState({
        errorMessage: getErrorMessage(error, "Workspace could not be loaded."),
        status: "error",
      });
    }
  }, [authState, setLocalState]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const saveFloorTemplate = useCallback(
    async (floorTemplate: FloorTemplate) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as a charge nurse to save floor templates.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        const savedTemplate = await saveServerFloorTemplate(
          supabase,
          authState.profile,
          floorTemplate,
        );
        const workspace = await loadServerWorkspace(supabase, authState.profile);
        const serverLocalState = getLocalStateFromServerWorkspace(workspace);

        setLocalState((currentState) => ({
          ...currentState,
          ...serverLocalState,
        }));
        setWorkspaceState(getWorkspaceState(workspace));
        setSaveStatus("saved");

        return savedTemplate;
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Template could not be saved to the server."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [authState, setLocalState],
  );

  const value = useMemo(
    () => ({
      retryLoadWorkspace: loadWorkspace,
      saveErrorMessage,
      saveFloorTemplate,
      saveStatus,
      workspaceState,
    }),
    [
      loadWorkspace,
      saveErrorMessage,
      saveFloorTemplate,
      saveStatus,
      workspaceState,
    ],
  );

  return (
    <ServerWorkspaceContext.Provider value={value}>
      {children}
    </ServerWorkspaceContext.Provider>
  );
}

export function useServerWorkspace() {
  const context = useContext(ServerWorkspaceContext);

  if (!context) {
    throw new Error(
      "useServerWorkspace must be used inside ServerWorkspaceProvider.",
    );
  }

  return context;
}

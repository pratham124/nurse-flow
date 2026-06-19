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
  createServerActiveShift,
  endServerActiveShift,
  getLocalStateFromServerWorkspace,
  loadServerWorkspace,
  saveServerActiveShift,
  saveServerFloorTemplate,
  saveServerPreviousShiftSnapshot,
} from "../services/serverWorkspaceRepository";
import { getSupabaseClient } from "../services/supabaseClient";
import { useAuthSession } from "./AuthSessionContext";
import { useLocalState } from "./LocalStateContext";
import type {
  FloorTemplate,
  FloorTemplateRecord,
  PreviousShiftSnapshot,
  ServerSaveStatus,
  ServerWorkspace,
  Shift,
} from "../types/models";

type ServerWorkspaceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty"; workspace: ServerWorkspace }
  | { status: "ready"; workspace: ServerWorkspace }
  | { errorMessage: string; status: "error" };

type ServerWorkspaceContextValue = {
  endActiveShift: (activeShift: Shift) => Promise<void>;
  retryLoadWorkspace: () => Promise<void>;
  saveActiveShift: (activeShift: Shift) => Promise<Shift>;
  saveErrorMessage: string;
  saveFloorTemplate: (
    floorTemplate: FloorTemplate,
  ) => Promise<FloorTemplateRecord>;
  savePreviousShiftSnapshot: (
    snapshot: PreviousShiftSnapshot,
  ) => Promise<void>;
  saveStatus: ServerSaveStatus;
  startActiveShift: (activeShift: Shift) => Promise<Shift>;
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
  const { hasLoadedLocalState, setLocalState } = useLocalState();
  const [workspaceState, setWorkspaceState] = useState<ServerWorkspaceState>({
    status: "idle",
  });
  const [saveStatus, setSaveStatus] = useState<ServerSaveStatus>("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");

  const applyWorkspace = useCallback(
    (workspace: ServerWorkspace) => {
      const serverLocalState = getLocalStateFromServerWorkspace(workspace);

      setLocalState((currentState) => ({
        ...currentState,
        ...serverLocalState,
      }));
      setWorkspaceState(getWorkspaceState(workspace));
    },
    [setLocalState],
  );

  const loadWorkspace = useCallback(async () => {
    if (
      authState.status !== "signed_in" ||
      authState.profile.role !== "charge_nurse"
    ) {
      setWorkspaceState({ status: "idle" });
      return;
    }

    if (!hasLoadedLocalState) {
      setWorkspaceState({ status: "loading" });
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

      applyWorkspace(workspace);
    } catch (error) {
      setWorkspaceState({
        errorMessage: getErrorMessage(error, "Workspace could not be loaded."),
        status: "error",
      });
    }
  }, [applyWorkspace, authState, hasLoadedLocalState]);

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

        applyWorkspace(workspace);
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
    [applyWorkspace, authState],
  );

  const startActiveShift = useCallback(
    async (activeShift: Shift) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as a charge nurse to start a server shift.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        const savedActiveShift = await createServerActiveShift(
          supabase,
          authState.profile,
          activeShift,
        );
        const workspace = await loadServerWorkspace(supabase, authState.profile);

        applyWorkspace(workspace);
        setSaveStatus("saved");

        return savedActiveShift.shiftSnapshot;
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Shift could not be started on the server."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [applyWorkspace, authState],
  );

  const saveActiveShift = useCallback(
    async (activeShift: Shift) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as a charge nurse to save this shift.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        const savedActiveShift = await saveServerActiveShift(
          supabase,
          authState.profile,
          activeShift,
        );
        const workspace = await loadServerWorkspace(supabase, authState.profile);

        applyWorkspace(workspace);
        setSaveStatus("saved");

        return savedActiveShift.shiftSnapshot;
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Shift changes could not be saved."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [applyWorkspace, authState],
  );

  const endActiveShift = useCallback(
    async (activeShift: Shift) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as a charge nurse to end this shift.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        await endServerActiveShift(supabase, authState.profile, activeShift);
        const workspace = await loadServerWorkspace(supabase, authState.profile);

        applyWorkspace(workspace);
        setSaveStatus("saved");
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Shift could not be ended on the server."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [applyWorkspace, authState],
  );

  const savePreviousShiftSnapshot = useCallback(
    async (snapshot: PreviousShiftSnapshot) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as a charge nurse to save carry-over.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        await saveServerPreviousShiftSnapshot(
          supabase,
          authState.profile,
          snapshot,
        );
        const workspace = await loadServerWorkspace(supabase, authState.profile);

        applyWorkspace(workspace);
        setSaveStatus("saved");
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Carry-over could not be saved to the server."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [applyWorkspace, authState],
  );

  const value = useMemo(
    () => ({
      endActiveShift,
      retryLoadWorkspace: loadWorkspace,
      saveActiveShift,
      saveErrorMessage,
      saveFloorTemplate,
      savePreviousShiftSnapshot,
      saveStatus,
      startActiveShift,
      workspaceState,
    }),
    [
      endActiveShift,
      loadWorkspace,
      saveActiveShift,
      saveErrorMessage,
      saveFloorTemplate,
      savePreviousShiftSnapshot,
      saveStatus,
      startActiveShift,
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

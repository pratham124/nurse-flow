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
  deleteServerFloorTemplate,
  endServerActiveShift,
  loadJoinedNurseAssignmentView,
  loadServerWorkspace,
  saveServerActiveShift,
  saveServerFloorTemplate,
  saveServerPreviousShiftSnapshot,
} from "../services/serverWorkspaceRepository";
import { getSupabaseClient } from "../services/supabaseClient";
import { useAuthSession } from "./AuthSessionContext";
import type {
  FloorTemplate,
  FloorTemplateRecord,
  JoinedNurseAssignmentView,
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

type JoinedNurseAccessState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; assignmentView: JoinedNurseAssignmentView }
  | { errorMessage: string; status: "error" };

type ActiveParticipation =
  | { type: "none" }
  | { shiftId: string; type: "charge_shift" }
  | { nurseId: string; shiftId: string; type: "joined_nurse" };

type ServerWorkspaceContextValue = {
  activeParticipation: ActiveParticipation;
  activeShift?: Shift;
  deleteFloorTemplate: (floorTemplateId: string) => Promise<void>;
  endActiveShift: (activeShift: Shift) => Promise<void>;
  floorTemplates: FloorTemplate[];
  joinedNurseAccessState: JoinedNurseAccessState;
  previousShiftSnapshots: PreviousShiftSnapshot[];
  retryLoadJoinedNurseAccess: () => Promise<void>;
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

function getActiveParticipation(
  workspaceState: ServerWorkspaceState,
  joinedNurseAccessState: JoinedNurseAccessState,
): ActiveParticipation {
  if (
    (workspaceState.status === "ready" || workspaceState.status === "empty") &&
    workspaceState.workspace.activeShift
  ) {
    return {
      shiftId: workspaceState.workspace.activeShift.id,
      type: "charge_shift",
    };
  }

  if (joinedNurseAccessState.status === "ready") {
    return {
      nurseId: joinedNurseAccessState.assignmentView.access.nurseId,
      shiftId: joinedNurseAccessState.assignmentView.shiftId,
      type: "joined_nurse",
    };
  }

  return { type: "none" };
}

function hasActiveChargeShift(workspaceState: ServerWorkspaceState) {
  return (
    (workspaceState.status === "ready" || workspaceState.status === "empty") &&
    Boolean(workspaceState.workspace.activeShift)
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getWorkspaceSnapshots(workspaceState: ServerWorkspaceState) {
  if (workspaceState.status !== "ready" && workspaceState.status !== "empty") {
    return {
      activeShift: undefined,
      floorTemplates: [],
      previousShiftSnapshots: [],
    };
  }

  return {
    activeShift: workspaceState.workspace.activeShift?.shiftSnapshot,
    floorTemplates: workspaceState.workspace.floorTemplates.map(
      (record) => record.templateSnapshot,
    ),
    previousShiftSnapshots:
      workspaceState.workspace.previousShiftSnapshots.map((snapshot) => ({
        completedAt: snapshot.completedAt,
        floorTemplateId: snapshot.floorTemplateId,
        id: snapshot.id,
        nurseSuggestions: snapshot.nurseSuggestions,
        patientSuggestions: snapshot.patientSuggestions,
      })),
  };
}

export function ServerWorkspaceProvider({
  children,
}: ServerWorkspaceProviderProps) {
  const { authState } = useAuthSession();
  const [workspaceState, setWorkspaceState] = useState<ServerWorkspaceState>({
    status: "idle",
  });
  const [joinedNurseAccessState, setJoinedNurseAccessState] =
    useState<JoinedNurseAccessState>({
      status: "idle",
    });
  const [saveStatus, setSaveStatus] = useState<ServerSaveStatus>("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");

  const applyWorkspace = useCallback(
    (workspace: ServerWorkspace) => {
      setWorkspaceState(getWorkspaceState(workspace));
    },
    [],
  );

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

      applyWorkspace(workspace);
    } catch (error) {
      setWorkspaceState({
        errorMessage: getErrorMessage(error, "Workspace could not be loaded."),
        status: "error",
      });
    }
  }, [applyWorkspace, authState]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const loadJoinedNurseAccess = useCallback(async () => {
    if (authState.status !== "signed_in") {
      setJoinedNurseAccessState({ status: "idle" });
      return;
    }

    if (hasActiveChargeShift(workspaceState)) {
      setJoinedNurseAccessState({
        errorMessage:
          "End your active charge shift before joining another shift as a nurse.",
        status: "error",
      });
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setJoinedNurseAccessState({
        errorMessage: "Supabase is not configured yet.",
        status: "error",
      });
      return;
    }

    setJoinedNurseAccessState({ status: "loading" });

    try {
      const assignmentView = await loadJoinedNurseAssignmentView(
        supabase,
        authState.profile,
      );

      setJoinedNurseAccessState(
        assignmentView
          ? { assignmentView, status: "ready" }
          : { status: "empty" },
      );
    } catch (error) {
      setJoinedNurseAccessState({
        errorMessage: getErrorMessage(
          error,
          "Joined nurse access could not be loaded.",
        ),
        status: "error",
      });
    }
  }, [authState, workspaceState]);

  useEffect(() => {
    void loadJoinedNurseAccess();
  }, [loadJoinedNurseAccess]);

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

      if (joinedNurseAccessState.status === "ready") {
        throw new Error(
          "Leave your joined nurse shift before starting a charge shift.",
        );
      }

      if (joinedNurseAccessState.status === "loading") {
        throw new Error(
          "Nurse shift access is still loading. Try starting the shift again in a moment.",
        );
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
    [applyWorkspace, authState, joinedNurseAccessState.status],
  );

  const deleteFloorTemplate = useCallback(
    async (floorTemplateId: string) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as a charge nurse to delete floor templates.");
      }

      if (hasActiveChargeShift(workspaceState)) {
        throw new Error("End the active shift before deleting templates.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        await deleteServerFloorTemplate(
          supabase,
          authState.profile,
          floorTemplateId,
        );
        const workspace = await loadServerWorkspace(supabase, authState.profile);

        applyWorkspace(workspace);
        setSaveStatus("saved");
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Template could not be deleted."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [applyWorkspace, authState, workspaceState],
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
      activeParticipation: getActiveParticipation(
        workspaceState,
        joinedNurseAccessState,
      ),
      ...getWorkspaceSnapshots(workspaceState),
      deleteFloorTemplate,
      endActiveShift,
      joinedNurseAccessState,
      retryLoadJoinedNurseAccess: loadJoinedNurseAccess,
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
      deleteFloorTemplate,
      endActiveShift,
      joinedNurseAccessState,
      loadJoinedNurseAccess,
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

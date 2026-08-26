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
  requestAssignmentOptimization as requestAssignmentOptimizationFromService,
  type AssignmentOptimizerResult,
} from "../services/optimizerRepository";
import {
  confirmManualAssignmentOverride as confirmManualAssignmentOverrideOnServer,
  createServerActiveShift,
  deleteServerFloorTemplate,
  endServerActiveShift,
  loadJoinedNurseAssignmentView,
  loadServerActiveShift,
  loadServerWorkspace,
  resolveShiftNurseSwapRequest as resolveShiftNurseSwapRequestOnServer,
  resetServerActiveShiftForEditing,
  saveServerActiveShift,
  saveServerFloorTemplate,
  saveServerPreviousShiftSnapshot,
  submitJoinedNurseIssueRequest as submitJoinedNurseIssueRequestToServer,
  submitJoinedNurseSwapRequest as submitJoinedNurseSwapRequestToServer,
  updateShiftNurseIssueStatus as updateShiftNurseIssueStatusOnServer,
  type ConfirmManualAssignmentOverrideInput,
  type ConfirmManualAssignmentOverrideResult,
} from "../services/serverWorkspaceRepository";
import {
  subscribeToChargeActiveShift,
  subscribeToJoinedNurseAssignmentView,
} from "../services/realtimeWorkspaceRepository";
import { getSupabaseClient } from "../services/supabaseClient";
import { useAuthSession } from "./AuthSessionContext";
import { generateAssignmentFlags } from "../utils/assignmentFlags";
import { getEffectiveAssignmentResult } from "../utils/effectiveAssignment";
import type {
  ActiveAssignmentOverridesByBedId,
  AssignmentResult,
  Flag,
  FloorTemplate,
  FloorTemplateRecord,
  JoinedNurseAssignmentView,
  NurseIssueReviewStatus,
  NurseRequestStatus,
  PreviousShiftSnapshot,
  RealtimeConnectionState,
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
  | { status: "shift_ended" }
  | { status: "access_removed" }
  | { errorMessage: string; status: "error" };

type JoinedNurseAccessRefreshReason =
  | "manual"
  | "shift_changed"
  | "access_changed";

type ActiveParticipation =
  | { type: "none" }
  | { shiftId: string; type: "charge_shift" }
  | { nurseId: string; shiftId: string; type: "joined_nurse" };

type ServerWorkspaceContextValue = {
  activeAssignmentOverridesByBedId: ActiveAssignmentOverridesByBedId;
  activeParticipation: ActiveParticipation;
  activeShift?: Shift;
  confirmManualAssignmentOverride: (
    input: ConfirmManualAssignmentOverrideInput,
  ) => Promise<ConfirmManualAssignmentOverrideResult>;
  deleteFloorTemplate: (floorTemplateId: string) => Promise<void>;
  endActiveShift: (activeShift: Shift) => Promise<void>;
  effectiveAssignmentFlags: Flag[];
  effectiveAssignmentResult?: AssignmentResult;
  floorTemplates: FloorTemplate[];
  joinedNurseAccessState: JoinedNurseAccessState;
  joinedNurseRealtimeConnectionState: RealtimeConnectionState;
  previousShiftSnapshots: PreviousShiftSnapshot[];
  realtimeConnectionState: RealtimeConnectionState;
  runAssignmentOptimizer: (input: {
    clientMutationId: string;
    expectedBaselineAssignmentResultId?: string;
  }) => Promise<AssignmentOptimizerResult>;
  retryLoadJoinedNurseAccess: () => Promise<void>;
  retryLoadWorkspace: () => Promise<void>;
  resolveNurseSwapRequest: (
    requestId: string,
    nextStatus: Extract<NurseRequestStatus, "accepted" | "declined">,
  ) => Promise<void>;
  resetActiveShiftForEditing: (
    expectedBaselineAssignmentResultId: string,
  ) => Promise<Shift>;
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
  submitJoinedNurseIssueRequest: (message: string) => Promise<void>;
  submitJoinedNurseSwapRequest: (
    sourceBedId: string,
    message: string,
  ) => Promise<void>;
  updateNurseIssueStatus: (
    requestId: string,
    nextStatus: NurseIssueReviewStatus,
  ) => Promise<void>;
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
      activeAssignmentOverridesByBedId: {},
      activeShift: undefined,
      effectiveAssignmentFlags: [],
      effectiveAssignmentResult: undefined,
      floorTemplates: [],
      previousShiftSnapshots: [],
    };
  }

  const activeShiftRecord = workspaceState.workspace.activeShift;
  const activeShift = activeShiftRecord?.shiftSnapshot;
  const activeAssignmentOverridesByBedId =
    activeShiftRecord?.activeAssignmentOverridesByBedId ?? {};
  const effectiveAssignmentResult = activeShift?.assignmentResult
    ? getEffectiveAssignmentResult(
        activeShift.assignmentResult,
        activeAssignmentOverridesByBedId,
      )
    : undefined;

  return {
    activeAssignmentOverridesByBedId,
    activeShift,
    effectiveAssignmentFlags:
      activeShift && effectiveAssignmentResult
        ? generateAssignmentFlags(activeShift, effectiveAssignmentResult)
        : (activeShift?.flags ?? []),
    effectiveAssignmentResult,
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
  const [realtimeConnectionState, setRealtimeConnectionState] =
    useState<RealtimeConnectionState>("disconnected");
  const [
    joinedNurseRealtimeConnectionState,
    setJoinedNurseRealtimeConnectionState,
  ] = useState<RealtimeConnectionState>("disconnected");

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

  const activeShiftId =
    workspaceState.status === "ready" || workspaceState.status === "empty"
      ? workspaceState.workspace.activeShift?.id
      : undefined;
  const chargeProfileId =
    authState.status === "signed_in" &&
    authState.profile.role === "charge_nurse"
      ? authState.profile.id
      : undefined;

  useEffect(() => {
    if (!chargeProfileId || !activeShiftId) {
      setRealtimeConnectionState("disconnected");
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setRealtimeConnectionState("error");
      console.error("[Realtime] Supabase is not configured.");
      return;
    }

    const activeSupabase = supabase;
    const subscribedActiveShiftId = activeShiftId;
    const subscribedChargeProfileId = chargeProfileId;
    let isCurrentSubscription = true;

    async function refreshActiveShiftFromServer() {
      console.info(
        `[Realtime] Active shift ${subscribedActiveShiftId} changed; refreshing server state.`,
      );

      try {
        const activeShift = await loadServerActiveShift(activeSupabase, {
          id: subscribedChargeProfileId,
          role: "charge_nurse",
        });

        if (!isCurrentSubscription) {
          return;
        }

        setWorkspaceState((currentState) => {
          if (
            currentState.status !== "ready" &&
            currentState.status !== "empty"
          ) {
            return currentState;
          }

          return getWorkspaceState({
            ...currentState.workspace,
            activeShift,
          });
        });
      } catch (error: unknown) {
        if (!isCurrentSubscription) {
          return;
        }

        setRealtimeConnectionState("error");
        console.error("[Realtime] Active shift refresh failed.", error);
      }
    }

    setRealtimeConnectionState("connecting");
    console.info(
      `[Realtime] Starting charge active shift listener for ${subscribedActiveShiftId}.`,
    );

    const stopSubscription = subscribeToChargeActiveShift({
      activeShiftId: subscribedActiveShiftId,
      onConnectionStateChange: (connectionState, error) => {
        setRealtimeConnectionState(connectionState);

        if (error) {
          console.error(
            `[Realtime] Charge active shift listener ${connectionState}.`,
            error,
          );
          return;
        }

        console.info(
          `[Realtime] Charge active shift listener ${connectionState}.`,
        );
      },
      onShiftChanged: () => {
        void refreshActiveShiftFromServer();
      },
      supabase: activeSupabase,
    });

    return () => {
      isCurrentSubscription = false;
      console.info(
        `[Realtime] Stopping charge active shift listener for ${subscribedActiveShiftId}.`,
      );
      stopSubscription();
      setRealtimeConnectionState("disconnected");
    };
  }, [activeShiftId, chargeProfileId]);

  const loadJoinedNurseAccess = useCallback(
    async (reason: JoinedNurseAccessRefreshReason = "manual") => {
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

        if (assignmentView) {
          setJoinedNurseAccessState({ assignmentView, status: "ready" });
          return;
        }

        if (reason === "shift_changed") {
          setJoinedNurseAccessState({ status: "shift_ended" });
          return;
        }

        if (reason === "access_changed") {
          setJoinedNurseAccessState({ status: "access_removed" });
          return;
        }

        setJoinedNurseAccessState({ status: "empty" });
      } catch (error) {
        if (reason === "access_changed") {
          setJoinedNurseAccessState({ status: "access_removed" });
          return;
        }

        setJoinedNurseAccessState({
          errorMessage: getErrorMessage(
            error,
            "Joined nurse access could not be loaded.",
          ),
          status: "error",
        });
      }
    },
    [authState, workspaceState],
  );

  useEffect(() => {
    void loadJoinedNurseAccess();
  }, [loadJoinedNurseAccess]);

  const joinedNurseProfileId =
    authState.status === "signed_in" ? authState.profile.id : undefined;
  const joinedNurseAccessId =
    joinedNurseAccessState.status === "ready"
      ? joinedNurseAccessState.assignmentView.access.id
      : undefined;
  const joinedNurseShiftId =
    joinedNurseAccessState.status === "ready"
      ? joinedNurseAccessState.assignmentView.shiftId
      : undefined;

  useEffect(() => {
    if (!joinedNurseProfileId || !joinedNurseAccessId || !joinedNurseShiftId) {
      setJoinedNurseRealtimeConnectionState("disconnected");
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setJoinedNurseRealtimeConnectionState("error");
      console.error("[Realtime] Supabase is not configured.");
      return;
    }

    const subscribedAccessId = joinedNurseAccessId;
    const subscribedShiftId = joinedNurseShiftId;
    let isCurrentSubscription = true;

    async function refreshJoinedNurseAccess(
      reason: JoinedNurseAccessRefreshReason,
    ) {
      console.info(
        `[Realtime] Joined nurse view for shift ${subscribedShiftId} changed; refreshing nurse-scoped view.`,
      );

      if (isCurrentSubscription) {
        await loadJoinedNurseAccess(reason);
      }
    }

    setJoinedNurseRealtimeConnectionState("connecting");
    console.info(
      `[Realtime] Starting joined nurse listener for shift ${subscribedShiftId}.`,
    );

    const stopSubscription = subscribeToJoinedNurseAssignmentView({
      accessId: subscribedAccessId,
      onConnectionStateChange: (connectionState, error) => {
        setJoinedNurseRealtimeConnectionState(connectionState);

        if (error) {
          console.error(
            `[Realtime] Joined nurse listener ${connectionState}.`,
            error,
          );
          return;
        }

        console.info(`[Realtime] Joined nurse listener ${connectionState}.`);
      },
      onNurseAccessChanged: () => {
        void refreshJoinedNurseAccess("access_changed");
      },
      onShiftChanged: () => {
        void refreshJoinedNurseAccess("shift_changed");
      },
      shiftId: subscribedShiftId,
      supabase,
    });

    return () => {
      isCurrentSubscription = false;
      console.info(
        `[Realtime] Stopping joined nurse listener for shift ${subscribedShiftId}.`,
      );
      stopSubscription();
      setJoinedNurseRealtimeConnectionState("disconnected");
    };
  }, [
    joinedNurseAccessId,
    joinedNurseProfileId,
    joinedNurseShiftId,
    loadJoinedNurseAccess,
  ]);

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

  const resetActiveShiftForEditing = useCallback(
    async (expectedBaselineAssignmentResultId: string) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as a charge nurse to edit this shift.");
      }

      if (
        workspaceState.status !== "ready" &&
        workspaceState.status !== "empty"
      ) {
        throw new Error("The active shift is still loading. Try again.");
      }

      const activeShiftRecord = workspaceState.workspace.activeShift;

      if (!activeShiftRecord) {
        throw new Error("This active shift is no longer available.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        const result = await resetServerActiveShiftForEditing(
          supabase,
          authState.profile,
          activeShiftRecord.id,
          expectedBaselineAssignmentResultId,
        );
        const workspace = await loadServerWorkspace(supabase, authState.profile);

        applyWorkspace(workspace);

        if (result.status === "stale") {
          setSaveStatus("error");
          throw new Error(result.message);
        }

        setSaveStatus("saved");
        return result.shiftSnapshot;
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(
            error,
            "The active shift could not be opened for editing.",
          ),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [applyWorkspace, authState, workspaceState],
  );

  const confirmManualAssignmentOverride = useCallback(
    async (input: ConfirmManualAssignmentOverrideInput) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as a charge nurse to adjust assignments.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        const result = await confirmManualAssignmentOverrideOnServer(
          supabase,
          input,
        );
        const workspace = await loadServerWorkspace(supabase, authState.profile);

        applyWorkspace(workspace);
        setSaveStatus(result.status === "saved" ? "saved" : "idle");

        return result;
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Assignment move could not be saved."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [applyWorkspace, authState],
  );

  const runAssignmentOptimizer = useCallback(
    async (input: {
      clientMutationId: string;
      expectedBaselineAssignmentResultId?: string;
    }) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as a charge nurse to run assignment.");
      }

      if (
        workspaceState.status !== "ready" &&
        workspaceState.status !== "empty"
      ) {
        throw new Error("Load the server workspace before running assignment.");
      }

      const activeShiftRecord = workspaceState.workspace.activeShift;

      if (!activeShiftRecord) {
        throw new Error("Start a shift before running assignment.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        const result = await requestAssignmentOptimizationFromService(
          supabase,
          {
            clientMutationId: input.clientMutationId,
            expectedBaselineAssignmentResultId:
              input.expectedBaselineAssignmentResultId,
            expectedShiftRevision: activeShiftRecord.updatedAt,
            shiftId: activeShiftRecord.id,
          },
        );

        if (result.status === "saved" || result.status === "stale") {
          const workspace = await loadServerWorkspace(
            supabase,
            authState.profile,
          );

          if (
            result.status === "saved" &&
            workspace.activeShift?.shiftSnapshot.assignmentResult?.id !==
              result.resultId
          ) {
            throw new Error(
              "Assignment was saved, but the current board could not be refreshed yet. Reload the workspace before continuing.",
            );
          }

          applyWorkspace(workspace);
        }

        setSaveStatus(result.status === "saved" ? "saved" : "idle");

        return result;
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Assignment could not be calculated."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [applyWorkspace, authState, workspaceState],
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

  const resolveNurseSwapRequest = useCallback(
    async (
      requestId: string,
      nextStatus: Extract<NurseRequestStatus, "accepted" | "declined">,
    ) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as charge to resolve requests.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        await resolveShiftNurseSwapRequestOnServer(supabase, {
          nextStatus,
          requestId,
        });
        const workspace = await loadServerWorkspace(supabase, authState.profile);

        applyWorkspace(workspace);
        setSaveStatus("saved");
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Request could not be resolved."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [applyWorkspace, authState],
  );

  const updateNurseIssueStatus = useCallback(
    async (requestId: string, nextStatus: NurseIssueReviewStatus) => {
      if (
        authState.status !== "signed_in" ||
        authState.profile.role !== "charge_nurse"
      ) {
        throw new Error("Sign in as charge to update issue requests.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        await updateShiftNurseIssueStatusOnServer(supabase, {
          nextStatus,
          requestId,
        });
        const workspace = await loadServerWorkspace(supabase, authState.profile);

        applyWorkspace(workspace);
        setSaveStatus("saved");
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Issue status could not be updated."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [applyWorkspace, authState],
  );

  const submitJoinedNurseIssueRequest = useCallback(
    async (message: string) => {
      if (authState.status !== "signed_in") {
        throw new Error("Sign in before submitting an issue.");
      }

      if (joinedNurseAccessState.status !== "ready") {
        throw new Error("Join a shift before submitting an issue.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        await submitJoinedNurseIssueRequestToServer(supabase, { message });
        await loadJoinedNurseAccess("manual");
        setSaveStatus("saved");
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Issue request could not be submitted."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [authState, joinedNurseAccessState.status, loadJoinedNurseAccess],
  );

  const submitJoinedNurseSwapRequest = useCallback(
    async (sourceBedId: string, message: string) => {
      if (authState.status !== "signed_in") {
        throw new Error("Sign in before submitting a swap request.");
      }

      if (joinedNurseAccessState.status !== "ready") {
        throw new Error("Join a shift before submitting a swap request.");
      }

      const sourceBedBelongsToNurse =
        joinedNurseAccessState.assignmentView.assignedBeds.some(
          (assignedBed) => assignedBed.bed.id === sourceBedId,
        );

      if (!sourceBedBelongsToNurse) {
        throw new Error("Choose one of your assigned beds for the swap.");
      }

      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      setSaveErrorMessage("");
      setSaveStatus("saving");

      try {
        await submitJoinedNurseSwapRequestToServer(supabase, {
          message,
          sourceBedId,
        });
        await loadJoinedNurseAccess("manual");
        setSaveStatus("saved");
      } catch (error) {
        setSaveErrorMessage(
          getErrorMessage(error, "Swap request could not be submitted."),
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [authState, joinedNurseAccessState, loadJoinedNurseAccess],
  );

  const value = useMemo(
    () => ({
      activeParticipation: getActiveParticipation(
        workspaceState,
        joinedNurseAccessState,
      ),
      ...getWorkspaceSnapshots(workspaceState),
      confirmManualAssignmentOverride,
      deleteFloorTemplate,
      endActiveShift,
      joinedNurseAccessState,
      joinedNurseRealtimeConnectionState,
      realtimeConnectionState,
      retryLoadJoinedNurseAccess: loadJoinedNurseAccess,
      retryLoadWorkspace: loadWorkspace,
      runAssignmentOptimizer,
      resolveNurseSwapRequest,
      resetActiveShiftForEditing,
      saveActiveShift,
      saveErrorMessage,
      saveFloorTemplate,
      savePreviousShiftSnapshot,
      saveStatus,
      startActiveShift,
      submitJoinedNurseIssueRequest,
      submitJoinedNurseSwapRequest,
      updateNurseIssueStatus,
      workspaceState,
    }),
    [
      confirmManualAssignmentOverride,
      deleteFloorTemplate,
      endActiveShift,
      joinedNurseAccessState,
      joinedNurseRealtimeConnectionState,
      loadJoinedNurseAccess,
      loadWorkspace,
      realtimeConnectionState,
      runAssignmentOptimizer,
      resolveNurseSwapRequest,
      resetActiveShiftForEditing,
      saveActiveShift,
      saveErrorMessage,
      saveFloorTemplate,
      savePreviousShiftSnapshot,
      saveStatus,
      startActiveShift,
      submitJoinedNurseIssueRequest,
      submitJoinedNurseSwapRequest,
      updateNurseIssueStatus,
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

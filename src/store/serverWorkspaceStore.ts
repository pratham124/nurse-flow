import { createStore, type StoreApi } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";

import type { AssignmentOptimizerResult } from "../services/optimizerRepository";
import type {
  ConfirmManualAssignmentOverrideInput,
  ConfirmManualAssignmentOverrideResult,
} from "../services/serverWorkspaceRepository";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAssignmentFlags } from "../utils/assignmentFlags";
import { getEffectiveAssignmentResult } from "../utils/effectiveAssignment";
import type {
  ActiveAssignmentOverridesByBedId,
  AssignmentResult,
  AuthSessionState,
  Flag,
  FloorTemplate,
  FloorTemplateRecord,
  JoinedNurseAssignmentView,
  NurseIssueReviewStatus,
  NurseRequestStatus,
  PreviousShiftSnapshot,
  RealtimeConnectionState,
  ServerWorkspace,
  Shift,
} from "../types/models";

export type ServerWorkspaceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty"; workspace: ServerWorkspace }
  | { status: "ready"; workspace: ServerWorkspace }
  | { errorMessage: string; status: "error" };

export type JoinedNurseAccessState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; assignmentView: JoinedNurseAssignmentView }
  | { status: "shift_ended" }
  | { status: "access_removed" }
  | { errorMessage: string; status: "error" };

export type JoinedNurseAccessRefreshReason =
  | "manual"
  | "shift_changed"
  | "access_changed";

export type ActiveParticipation =
  | { type: "none" }
  | { shiftId: string; type: "charge_shift" }
  | { nurseId: string; shiftId: string; type: "joined_nurse" };

type WorkspaceView = {
  activeAssignmentOverridesByBedId: ActiveAssignmentOverridesByBedId;
  activeShift?: Shift;
  effectiveAssignmentFlags: Flag[];
  effectiveAssignmentResult?: AssignmentResult;
  floorTemplates: FloorTemplate[];
  previousShiftSnapshots: PreviousShiftSnapshot[];
};

type ServerWorkspaceStoreState = WorkspaceView & {
  activeParticipation: ActiveParticipation;
  joinedNurseAccessState: JoinedNurseAccessState;
  joinedNurseRealtimeConnectionState: RealtimeConnectionState;
  realtimeConnectionState: RealtimeConnectionState;
  workspaceState: ServerWorkspaceState;
};

type ServerWorkspaceStoreActions = {
  applyWorkspace: (workspace: ServerWorkspace) => void;
  confirmManualAssignmentOverride: (
    input: ConfirmManualAssignmentOverrideInput,
  ) => Promise<ConfirmManualAssignmentOverrideResult>;
  deleteFloorTemplate: (floorTemplateId: string) => Promise<void>;
  endActiveShift: (activeShift: Shift) => Promise<void>;
  replaceActiveShiftFromRealtime: (
    activeShift: ServerWorkspace["activeShift"],
  ) => void;
  retryLoadJoinedNurseAccess: (
    reason?: JoinedNurseAccessRefreshReason,
  ) => Promise<void>;
  retryLoadWorkspace: () => Promise<void>;
  resolveNurseSwapRequest: (
    requestId: string,
    nextStatus: Extract<NurseRequestStatus, "accepted" | "declined">,
  ) => Promise<void>;
  resetActiveShiftForEditing: (
    expectedBaselineAssignmentResultId: string,
  ) => Promise<Shift>;
  runAssignmentOptimizer: (input: {
    clientMutationId: string;
    expectedBaselineAssignmentResultId?: string;
  }) => Promise<AssignmentOptimizerResult>;
  saveActiveShift: (activeShift: Shift) => Promise<Shift>;
  saveFloorTemplate: (
    floorTemplate: FloorTemplate,
  ) => Promise<FloorTemplateRecord>;
  savePreviousShiftSnapshot: (
    snapshot: PreviousShiftSnapshot,
  ) => Promise<void>;
  setJoinedNurseAccessState: (state: JoinedNurseAccessState) => void;
  setJoinedNurseRealtimeConnectionState: (
    state: RealtimeConnectionState,
  ) => void;
  setRealtimeConnectionState: (state: RealtimeConnectionState) => void;
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
};

export type ServerWorkspaceStore = ServerWorkspaceStoreState &
  ServerWorkspaceStoreActions;

export type ServerWorkspaceDependencies = {
  confirmManualAssignmentOverrideOnServer: typeof import("../services/serverWorkspaceRepository").confirmManualAssignmentOverride;
  createServerActiveShift: typeof import("../services/serverWorkspaceRepository").createServerActiveShift;
  deleteServerFloorTemplate: typeof import("../services/serverWorkspaceRepository").deleteServerFloorTemplate;
  endServerActiveShift: typeof import("../services/serverWorkspaceRepository").endServerActiveShift;
  loadJoinedNurseAssignmentView: typeof import("../services/serverWorkspaceRepository").loadJoinedNurseAssignmentView;
  loadServerWorkspace: typeof import("../services/serverWorkspaceRepository").loadServerWorkspace;
  requestAssignmentOptimizationFromService: typeof import("../services/optimizerRepository").requestAssignmentOptimization;
  resetServerActiveShiftForEditing: typeof import("../services/serverWorkspaceRepository").resetServerActiveShiftForEditing;
  resolveShiftNurseSwapRequestOnServer: typeof import("../services/serverWorkspaceRepository").resolveShiftNurseSwapRequest;
  saveServerActiveShift: typeof import("../services/serverWorkspaceRepository").saveServerActiveShift;
  saveServerFloorTemplate: typeof import("../services/serverWorkspaceRepository").saveServerFloorTemplate;
  saveServerPreviousShiftSnapshot: typeof import("../services/serverWorkspaceRepository").saveServerPreviousShiftSnapshot;
  submitJoinedNurseIssueRequestToServer: typeof import("../services/serverWorkspaceRepository").submitJoinedNurseIssueRequest;
  submitJoinedNurseSwapRequestToServer: typeof import("../services/serverWorkspaceRepository").submitJoinedNurseSwapRequest;
  updateShiftNurseIssueStatusOnServer: typeof import("../services/serverWorkspaceRepository").updateShiftNurseIssueStatus;
};

export type CreateServerWorkspaceStoreOptions = {
  dependencies: ServerWorkspaceDependencies;
  getAuthState: () => AuthSessionState;
  getSupabaseClient: () => SupabaseClient | undefined;
};

const emptyWorkspaceView: WorkspaceView = {
  activeAssignmentOverridesByBedId: {},
  activeShift: undefined,
  effectiveAssignmentFlags: [],
  effectiveAssignmentResult: undefined,
  floorTemplates: [],
  previousShiftSnapshots: [],
};

export function getWorkspaceState(
  workspace: ServerWorkspace,
): ServerWorkspaceState {
  const isEmpty =
    workspace.floorTemplates.length === 0 &&
    !workspace.activeShift &&
    workspace.previousShiftSnapshots.length === 0;

  return {
    status: isEmpty ? "empty" : "ready",
    workspace,
  };
}

export function getActiveParticipation(
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

export function getWorkspaceView(
  workspaceState: ServerWorkspaceState,
): WorkspaceView {
  if (workspaceState.status !== "ready" && workspaceState.status !== "empty") {
    return emptyWorkspaceView;
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

export function createServerWorkspaceStore({
  dependencies,
  getAuthState,
  getSupabaseClient,
}: CreateServerWorkspaceStoreOptions): StoreApi<ServerWorkspaceStore> {
  return createStore<ServerWorkspaceStore>()(
    subscribeWithSelector((set, get) => {
      function setWorkspaceState(workspaceState: ServerWorkspaceState) {
        set({
          activeParticipation: getActiveParticipation(
            workspaceState,
            get().joinedNurseAccessState,
          ),
          ...getWorkspaceView(workspaceState),
          workspaceState,
        });
      }

      function setJoinedNurseAccessState(
        joinedNurseAccessState: JoinedNurseAccessState,
      ) {
        set({
          activeParticipation: getActiveParticipation(
            get().workspaceState,
            joinedNurseAccessState,
          ),
          joinedNurseAccessState,
        });
      }

      function applyWorkspace(workspace: ServerWorkspace) {
        setWorkspaceState(getWorkspaceState(workspace));
      }

      async function retryLoadWorkspace() {
        const authState = getAuthState();

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
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);
        } catch (error) {
          setWorkspaceState({
            errorMessage: getErrorMessage(
              error,
              "Workspace could not be loaded.",
            ),
            status: "error",
          });
        }
      }

      async function retryLoadJoinedNurseAccess(
        reason: JoinedNurseAccessRefreshReason = "manual",
      ) {
        const authState = getAuthState();
        const workspaceState = get().workspaceState;

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
          const assignmentView =
            await dependencies.loadJoinedNurseAssignmentView(
              supabase,
              authState.profile,
            );

          if (assignmentView) {
            setJoinedNurseAccessState({
              assignmentView,
              status: "ready",
            });
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
      }

      return {
        ...emptyWorkspaceView,
        activeParticipation: { type: "none" },
        applyWorkspace,
        async confirmManualAssignmentOverride(input) {
          const authState = getAuthState();

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

          const result =
            await dependencies.confirmManualAssignmentOverrideOnServer(
              supabase,
              input,
            );
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);

          return result;
        },
        async deleteFloorTemplate(floorTemplateId) {
          const authState = getAuthState();
          const workspaceState = get().workspaceState;

          if (
            authState.status !== "signed_in" ||
            authState.profile.role !== "charge_nurse"
          ) {
            throw new Error(
              "Sign in as a charge nurse to delete floor templates.",
            );
          }

          if (hasActiveChargeShift(workspaceState)) {
            throw new Error("End the active shift before deleting templates.");
          }

          const supabase = getSupabaseClient();

          if (!supabase) {
            throw new Error("Supabase is not configured yet.");
          }

          await dependencies.deleteServerFloorTemplate(
            supabase,
            authState.profile,
            floorTemplateId,
          );
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);
        },
        async endActiveShift(activeShift) {
          const authState = getAuthState();

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

          await dependencies.endServerActiveShift(
            supabase,
            authState.profile,
            activeShift,
          );
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);
        },
        joinedNurseAccessState: { status: "idle" },
        joinedNurseRealtimeConnectionState: "disconnected",
        realtimeConnectionState: "disconnected",
        replaceActiveShiftFromRealtime(activeShift) {
          const workspaceState = get().workspaceState;

          if (
            workspaceState.status !== "ready" &&
            workspaceState.status !== "empty"
          ) {
            return;
          }

          applyWorkspace({
            ...workspaceState.workspace,
            activeShift,
          });
        },
        retryLoadJoinedNurseAccess,
        retryLoadWorkspace,
        async resolveNurseSwapRequest(requestId, nextStatus) {
          const authState = getAuthState();

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

          await dependencies.resolveShiftNurseSwapRequestOnServer(supabase, {
            nextStatus,
            requestId,
          });
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);
        },
        async resetActiveShiftForEditing(
          expectedBaselineAssignmentResultId,
        ) {
          const authState = getAuthState();
          const workspaceState = get().workspaceState;

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

          const result = await dependencies.resetServerActiveShiftForEditing(
            supabase,
            authState.profile,
            activeShiftRecord.id,
            expectedBaselineAssignmentResultId,
          );
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);

          if (result.status === "stale") {
            throw new Error(result.message);
          }

          return result.shiftSnapshot;
        },
        async runAssignmentOptimizer(input) {
          const authState = getAuthState();
          const workspaceState = get().workspaceState;

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
            throw new Error(
              "Load the server workspace before running assignment.",
            );
          }

          const activeShiftRecord = workspaceState.workspace.activeShift;

          if (!activeShiftRecord) {
            throw new Error("Start a shift before running assignment.");
          }

          const supabase = getSupabaseClient();

          if (!supabase) {
            throw new Error("Supabase is not configured yet.");
          }

          const result =
            await dependencies.requestAssignmentOptimizationFromService(
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
            const workspace = await dependencies.loadServerWorkspace(
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

          return result;
        },
        async saveActiveShift(activeShift) {
          const authState = getAuthState();

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

          const savedActiveShift = await dependencies.saveServerActiveShift(
            supabase,
            authState.profile,
            activeShift,
          );
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);

          return savedActiveShift.shiftSnapshot;
        },
        async saveFloorTemplate(floorTemplate) {
          const authState = getAuthState();
          const joinedNurseAccessState = get().joinedNurseAccessState;

          if (
            authState.status !== "signed_in" ||
            authState.profile.role !== "charge_nurse"
          ) {
            throw new Error(
              "Sign in as a charge nurse to save floor templates.",
            );
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

          const savedTemplate = await dependencies.saveServerFloorTemplate(
            supabase,
            authState.profile,
            floorTemplate,
          );
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);

          return savedTemplate;
        },
        async savePreviousShiftSnapshot(snapshot) {
          const authState = getAuthState();

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

          await dependencies.saveServerPreviousShiftSnapshot(
            supabase,
            authState.profile,
            snapshot,
          );
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);
        },
        setJoinedNurseAccessState,
        setJoinedNurseRealtimeConnectionState(
          joinedNurseRealtimeConnectionState,
        ) {
          set({ joinedNurseRealtimeConnectionState });
        },
        setRealtimeConnectionState(realtimeConnectionState) {
          set({ realtimeConnectionState });
        },
        async startActiveShift(activeShift) {
          const authState = getAuthState();

          if (
            authState.status !== "signed_in" ||
            authState.profile.role !== "charge_nurse"
          ) {
            throw new Error(
              "Sign in as a charge nurse to start a server shift.",
            );
          }

          const supabase = getSupabaseClient();

          if (!supabase) {
            throw new Error("Supabase is not configured yet.");
          }

          const savedActiveShift =
            await dependencies.createServerActiveShift(
              supabase,
              authState.profile,
              activeShift,
            );
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);

          return savedActiveShift.shiftSnapshot;
        },
        async submitJoinedNurseIssueRequest(message) {
          const authState = getAuthState();
          const joinedNurseAccessState = get().joinedNurseAccessState;

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

          await dependencies.submitJoinedNurseIssueRequestToServer(supabase, {
            message,
          });
          await get().retryLoadJoinedNurseAccess("manual");
        },
        async submitJoinedNurseSwapRequest(sourceBedId, message) {
          const authState = getAuthState();
          const joinedNurseAccessState = get().joinedNurseAccessState;

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

          await dependencies.submitJoinedNurseSwapRequestToServer(supabase, {
            message,
            sourceBedId,
          });
          await get().retryLoadJoinedNurseAccess("manual");
        },
        async updateNurseIssueStatus(requestId, nextStatus) {
          const authState = getAuthState();

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

          await dependencies.updateShiftNurseIssueStatusOnServer(supabase, {
            nextStatus,
            requestId,
          });
          const workspace = await dependencies.loadServerWorkspace(
            supabase,
            authState.profile,
          );

          applyWorkspace(workspace);
        },
        workspaceState: { status: "idle" },
      };
    }),
  );
}

export function selectActiveParticipation(
  state: ServerWorkspaceStore,
): ActiveParticipation {
  return getActiveParticipation(
    state.workspaceState,
    state.joinedNurseAccessState,
  );
}

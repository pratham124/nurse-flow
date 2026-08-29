import {
  requestAssignmentOptimization,
} from "../services/optimizerRepository";
import {
  confirmManualAssignmentOverride,
  createServerActiveShift,
  deleteServerFloorTemplate,
  endServerActiveShift,
  loadJoinedNurseAssignmentView,
  loadServerWorkspace,
  resetServerActiveShiftForEditing,
  resolveShiftNurseSwapRequest,
  saveServerActiveShift,
  saveServerFloorTemplate,
  saveServerPreviousShiftSnapshot,
  submitJoinedNurseIssueRequest,
  submitJoinedNurseSwapRequest,
  updateShiftNurseIssueStatus,
} from "../services/serverWorkspaceRepository";
import type { ServerWorkspaceDependencies } from "./serverWorkspaceStore";

export const serverWorkspaceDependencies: ServerWorkspaceDependencies = {
  confirmManualAssignmentOverrideOnServer: confirmManualAssignmentOverride,
  createServerActiveShift,
  deleteServerFloorTemplate,
  endServerActiveShift,
  loadJoinedNurseAssignmentView,
  loadServerWorkspace,
  requestAssignmentOptimizationFromService: requestAssignmentOptimization,
  resetServerActiveShiftForEditing,
  resolveShiftNurseSwapRequestOnServer: resolveShiftNurseSwapRequest,
  saveServerActiveShift,
  saveServerFloorTemplate,
  saveServerPreviousShiftSnapshot,
  submitJoinedNurseIssueRequestToServer: submitJoinedNurseIssueRequest,
  submitJoinedNurseSwapRequestToServer: submitJoinedNurseSwapRequest,
  updateShiftNurseIssueStatusOnServer: updateShiftNurseIssueStatus,
};

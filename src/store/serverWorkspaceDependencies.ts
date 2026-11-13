import { requestAssignmentOptimization } from "../services/optimizerRepository";
import {
  confirmManualAssignmentOverride,
  createServerActiveShift,
  deleteServerFloorTemplate,
  endServerActiveShift,
  loadJoinedNurseAssignmentView,
  loadServerWorkspace,
  resetServerActiveShiftForEditing,
  saveServerActiveShift,
  saveServerFloorTemplate,
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
  saveServerActiveShift,
  saveServerFloorTemplate,
};

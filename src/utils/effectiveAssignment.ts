import type {
  ActiveAssignmentOverridesByBedId,
  AssignmentResult,
} from "../types/models";

export function getEffectiveAssignmentResult(
  generatedAssignmentResult: AssignmentResult,
  activeAssignmentOverridesByBedId?: ActiveAssignmentOverridesByBedId,
): AssignmentResult {
  return {
    ...generatedAssignmentResult,
    bedAssignments: generatedAssignmentResult.bedAssignments.map(
      (generatedBedAssignment) => {
        const activeOverride =
          activeAssignmentOverridesByBedId?.[generatedBedAssignment.bedId];

        if (!activeOverride) {
          return { ...generatedBedAssignment };
        }

        return {
          ...generatedBedAssignment,
          nurseId: activeOverride.toNurseId,
        };
      },
    ),
  };
}

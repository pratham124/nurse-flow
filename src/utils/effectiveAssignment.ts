import type {
  ActiveAssignmentOverridesByBedId,
  AssignmentResult,
} from "../types/models";

export function getAssignmentLoadsByNurseId(
  assignmentResult: AssignmentResult,
): Record<string, number> {
  return assignmentResult.bedAssignments.reduce<Record<string, number>>(
    (loadsByNurseId, bedAssignment) => {
      loadsByNurseId[bedAssignment.nurseId] =
        (loadsByNurseId[bedAssignment.nurseId] ?? 0) + 1;

      return loadsByNurseId;
    },
    {},
  );
}

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

import assert from "node:assert/strict";
import test from "node:test";

import { generateAssignmentFlags } from "../src/utils/assignmentFlags.ts";
import { getAssignmentMovePreview } from "../src/utils/assignmentMovePreview.ts";
import { getEffectiveAssignmentResult } from "../src/utils/effectiveAssignment.ts";

function createShift({ acuity = "green", targetLicense = "RN" } = {}) {
  return {
    id: "shift-1",
    floorTemplateId: "floor-1",
    floorName: "4 West",
    status: "assigned",
    admittingDoctorSideId: "side-1",
    doctorSides: [{ id: "side-1", name: "Medicine" }],
    rooms: [
      { id: "room-1", doctorSideId: "side-1", label: "401", bedCount: 2 },
    ],
    beds: [
      { id: "bed-a", roomId: "room-1", label: "401-A", bedNumber: 1 },
      { id: "bed-b", roomId: "room-1", label: "401-B", bedNumber: 2 },
    ],
    sideLoadLimits: {
      admitting: { min: 1, max: 1 },
      nonAdmitting: { min: 1, max: 1 },
    },
    nurses: [
      {
        id: "nurse-a",
        name: "Avery",
        licenseType: "RN",
        experienceLevel: "experienced",
        maxPatientLoad: 2,
      },
      {
        id: "nurse-b",
        name: "Blake",
        licenseType: targetLicense,
        experienceLevel: "mid",
        maxPatientLoad: 1,
      },
    ],
    bedStates: [
      {
        id: "state-a",
        bedId: "bed-a",
        patient: { initials: "AA" },
        acuity,
      },
      {
        id: "state-b",
        bedId: "bed-b",
        patient: { initials: "BB" },
        acuity: "green",
      },
    ],
    assignmentResult: {
      id: "assignment-1",
      generatedTeams: [
        { id: "team-a", label: "Team A", nurseIds: ["nurse-a"] },
        { id: "team-b", label: "Team B", nurseIds: ["nurse-b"] },
      ],
      roomCoverage: [
        {
          id: "coverage-1",
          roomId: "room-1",
          nurseIds: ["nurse-a", "nurse-b"],
        },
      ],
      bedAssignments: [
        { id: "assignment-a", bedId: "bed-a", nurseId: "nurse-a" },
        { id: "assignment-b", bedId: "bed-b", nurseId: "nurse-b" },
      ],
    },
    flags: [],
  };
}

test("previews a new overload as a non-blocking warning", () => {
  const shift = createShift();
  const preview = getAssignmentMovePreview(
    shift,
    shift.assignmentResult,
    "bed-a",
    "nurse-b",
  );

  assert.deepEqual(preview.blockingReasons, []);
  assert.deepEqual(preview.resultingLoadSummary, [
    { before: 1, after: 0, nurseId: "nurse-a" },
    { before: 1, after: 2, nurseId: "nurse-b" },
  ]);
  assert.ok(
    preview.warnings.some((warning) => warning.type === "over_max_load"),
  );
});

test("blocks moving a red-acuity bed to an LPN", () => {
  const shift = createShift({ acuity: "red", targetLicense: "LPN" });
  const preview = getAssignmentMovePreview(
    shift,
    shift.assignmentResult,
    "bed-a",
    "nurse-b",
  );

  assert.ok(
    preview.blockingReasons.some(
      (reason) => reason.code === "red_requires_rn",
    ),
  );
  assert.equal(preview.resultingAssignmentResult, undefined);
});

test("effective flags use the override while the baseline stays unchanged", () => {
  const shift = createShift();
  const effectiveResult = getEffectiveAssignmentResult(shift.assignmentResult, {
    "bed-a": {
      id: "override-1",
      shiftId: shift.id,
      baselineAssignmentResultId: shift.assignmentResult.id,
      bedId: "bed-a",
      fromNurseId: "nurse-a",
      toNurseId: "nurse-b",
      createdByProfileId: "charge-1",
      createdAt: "2026-08-03T12:00:00.000Z",
      status: "active",
      serverSequence: 1,
      warningAcknowledgements: [],
    },
  });
  const flags = generateAssignmentFlags(shift, effectiveResult);

  assert.ok(flags.some((flag) => flag.type === "over_max_load"));
  assert.equal(shift.assignmentResult.bedAssignments[0].nurseId, "nurse-a");
});

test("no overrides preserve unassigned and imbalance flag behavior", () => {
  const shift = createShift();
  const baselineFlags = generateAssignmentFlags(shift, shift.assignmentResult);
  const effectiveResult = getEffectiveAssignmentResult(shift.assignmentResult);

  assert.deepEqual(
    generateAssignmentFlags(shift, effectiveResult),
    baselineFlags,
  );

  const unassignedResult = {
    ...shift.assignmentResult,
    bedAssignments: shift.assignmentResult.bedAssignments.filter(
      (assignment) => assignment.bedId !== "bed-a",
    ),
  };
  const imbalancedResult = {
    ...shift.assignmentResult,
    bedAssignments: shift.assignmentResult.bedAssignments.map((assignment) => ({
      ...assignment,
      nurseId: "nurse-a",
    })),
  };

  assert.ok(
    generateAssignmentFlags(shift, unassignedResult).some(
      (flag) => flag.type === "unassigned_bed",
    ),
  );
  assert.ok(
    generateAssignmentFlags(shift, imbalancedResult).some(
      (flag) => flag.type === "team_imbalance",
    ),
  );
});

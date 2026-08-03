import assert from "node:assert/strict";
import test from "node:test";

import { getEffectiveAssignmentResult } from "../src/utils/effectiveAssignment.ts";

const generatedAssignmentResult = {
  id: "assignment-1",
  generatedTeams: [],
  roomCoverage: [],
  bedAssignments: [
    { id: "assignment-bed-a", bedId: "bed-a", nurseId: "nurse-a" },
    { id: "assignment-bed-b", bedId: "bed-b", nurseId: "nurse-b" },
  ],
};

function createOverride({ id, bedId = "bed-a", fromNurseId, toNurseId }) {
  return {
    id,
    shiftId: "shift-1",
    baselineAssignmentResultId: generatedAssignmentResult.id,
    bedId,
    fromNurseId,
    toNurseId,
    createdByProfileId: "charge-1",
    createdAt: "2026-08-03T12:00:00.000Z",
    status: "active",
    serverSequence: 1,
    warningAcknowledgements: [],
  };
}

test("uses the generated assignment when the override dictionary is missing", () => {
  const effectiveResult = getEffectiveAssignmentResult(
    generatedAssignmentResult,
  );

  assert.deepEqual(
    effectiveResult.bedAssignments,
    generatedAssignmentResult.bedAssignments,
  );
  assert.notStrictEqual(effectiveResult, generatedAssignmentResult);
});

test("applies one override only to its matching bed", () => {
  const effectiveResult = getEffectiveAssignmentResult(
    generatedAssignmentResult,
    {
      "bed-a": createOverride({
        id: "override-1",
        fromNurseId: "nurse-a",
        toNurseId: "nurse-c",
      }),
    },
  );

  assert.deepEqual(effectiveResult.bedAssignments, [
    { id: "assignment-bed-a", bedId: "bed-a", nurseId: "nurse-c" },
    { id: "assignment-bed-b", bedId: "bed-b", nurseId: "nurse-b" },
  ]);
  assert.equal(
    generatedAssignmentResult.bedAssignments[0].nurseId,
    "nurse-a",
  );
});

test("uses the replacement dictionary value for the same bed", () => {
  const effectiveResult = getEffectiveAssignmentResult(
    generatedAssignmentResult,
    {
      "bed-a": createOverride({
        id: "override-2",
        fromNurseId: "nurse-c",
        toNurseId: "nurse-d",
      }),
    },
  );

  assert.equal(effectiveResult.bedAssignments[0].nurseId, "nurse-d");
  assert.equal(effectiveResult.bedAssignments[1].nurseId, "nurse-b");
});

test("falls back to a rerun baseline after the active override is removed", () => {
  const rerunAssignmentResult = {
    ...generatedAssignmentResult,
    id: "assignment-2",
    bedAssignments: [
      { id: "rerun-bed-a", bedId: "bed-a", nurseId: "nurse-d" },
      { id: "rerun-bed-b", bedId: "bed-b", nurseId: "nurse-b" },
    ],
  };

  const effectiveResult = getEffectiveAssignmentResult(
    rerunAssignmentResult,
    {},
  );

  assert.deepEqual(
    effectiveResult.bedAssignments,
    rerunAssignmentResult.bedAssignments,
  );
});

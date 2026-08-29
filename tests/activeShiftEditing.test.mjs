import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getEffectiveAssignmentResult } from "../src/utils/effectiveAssignment.ts";
import { getNurseAssignedPatientCount } from "../src/utils/nurseInviteEligibility.ts";

const shift = {
  id: "shift-1",
  floorTemplateId: "floor-1",
  floorName: "4 West",
  status: "assigned",
  doctorSides: [],
  rooms: [],
  beds: [
    { id: "bed-a", label: "A", roomId: "room-1" },
    { id: "bed-b", label: "B", roomId: "room-1" },
  ],
  nurses: [],
  bedStates: [
    {
      bedId: "bed-a",
      patient: { initials: "A.A." },
      acuity: "green",
    },
    { bedId: "bed-b" },
  ],
  sideLoadLimits: {
    admitting: { min: 1, max: 4 },
    nonAdmitting: { min: 1, max: 6 },
  },
  flags: [],
};

const assignmentResult = {
  id: "assignment-1",
  generatedTeams: [],
  roomCoverage: [],
  bedAssignments: [
    { id: "assignment-a", bedId: "bed-a", nurseId: "nurse-a" },
    { id: "assignment-b", bedId: "bed-b", nurseId: "nurse-b" },
  ],
};

test("join-code eligibility counts occupied assigned beds only", () => {
  assert.equal(
    getNurseAssignedPatientCount(shift, assignmentResult, "nurse-a"),
    1,
  );
  assert.equal(
    getNurseAssignedPatientCount(shift, assignmentResult, "nurse-b"),
    0,
  );
});

test("join-code eligibility follows the effective assignment after a move", () => {
  const effectiveAssignmentResult = getEffectiveAssignmentResult(
    assignmentResult,
    {
      "bed-a": {
        id: "override-1",
        shiftId: shift.id,
        baselineAssignmentResultId: assignmentResult.id,
        bedId: "bed-a",
        fromNurseId: "nurse-a",
        toNurseId: "nurse-b",
        createdByProfileId: "charge-1",
        createdAt: "2026-08-25T12:00:00.000Z",
        status: "active",
        serverSequence: 1,
        warningAcknowledgements: [],
      },
    },
  );

  assert.equal(
    getNurseAssignedPatientCount(shift, effectiveAssignmentResult, "nurse-a"),
    0,
  );
  assert.equal(
    getNurseAssignedPatientCount(shift, effectiveAssignmentResult, "nurse-b"),
    1,
  );
});

test("the edit reset SQL clears every stale access boundary in one function", () => {
  const resetSql = readFileSync(
    new URL("../supabase/active_shift_edit_reset.sql", import.meta.url),
    "utf8",
  );

  assert.match(resetSql, /shift_snapshot\s*-\s*'assignmentResult'/);
  assert.match(resetSql, /update public\.manual_assignment_overrides/);
  assert.match(resetSql, /update public\.shift_nurse_invites/);
  assert.match(resetSql, /update public\.shift_nurse_access/);
  assert.match(resetSql, /status = 'removed'/);
  assert.match(resetSql, /update public\.active_shifts/);
});

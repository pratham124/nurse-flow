import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getEffectiveAssignmentResult } from "../src/utils/effectiveAssignment.ts";
import { createFloorBoardLookup } from "../src/utils/floorBoardLookup.ts";
import { getSelectedNurseAssignmentView } from "../src/utils/nurseAssignmentView.ts";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pythonPath = path.join(
  repositoryRoot,
  "optimizer-service",
  process.platform === "win32" ? "./.venv/Scripts/python.exe" : "./.venv/bin/python",
);
const emitScriptPath = path.join(
  repositoryRoot,
  "optimizer-service",
  "scripts",
  "emit_fixture_output.py",
);

function emitFixtureShift(fixtureId) {
  return JSON.parse(
    execFileSync(pythonPath, [emitScriptPath, fixtureId], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }),
  ).shift;
}

test("existing assignment readers consume the Python optimizer result", () => {
  const shift = emitFixtureShift("rn-lpn-mix");
  const lookup = createFloorBoardLookup(shift);
  const effectiveResult = getEffectiveAssignmentResult(shift.assignmentResult);

  assert.equal(lookup.assignmentByBedId.size, 4);
  assert.equal(lookup.generatedTeamLabelByNurseId.size, 2);
  assert.equal(lookup.roomCoverageNurseIdsByRoomId.size, 2);
  assert.deepEqual(effectiveResult, shift.assignmentResult);

  const assignedBedCount = shift.nurses.reduce((count, nurse) => {
    const result = getSelectedNurseAssignmentView(shift, nurse.id);
    assert.equal(result.status, "ready");
    return count + result.view.assignedBeds.length;
  }, 0);
  assert.equal(assignedBedCount, 4);
});

test("existing flag lookup consumes Python unassigned and staffing flags", () => {
  const shift = emitFixtureShift("understaffed");
  const lookup = createFloorBoardLookup(shift);

  assert.equal(lookup.assignmentByBedId.size, 2);
  assert.equal(lookup.bedFlagsByBedId.size, 1);
  assert.ok(shift.flags.some((flag) => flag.type === "understaffed"));
  assert.ok(shift.flags.some((flag) => flag.type === "unassigned_bed"));
});

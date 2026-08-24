import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(repositoryRoot, "src");

function getRuntimeSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return getRuntimeSourceFiles(entryPath);
    }

    return [".ts", ".tsx"].includes(extname(entry.name)) ? [entryPath] : [];
  });
}

test("mobile runtime has no client assignment generator or trusted-snapshot rerun", () => {
  const retiredRuntimeNames = [
    "generateLocalAssignmentResult",
    "generateBalancedTeams",
    "generateRoomCoverage",
    "generateBedAssignments",
    "rerunActiveShiftAssignment",
    "rerun_active_shift_assignment",
  ];

  for (const filePath of getRuntimeSourceFiles(sourceRoot)) {
    const source = readFileSync(filePath, "utf8");

    for (const retiredName of retiredRuntimeNames) {
      assert.equal(
        source.includes(retiredName),
        false,
        `${filePath} still references retired runtime name ${retiredName}`,
      );
    }
  }
});

test("assignment review sends the current baseline for reruns", () => {
  const source = readFileSync(
    join(sourceRoot, "screens", "AssignmentReviewScreen.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /runAssignmentOptimizer\(\{[\s\S]*?expectedBaselineAssignmentResultId:[\s\S]*?activeShift\.assignmentResult\?\.id/,
  );
});

test("an open move dialog keeps its opening baseline as the save precondition", () => {
  const source = readFileSync(
    join(sourceRoot, "components", "assignment", "AssignmentMoveDialog.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /openedBaselineAssignmentResultId !== effectiveAssignmentResult\.id/,
  );
  assert.match(
    source,
    /baselineAssignmentResultId: openedBaselineAssignmentResultId/,
  );
});

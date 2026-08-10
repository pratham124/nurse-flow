import assert from "node:assert/strict";
import test from "node:test";

import { createFloorBoardLookup } from "../src/utils/floorBoardLookup.ts";
import { createPhase8PerformanceFixture } from "./fixtures/phase8PerformanceFixture.ts";

test("indexes the development large-floor fixture without losing assignments", () => {
  const { shift } = createPhase8PerformanceFixture();
  const lookup = createFloorBoardLookup(shift);

  assert.equal(lookup.assignmentByBedId.size, 400);
  assert.equal(lookup.bedStateByBedId.size, 400);
  assert.equal(lookup.bedsByRoomId.size, 200);
  assert.equal(lookup.roomsByDoctorSideId.size, 4);
  assert.equal(
    Array.from(lookup.assignedBedCountByNurseId.values()).reduce(
      (total, load) => total + load,
      0,
    ),
    400,
  );
});

test("keeps bed, room, and nurse flag indexes scoped by their identifiers", () => {
  const { shift } = createPhase8PerformanceFixture();
  const lookup = createFloorBoardLookup(shift);

  assert.equal(lookup.bedFlagsByBedId.size, 50);
  assert.equal(lookup.roomFlagsByRoomId.size, 50);
  assert.equal(lookup.nurseFlagsByNurseId.size, 40);
});

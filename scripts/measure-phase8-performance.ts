import { performance } from "node:perf_hooks";

import { createFloorBoardLookup } from "../src/utils/floorBoardLookup";
import type { NurseRequestMessage, Shift } from "../src/types/models";
import { createPhase8PerformanceFixture } from "../tests/fixtures/phase8PerformanceFixture";

type TimingSummary = {
  medianMs: number;
  p95Ms: number;
};

function measure(operation: () => unknown, runCount = 100): TimingSummary {
  Array.from({ length: 10 }).forEach(operation);

  const samples = Array.from({ length: runCount }, () => {
    const startedAt = performance.now();

    operation();

    return performance.now() - startedAt;
  }).sort((first, second) => first - second);

  return {
    medianMs: samples[Math.floor(runCount / 2)],
    p95Ms: samples[Math.floor(runCount * 0.95)],
  };
}

function buildScanBasedBoardProjection(shift: Shift) {
  return shift.doctorSides.map((side) => ({
    id: side.id,
    rooms: shift.rooms
      .filter((room) => room.doctorSideId === side.id)
      .map((room) => ({
        beds: shift.beds
          .filter((bed) => bed.roomId === room.id)
          .map((bed) => {
            const assignment = shift.assignmentResult?.bedAssignments.find(
              (candidate) => candidate.bedId === bed.id,
            );

            return {
              assignment,
              bed,
              bedFlags: shift.flags.filter((flag) => flag.bedId === bed.id),
              bedState: shift.bedStates.find(
                (bedState) => bedState.bedId === bed.id,
              ),
              nurse: shift.nurses.find(
                (candidate) => candidate.id === assignment?.nurseId,
              ),
            };
          }),
        coverage: shift.assignmentResult?.roomCoverage.find(
          (candidate) => candidate.roomId === room.id,
        ),
        id: room.id,
        roomFlags: shift.flags.filter(
          (flag) => flag.roomId === room.id && !flag.bedId,
        ),
      })),
  }));
}

function buildIndexedBoardProjection(shift: Shift) {
  const lookup = createFloorBoardLookup(shift);

  return shift.doctorSides.map((side) => ({
    id: side.id,
    rooms: (lookup.roomsByDoctorSideId.get(side.id) ?? []).map((room) => ({
      beds: (lookup.bedsByRoomId.get(room.id) ?? []).map((bed) => {
        const assignment = lookup.assignmentByBedId.get(bed.id);

        return {
          assignment,
          bed,
          bedFlags: lookup.bedFlagsByBedId.get(bed.id) ?? [],
          bedState: lookup.bedStateByBedId.get(bed.id),
          nurse: assignment
            ? lookup.nurseById.get(assignment.nurseId)
            : undefined,
        };
      }),
      coverage: lookup.roomCoverageNurseIdsByRoomId.get(room.id) ?? [],
      id: room.id,
      roomFlags: lookup.roomFlagsByRoomId.get(room.id) ?? [],
    })),
  }));
}

function buildThreadProjectionWithPerMessageFormatter(
  messages: NurseRequestMessage[],
) {
  return messages.map((message) => ({
    id: message.id,
    time: new Date(message.createdAt).toLocaleString([], {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
    }),
  }));
}

const sharedMessageTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
});

function buildThreadProjectionWithSharedFormatter(
  messages: NurseRequestMessage[],
) {
  return messages.map((message) => ({
    id: message.id,
    time: sharedMessageTimeFormatter.format(new Date(message.createdAt)),
  }));
}

const fixture = createPhase8PerformanceFixture();
const result = {
  board: {
    indexed: measure(() => buildIndexedBoardProjection(fixture.shift)),
    scanBased: measure(() => buildScanBasedBoardProjection(fixture.shift)),
  },
  fixture: {
    beds: fixture.shift.beds.length,
    doctorSides: fixture.shift.doctorSides.length,
    flags: fixture.shift.flags.length,
    messages: fixture.messages.length,
    nurses: fixture.shift.nurses.length,
    rooms: fixture.shift.rooms.length,
  },
  thread: {
    perMessageFormatter: measure(() =>
      buildThreadProjectionWithPerMessageFormatter(fixture.messages),
    ),
    sharedFormatter: measure(() =>
      buildThreadProjectionWithSharedFormatter(fixture.messages),
    ),
  },
};

console.log(JSON.stringify(result, null, 2));

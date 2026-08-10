import type { NurseRequestMessage, Shift } from "../../src/types/models";

export type Phase8PerformanceFixture = {
  messages: NurseRequestMessage[];
  shift: Shift;
};

export function createPhase8PerformanceFixture(): Phase8PerformanceFixture {
  const doctorSides = Array.from({ length: 4 }, (_, sideIndex) => ({
    id: `perf-side-${sideIndex + 1}`,
    name: `Side ${sideIndex + 1}`,
  }));
  const rooms = Array.from({ length: 200 }, (_, roomIndex) => ({
    bedCount: 2,
    doctorSideId: doctorSides[Math.floor(roomIndex / 50)].id,
    id: `perf-room-${roomIndex + 1}`,
    label: `${roomIndex + 1}`,
  }));
  const beds = rooms.flatMap((room, roomIndex) =>
    ["A", "B"].map((label, bedIndex) => ({
      bedNumber: bedIndex + 1,
      id: `perf-bed-${roomIndex * 2 + bedIndex + 1}`,
      label,
      roomId: room.id,
    })),
  );
  const nurses = Array.from({ length: 40 }, (_, nurseIndex) => ({
    experienceLevel: nurseIndex % 4 === 0 ? "mid" as const : "experienced" as const,
    id: `perf-nurse-${nurseIndex + 1}`,
    licenseType: nurseIndex % 5 === 0 ? "LPN" as const : "RN" as const,
    maxPatientLoad: 10,
    name: `Performance Nurse ${nurseIndex + 1}`,
  }));
  const bedAssignments = beds.map((bed, bedIndex) => ({
    bedId: bed.id,
    id: `perf-assignment-${bedIndex + 1}`,
    nurseId: nurses[bedIndex % nurses.length].id,
  }));
  const roomCoverage = rooms.map((room, roomIndex) => ({
    id: `perf-coverage-${roomIndex + 1}`,
    nurseIds: [nurses[roomIndex % nurses.length].id],
    roomId: room.id,
  }));
  const generatedTeams = Array.from({ length: 10 }, (_, teamIndex) => ({
    id: `perf-team-${teamIndex + 1}`,
    label: `Team ${teamIndex + 1}`,
    nurseIds: nurses
      .slice(teamIndex * 4, teamIndex * 4 + 4)
      .map((nurse) => nurse.id),
  }));
  const messages = Array.from({ length: 250 }, (_, messageIndex) => ({
    authorProfileId:
      messageIndex % 2 === 0 ? "perf-charge-profile" : "perf-nurse-profile",
    body: `Representative request follow-up message ${messageIndex + 1}`,
    createdAt: new Date(
      Date.UTC(2026, 0, 1, 12, messageIndex),
    ).toISOString(),
    id: `perf-message-${messageIndex + 1}`,
    requestId: "perf-request-1",
    shiftId: "perf-shift-1",
  }));

  return {
    messages,
    shift: {
      admittingDoctorSideId: doctorSides[0].id,
      assignmentResult: {
        bedAssignments,
        generatedTeams,
        id: "perf-assignment-result-1",
        roomCoverage,
      },
      beds,
      bedStates: beds.map((bed, bedIndex) => ({
        acuity: (["green", "yellow", "red"] as const)[bedIndex % 3],
        bedId: bed.id,
        id: `perf-bed-state-${bedIndex + 1}`,
        patient: {
          initials: `P${bedIndex + 1}`,
        },
      })),
      doctorSides,
      flags: Array.from({ length: 100 }, (_, flagIndex) => ({
        bedId: flagIndex % 2 === 0 ? beds[flagIndex].id : undefined,
        id: `perf-flag-${flagIndex + 1}`,
        message: `Representative assignment flag ${flagIndex + 1}`,
        nurseId: nurses[flagIndex % nurses.length].id,
        roomId: rooms[flagIndex].id,
        severity: "warning" as const,
        type: "team_imbalance" as const,
      })),
      floorName: "Development Performance Floor",
      floorTemplateId: "perf-template-1",
      id: "perf-shift-1",
      nurses,
      rooms,
      sideLoadLimits: {
        admitting: { max: 120, min: 0 },
        nonAdmitting: { max: 120, min: 0 },
      },
      status: "assigned",
    },
  };
}

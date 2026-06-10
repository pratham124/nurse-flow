import type {
  Acuity,
  AssignmentResult,
  BreakSchedule,
  BreakScheduleEntry,
  BreakScheduleWarning,
  FloorActivityLevel,
  LocalId,
  Shift,
} from "../types/models";

export const missingBreakLabel = "Break not scheduled yet.";

export type ChargeBreakScheduleView = {
  status: BreakSchedule["status"];
  shiftStartTime: string;
  activityLevel: FloorActivityLevel;
  entries: BreakScheduleEntry[];
  warnings: BreakScheduleWarning[];
  emptyMessage?: string;
};

export type NurseBreakView = {
  breakTimeLabel: string;
  entry?: BreakScheduleEntry;
  warnings: BreakScheduleWarning[];
};

const defaultBreakScheduleView: ChargeBreakScheduleView = {
  status: "not_started",
  shiftStartTime: "",
  activityLevel: "moderate",
  entries: [],
  warnings: [],
  emptyMessage: missingBreakLabel,
};

const activityLabels: Record<FloorActivityLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

const breakDurationMinutes = 30;

const firstBreakOffsetMinutes: Record<FloorActivityLevel, number> = {
  low: 120,
  moderate: 150,
  high: 180,
};

const breakSpacingMinutes: Record<FloorActivityLevel, number> = {
  low: 30,
  moderate: 45,
  high: 60,
};

function getAcuityCounts(activeShift?: Shift) {
  return (
    activeShift?.bedStates.reduce(
      (counts, bedState) => {
        if (bedState.acuity) {
          counts[bedState.acuity] += 1;
        }

        return counts;
      },
      { green: 0, yellow: 0, red: 0 } satisfies Record<Acuity, number>,
    ) ?? { green: 0, yellow: 0, red: 0 }
  );
}

export function deriveFloorActivityLevel(activeShift?: Shift): FloorActivityLevel {
  const acuityCounts = getAcuityCounts(activeShift);

  if (acuityCounts.red >= 2 || acuityCounts.yellow + acuityCounts.red >= 5) {
    return "high";
  }

  if (acuityCounts.red >= 1 || acuityCounts.yellow >= 2) {
    return "moderate";
  }

  return "low";
}

export function getFloorActivityLabel(activityLevel: FloorActivityLevel) {
  return activityLabels[activityLevel];
}

export function getShiftStartTimeLabel(activeShift?: Shift) {
  if (!activeShift?.startedAt) {
    return "--:--";
  }

  const startedAt = new Date(activeShift.startedAt);

  if (Number.isNaN(startedAt.getTime())) {
    return "--:--";
  }

  return startedAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getShiftStartMinutes(activeShift?: Shift) {
  if (!activeShift?.startedAt) {
    return 7 * 60;
  }

  const startedAt = new Date(activeShift.startedAt);

  if (Number.isNaN(startedAt.getTime())) {
    return 7 * 60;
  }

  return startedAt.getHours() * 60 + startedAt.getMinutes();
}

function formatMinutesAsTime(totalMinutes: number) {
  const minutesInDay = 24 * 60;
  const normalizedMinutes =
    ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;

  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

export function getShiftStartTimeValue(activeShift?: Shift) {
  if (!activeShift?.startedAt) {
    return "";
  }

  const startedAt = new Date(activeShift.startedAt);

  if (Number.isNaN(startedAt.getTime())) {
    return "";
  }

  return formatMinutesAsTime(getShiftStartMinutes(activeShift));
}

export function generateBreakSlots(
  shiftStartTime: string,
  nurseCount: number,
  activityLevel: FloorActivityLevel,
) {
  const [hourText, minuteText] = shiftStartTime.split(":");
  const startMinutes = Number(hourText) * 60 + Number(minuteText);
  const firstBreakStart = startMinutes + firstBreakOffsetMinutes[activityLevel];
  const spacing = breakSpacingMinutes[activityLevel];

  return Array.from({ length: nurseCount }).map((_, index) =>
    formatMinutesAsTime(firstBreakStart + index * spacing),
  );
}

function getRoomIdsForNurse(
  assignmentResult: AssignmentResult,
  nurseId: LocalId,
) {
  return assignmentResult.roomCoverage
    .filter((coverage) => coverage.nurseIds.includes(nurseId))
    .map((coverage) => coverage.roomId);
}

function getDoctorSideIdsForRooms(activeShift: Shift, roomIds: LocalId[]) {
  const doctorSideIds = roomIds
    .map(
      (roomId) =>
        activeShift.rooms.find((room) => room.id === roomId)?.doctorSideId,
    )
    .filter((doctorSideId): doctorSideId is LocalId => Boolean(doctorSideId));

  return Array.from(new Set(doctorSideIds));
}

function getSharedRoomIds(
  firstRoomIds: LocalId[],
  secondRoomIds: LocalId[],
) {
  return firstRoomIds.filter((roomId) => secondRoomIds.includes(roomId));
}

function getRoomOverlapWarning(activeShift: Shift, assignmentResult: AssignmentResult) {
  const nurseCoverage = activeShift.nurses.map((nurse) => ({
    nurseId: nurse.id,
    roomIds: getRoomIdsForNurse(assignmentResult, nurse.id),
  }));

  if (nurseCoverage.length < 2) {
    return undefined;
  }

  const overlappingRoomIds = new Set<LocalId>();
  const everyNurseOverlaps = nurseCoverage.every((firstNurse) =>
    nurseCoverage
      .filter((secondNurse) => secondNurse.nurseId !== firstNurse.nurseId)
      .some((secondNurse) => {
        const sharedRoomIds = getSharedRoomIds(
          firstNurse.roomIds,
          secondNurse.roomIds,
        );

        sharedRoomIds.forEach((roomId) => overlappingRoomIds.add(roomId));

        return sharedRoomIds.length > 0;
      }),
  );

  if (!everyNurseOverlaps) {
    return undefined;
  }

  return {
    id: `break-${activeShift.id}-warning-room-overlap`,
    type: "overlapping_room_coverage" as const,
    message:
      "Every scheduled nurse shares room coverage, so breaks are staggered with limited backup separation.",
    nurseIds: nurseCoverage.map((coverage) => coverage.nurseId),
    doctorSideIds: getDoctorSideIdsForRooms(
      activeShift,
      Array.from(overlappingRoomIds),
    ),
    roomIds: Array.from(overlappingRoomIds),
  };
}

function getExperiencedCoverageWarnings(
  activeShift: Shift,
  assignmentResult: AssignmentResult,
): BreakScheduleWarning[] {
  return activeShift.doctorSides.flatMap((doctorSide) => {
    const sideRoomIds = activeShift.rooms
      .filter((room) => room.doctorSideId === doctorSide.id)
      .map((room) => room.id);
    const coveringNurseIds = Array.from(
      new Set(
        assignmentResult.roomCoverage
          .filter((coverage) => sideRoomIds.includes(coverage.roomId))
          .flatMap((coverage) => coverage.nurseIds),
      ),
    );

    if (!coveringNurseIds.length) {
      return [];
    }

    const experiencedNurseIds = coveringNurseIds.filter(
      (nurseId) =>
        activeShift.nurses.find((nurse) => nurse.id === nurseId)
          ?.experienceLevel === "experienced",
    );

    if (experiencedNurseIds.length === 0) {
      const warning: BreakScheduleWarning = {
        id: `break-${activeShift.id}-warning-no-experienced-${doctorSide.id}`,
        type: "no_experienced_nurse_for_side",
        message: `${doctorSide.name} has no experienced nurse coverage for break planning.`,
        nurseIds: coveringNurseIds,
        doctorSideIds: [doctorSide.id],
        roomIds: sideRoomIds,
      };

      return [
        warning,
      ];
    }

    if (experiencedNurseIds.length === 1) {
      const warning: BreakScheduleWarning = {
        id: `break-${activeShift.id}-warning-experienced-gap-${doctorSide.id}`,
        type: "unable_to_schedule_break",
        message: `${doctorSide.name} has only one experienced nurse, so that nurse's break needs charge nurse review.`,
        nurseIds: experiencedNurseIds,
        doctorSideIds: [doctorSide.id],
        roomIds: sideRoomIds,
      };

      return [warning];
    }

    return [];
  });
}

function isBreakScheduleWarning(
  warning: BreakScheduleWarning | undefined,
): warning is BreakScheduleWarning {
  return Boolean(warning);
}

function getWarningIdsForNurse(
  warnings: BreakScheduleWarning[],
  nurseId: LocalId,
) {
  return warnings
    .filter((warning) => warning.nurseIds.includes(nurseId))
    .map((warning) => warning.id);
}

export function generateLocalBreakSchedule(
  activeShift: Shift,
  assignmentResult: AssignmentResult,
): BreakSchedule {
  const activityLevel = deriveFloorActivityLevel(activeShift);
  const shiftStartTime =
    getShiftStartTimeValue(activeShift) || formatMinutesAsTime(7 * 60);
  const slots = generateBreakSlots(
    shiftStartTime,
    activeShift.nurses.length,
    activityLevel,
  );
  const warnings = [
    getRoomOverlapWarning(activeShift, assignmentResult),
    ...getExperiencedCoverageWarnings(activeShift, assignmentResult),
  ].filter(isBreakScheduleWarning);

  return {
    status: "generated",
    shiftStartTime,
    activityLevel,
    generatedAt: new Date().toISOString(),
    entries: activeShift.nurses.map((nurse, index) => {
      const coveredRoomIds = getRoomIdsForNurse(assignmentResult, nurse.id);

      return {
        id: `break-${activeShift.id}-entry-${nurse.id}`,
        nurseId: nurse.id,
        nurseName: nurse.name,
        startTime: slots[index],
        durationMinutes: breakDurationMinutes,
        doctorSideIds: getDoctorSideIdsForRooms(activeShift, coveredRoomIds),
        coveredRoomIds,
        warningIds: getWarningIdsForNurse(warnings, nurse.id),
      };
    }),
    warnings,
  };
}

export function getBreakScheduleView(
  activeShift?: Shift,
): ChargeBreakScheduleView {
  const breakSchedule = activeShift?.breakSchedule;

  if (!breakSchedule) {
    return {
      ...defaultBreakScheduleView,
      shiftStartTime: getShiftStartTimeLabel(activeShift),
      activityLevel: deriveFloorActivityLevel(activeShift),
    };
  }

  return {
    status: breakSchedule.status,
    shiftStartTime: breakSchedule.shiftStartTime,
    activityLevel: breakSchedule.activityLevel,
    entries: breakSchedule.entries,
    warnings: breakSchedule.warnings,
    emptyMessage: breakSchedule.entries.length ? undefined : missingBreakLabel,
  };
}

export function getBreakEntryForNurse(
  activeShift: Shift | undefined,
  nurseId: LocalId | undefined,
): BreakScheduleEntry | undefined {
  if (!activeShift || !nurseId) {
    return undefined;
  }

  return activeShift.breakSchedule?.entries.find(
    (entry) => entry.nurseId === nurseId,
  );
}

export function getBreakWarningsForNurse(
  activeShift: Shift | undefined,
  nurseId: LocalId | undefined,
): BreakScheduleWarning[] {
  if (!activeShift || !nurseId) {
    return [];
  }

  return (
    activeShift.breakSchedule?.warnings.filter((warning) =>
      warning.nurseIds.includes(nurseId),
    ) ?? []
  );
}

export function getNurseBreakView(
  activeShift: Shift | undefined,
  nurseId: LocalId | undefined,
): NurseBreakView {
  const entry = getBreakEntryForNurse(activeShift, nurseId);

  return {
    entry,
    breakTimeLabel: entry?.startTime ?? missingBreakLabel,
    warnings: getBreakWarningsForNurse(activeShift, nurseId),
  };
}

export function markBreakScheduleNeedsRefresh(activeShift: Shift): Shift {
  if (
    !activeShift.breakSchedule ||
    activeShift.breakSchedule.status !== "generated"
  ) {
    return activeShift;
  }

  return {
    ...activeShift,
    breakSchedule: {
      ...activeShift.breakSchedule,
      status: "needs_refresh",
    },
  };
}

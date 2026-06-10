import type {
  Acuity,
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

import type { LoadLimitRange, Shift } from "../types/models";
import { isOccupiedBedState } from "./census";

export const phaseOneMaxLoadLimit = 12;

export type AssignmentValidationBlockerKind =
  | "shift"
  | "nurse"
  | "admitting_side"
  | "side_load_limits"
  | "acuity";

export type AssignmentValidationBlocker = {
  id: string;
  kind: AssignmentValidationBlockerKind;
  label: string;
  message: string;
  bedId?: string;
  nurseId?: string;
};

export type AssignmentValidationResult = {
  blockers: AssignmentValidationBlocker[];
  canRunAssignment: boolean;
  hasAdmittingSide: boolean;
  hasValidNurseInputs: boolean;
  hasValidSideLoadLimits: boolean;
  hasMissingAcuity: boolean;
  totalNurseCapacity: number;
};

function getBedLabel(activeShift: Shift, bedId: string) {
  return activeShift.beds.find((bed) => bed.id === bedId)?.label ?? "Unknown bed";
}

function getNurseLabel(activeShift: Shift, nurseId: string) {
  const nurseIndex = activeShift.nurses.findIndex((nurse) => nurse.id === nurseId);
  const nurse = activeShift.nurses[nurseIndex];

  return nurse?.name.trim() || `Nurse ${nurseIndex + 1}`;
}

function isWholePositiveLoad(value: number) {
  return Number.isInteger(value) && value >= 1;
}

function getSideBasedMaxLoad(activeShift: Shift) {
  return Math.max(
    activeShift.sideLoadLimits.admitting.max,
    activeShift.sideLoadLimits.nonAdmitting.max,
  );
}

function getNurseMaxLoadMessage(
  activeShift: Shift,
  nurseId: string,
  sideBasedMaxLoad: number,
) {
  const nurse = activeShift.nurses.find((shiftNurse) => shiftNurse.id === nurseId);
  const nurseLabel = getNurseLabel(activeShift, nurseId);

  if (!nurse || !isWholePositiveLoad(nurse.maxPatientLoad)) {
    return `${nurseLabel} needs a whole-number max load of at least 1.`;
  }

  if (nurse.maxPatientLoad > sideBasedMaxLoad) {
    return `${nurseLabel} needs a max load no higher than the side-based max of ${sideBasedMaxLoad}.`;
  }
  return `${nurseLabel} needs a valid max load.`;
}

function getLoadLimitRangeMessage(label: string, range: LoadLimitRange) {
  if (!Number.isInteger(range.min) || !Number.isInteger(range.max)) {
    return `${label} load limits must be whole numbers.`;
  }

  if (range.min < 1 || range.max < 1) {
    return `${label} load limits must be at least 1.`;
  }

  if (range.min > phaseOneMaxLoadLimit || range.max > phaseOneMaxLoadLimit) {
    return `${label} load limits cannot be higher than ${phaseOneMaxLoadLimit}.`;
  }

  if (range.min > range.max) {
    return `${label} minimum load cannot be higher than maximum load.`;
  }

  return "";
}

export function getAssignmentValidation(
  activeShift?: Shift,
): AssignmentValidationResult {
  if (!activeShift) {
    const blockers: AssignmentValidationBlocker[] = [
      {
        id: "shift-required",
        kind: "shift",
        label: "No shift",
        message: "Start a shift before running assignment.",
      },
    ];

    return {
      blockers,
      canRunAssignment: false,
      hasAdmittingSide: false,
      hasMissingAcuity: false,
      hasValidNurseInputs: false,
      hasValidSideLoadLimits: false,
      totalNurseCapacity: 0,
    };
  }

  const blockers: AssignmentValidationBlocker[] = [];
  const hasAdmittingSide = activeShift.doctorSides.some(
    (doctorSide) => doctorSide.id === activeShift.admittingDoctorSideId,
  );
  const sideBasedMaxLoad = getSideBasedMaxLoad(activeShift);
  const invalidNurses = activeShift.nurses.filter(
    (nurse) =>
      !isWholePositiveLoad(nurse.maxPatientLoad) ||
      nurse.maxPatientLoad > sideBasedMaxLoad,
  );
  const totalNurseCapacity = activeShift.nurses.reduce(
    (capacity, nurse) =>
      isWholePositiveLoad(nurse.maxPatientLoad)
        ? capacity + nurse.maxPatientLoad
        : capacity,
    0,
  );
  const admittingLimitMessage = getLoadLimitRangeMessage(
    "Admitting-side",
    activeShift.sideLoadLimits.admitting,
  );
  const nonAdmittingLimitMessage = getLoadLimitRangeMessage(
    "Non-admitting",
    activeShift.sideLoadLimits.nonAdmitting,
  );
  const missingAcuityBedStates = activeShift.bedStates.filter(
    (bedState) => isOccupiedBedState(bedState) && !bedState.acuity,
  );

  if (activeShift.nurses.length === 0) {
    blockers.push({
      id: "nurses-required",
      kind: "nurse",
      label: "No nurses",
      message: "Add at least one nurse before running assignment.",
    });
  }

  invalidNurses.forEach((nurse) => {
    blockers.push({
      id: `nurse-max-load-${nurse.id}`,
      kind: "nurse",
      label: "Max load",
      message: getNurseMaxLoadMessage(activeShift, nurse.id, sideBasedMaxLoad),
      nurseId: nurse.id,
    });
  });

  if (!hasAdmittingSide) {
    blockers.push({
      id: "admitting-side-required",
      kind: "admitting_side",
      label: "Admitting side",
      message: "Choose one admitting doctor side before running assignment.",
    });
  }

  if (admittingLimitMessage) {
    blockers.push({
      id: "admitting-load-limits",
      kind: "side_load_limits",
      label: "Load limits",
      message: admittingLimitMessage,
    });
  }

  if (nonAdmittingLimitMessage) {
    blockers.push({
      id: "non-admitting-load-limits",
      kind: "side_load_limits",
      label: "Load limits",
      message: nonAdmittingLimitMessage,
    });
  }

  missingAcuityBedStates.forEach((bedState) => {
    const patientInitials = bedState.patient?.initials.trim();
    const patientText = patientInitials ? ` by ${patientInitials}` : "";

    blockers.push({
      id: `acuity-${bedState.bedId}`,
      kind: "acuity",
      label: "Missing acuity",
      message: `Bed ${getBedLabel(activeShift, bedState.bedId)} is occupied${patientText} but missing acuity.`,
      bedId: bedState.bedId,
    });
  });

  return {
    blockers,
    canRunAssignment: blockers.length === 0,
    hasAdmittingSide,
    hasMissingAcuity: missingAcuityBedStates.length > 0,
    hasValidNurseInputs:
      activeShift.nurses.length > 0 && invalidNurses.length === 0,
    hasValidSideLoadLimits: !admittingLimitMessage && !nonAdmittingLimitMessage,
    totalNurseCapacity,
  };
}

import type { BedState, Shift } from "../types/models";

export type CensusTotals = {
  occupiedBedCount: number;
  totalBedCount: number;
};

export function isOccupiedBedState(bedState?: BedState) {
  return Boolean(bedState?.patient?.initials.trim());
}

export function getShiftCensus(activeShift?: Shift): CensusTotals {
  if (!activeShift) {
    return {
      occupiedBedCount: 0,
      totalBedCount: 0,
    };
  }

  return {
    occupiedBedCount: activeShift.bedStates.filter(isOccupiedBedState).length,
    totalBedCount: activeShift.beds.length,
  };
}

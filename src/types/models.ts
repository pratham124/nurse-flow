export type LocalId = string;

export type LicenseType = "RN" | "LPN";

export type ExperienceLevel = "new_grad" | "mid" | "experienced";

export type Acuity = "green" | "yellow" | "red";

export type Sex = "female" | "male" | "other" | "unknown";

export type ShiftStatus = "setup" | "assigned";

export type FlagSeverity = "info" | "warning" | "critical";

export type FlagType =
  | "validation"
  | "unassigned_bed"
  | "no_eligible_coverage"
  | "rn_required"
  | "over_side_load_limit"
  | "over_max_load"
  | "team_imbalance"
  | "understaffed";

export interface FloorTemplate {
  id: LocalId;
  name: string;
  doctorSides: DoctorSide[];
  rooms: Room[];
  beds: Bed[];
}

export interface DoctorSide {
  id: LocalId;
  name: string;
}

export interface Room {
  id: LocalId;
  doctorSideId: LocalId;
  label: string;
  bedCount: number;
}

export interface Bed {
  id: LocalId;
  roomId: LocalId;
  label: string;
  bedNumber: number;
}

export interface Shift {
  id: LocalId;
  floorTemplateId: LocalId;
  floorName: string;
  status: ShiftStatus;
  admittingDoctorSideId: LocalId;
  doctorSides: DoctorSide[];
  rooms: Room[];
  beds: Bed[];
  sideLoadLimits: SideLoadLimits;
  nurses: Nurse[];
  bedStates: BedState[];
  assignmentResult?: AssignmentResult;
  flags: Flag[];
}

export interface SideLoadLimits {
  admitting: LoadLimitRange;
  nonAdmitting: LoadLimitRange;
}

export interface LoadLimitRange {
  min: number;
  max: number;
}

export interface Nurse {
  id: LocalId;
  name: string;
  licenseType: LicenseType;
  experienceLevel: ExperienceLevel;
  maxPatientLoad: number;
}

export interface BedState {
  id: LocalId;
  bedId: LocalId;
  patient?: Patient;
  acuity?: Acuity;
}

export interface Patient {
  initials: string;
  age?: number;
  sex?: Sex;
  diagnosis?: string;
}

export interface AssignmentResult {
  id: LocalId;
  generatedTeams: GeneratedTeam[];
  roomCoverage: RoomCoverage[];
  bedAssignments: BedAssignment[];
}

export interface GeneratedTeam {
  id: LocalId;
  label: string;
  nurseIds: LocalId[];
}

export interface RoomCoverage {
  id: LocalId;
  roomId: LocalId;
  nurseIds: LocalId[];
}

export interface BedAssignment {
  id: LocalId;
  bedId: LocalId;
  nurseId: LocalId;
}

export interface Flag {
  id: LocalId;
  type: FlagType;
  severity: FlagSeverity;
  message: string;
  nurseId?: LocalId;
  roomId?: LocalId;
  bedId?: LocalId;
  teamId?: LocalId;
}

export interface LocalAppState {
  floorTemplates: FloorTemplate[];
  draftFloorTemplate?: FloorTemplate;
  activeShift?: Shift;
}

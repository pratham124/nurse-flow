export type LocalId = string;

export type LicenseType = "RN" | "LPN";

export type ExperienceLevel = "new_grad" | "mid" | "experienced";

export type Acuity = "green" | "yellow" | "red";

export type Sex = "female" | "male" | "other" | "unknown";

export type ShiftStatus = "setup" | "assigned";

export type SimulatedRole = "charge" | "regular_nurse";

export type AuthStatus =
  | "checking"
  | "signed_out"
  | "signed_in"
  | "setup_error"
  | "recovery";

export type UserRole = "charge_nurse";

export type ServerSaveStatus = "idle" | "saving" | "saved" | "error";

export type RealtimeConnectionState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "disconnected"
  | "error";

export type ShiftAccessStatus = "pending_link" | "linked" | "removed";

export type ShiftNurseInviteStatus =
  | "active"
  | "used"
  | "revoked"
  | "expired";

export type NurseRequestStatus = "pending" | "accepted" | "declined";

export type NurseRequestType = "issue" | "swap";

export type NotificationEventType =
  | "issueSubmitted"
  | "swapRequested"
  | "assignmentUpdated"
  | "breakUpdated"
  | "admissionAdded"
  | "patientDischarged"
  | "imbalanceDetected"
  | "bedUnassigned";

export type NotificationEventTargetRoute =
  | "requestDetail"
  | "requestsList"
  | "joinedNurseAssignment"
  | "floorBoard"
  | "flags";

export type NotificationEventStatus =
  | "pending"
  | "sent"
  | "failed"
  | "skipped"
  | "cancelled";

export type FloorActivityLevel = "low" | "moderate" | "high";

export type BreakScheduleStatus =
  | "not_started"
  | "generated"
  | "needs_refresh";

export type BreakWarningType =
  | "no_experienced_nurse_for_side"
  | "overlapping_room_coverage"
  | "missing_assignment_result"
  | "missing_nurse"
  | "unable_to_schedule_break";

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
  startedAt?: string;
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
  nurseRequests?: NurseRequest[];
  breakSchedule?: BreakSchedule;
  carryOverReviewedAt?: string;
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

export interface BreakSchedule {
  status: BreakScheduleStatus;
  shiftStartTime: string;
  activityLevel: FloorActivityLevel;
  generatedAt?: string;
  entries: BreakScheduleEntry[];
  warnings: BreakScheduleWarning[];
}

export interface BreakScheduleEntry {
  id: LocalId;
  nurseId: LocalId;
  nurseName: string;
  startTime: string;
  durationMinutes: number;
  doctorSideIds: LocalId[];
  coveredRoomIds: LocalId[];
  warningIds: LocalId[];
}

export interface BreakScheduleWarning {
  id: LocalId;
  type: BreakWarningType;
  message: string;
  nurseIds: LocalId[];
  doctorSideIds: LocalId[];
  roomIds: LocalId[];
}

export interface NurseRequest {
  id: LocalId;
  type: NurseRequestType;
  status: NurseRequestStatus;
  requestingNurseId: LocalId;
  requestingNurseName: string;
  message: string;
  createdAt: string;
  sourceBedId?: LocalId;
  targetNurseId?: LocalId;
  targetBedId?: LocalId;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface NurseCarryOverSuggestion {
  id: LocalId;
  previousNurseId: LocalId;
  name: string;
  licenseType: LicenseType;
  experienceLevel: ExperienceLevel;
}

export interface PatientCarryOverSuggestion {
  id: LocalId;
  previousBedId: LocalId;
  previousBedLabel: string;
  patient: Patient;
  acuity?: Acuity;
}

export interface PreviousShiftSnapshot {
  id: LocalId;
  floorTemplateId: LocalId;
  completedAt: string;
  nurseSuggestions: NurseCarryOverSuggestion[];
  patientSuggestions: PatientCarryOverSuggestion[];
}

export interface SimulatedSessionState {
  role: SimulatedRole;
  selectedNurseId?: LocalId;
}

export interface UserProfile {
  id: string;
  authUserId: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface FloorTemplateRecord {
  id: string;
  ownerProfileId: string;
  name: string;
  templateSnapshot: FloorTemplate;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveShiftRecord {
  id: string;
  chargeProfileId: string;
  floorTemplateId: string;
  status: ShiftStatus;
  shiftSnapshot: Shift;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}

export interface ServerPreviousShiftSnapshot {
  id: string;
  chargeProfileId: string;
  floorTemplateId: string;
  completedAt: string;
  nurseSuggestions: NurseCarryOverSuggestion[];
  patientSuggestions: PatientCarryOverSuggestion[];
}

export interface ShiftNurseAccess {
  id: string;
  shiftId: string;
  nurseId: LocalId;
  nurseName: string;
  nurseProfileId?: string;
  nurseEmail?: string;
  status: ShiftAccessStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationEventRecord {
  id: string;
  shiftId: string;
  recipientProfileId: string;
  recipientAccessId?: string;
  type: NotificationEventType;
  targetRoute: NotificationEventTargetRoute;
  relatedRequestId?: LocalId;
  relatedBedId?: LocalId;
  title: string;
  body: string;
  status: NotificationEventStatus;
  createdAt: string;
  sentAt?: string;
  failureReason?: string;
}

export interface ShiftNurseInviteRecord {
  id: string;
  shiftId: string;
  nurseId: LocalId;
  createdByProfileId: string;
  tokenHash: string;
  status: ShiftNurseInviteStatus;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  usedByProfileId?: string;
  revokedAt?: string;
}

export interface JoinedNurseAssignedBed {
  bed: Bed;
  bedState?: BedState;
  doctorSide: DoctorSide;
  room: Room;
}

export interface JoinedNurseAssignmentView {
  access: ShiftNurseAccess;
  assignedBeds: JoinedNurseAssignedBed[];
  breakTimeLabel?: string;
  floorName: string;
  nurseName: string;
  requestHistory: NurseRequest[];
  shiftId: string;
}

export interface ServerWorkspace {
  profile: UserProfile;
  floorTemplates: FloorTemplateRecord[];
  activeShift?: ActiveShiftRecord;
  previousShiftSnapshots: ServerPreviousShiftSnapshot[];
}

export type AuthSessionState =
  | {
      errorMessage?: string;
      status: Exclude<AuthStatus, "signed_in">;
    }
  | {
      profile: UserProfile;
      status: "signed_in";
    };

export type NotificationPermissionStatus =
  | "unknown"
  | "granted"
  | "denied"
  | "provisional"
  | "unavailable";

export type DevicePushPlatform = "android" | "ios";

export type DevicePushTokenStatus =
  | "active"
  | "disabled"
  | "expired"
  | "revoked";

export type DevicePushRegistrationState =
  | { status: "idle" | "registering" }
  | { registeredAt: string; status: "registered" }
  | { errorMessage: string; status: "error" };

export interface DevicePushTokenRecord {
  id: string;
  profileId: string;
  deviceId: string;
  platform: DevicePushPlatform;
  pushToken: string;
  status: DevicePushTokenStatus;
  permissionStatus: NotificationPermissionStatus;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

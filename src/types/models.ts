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

export type NurseIssueReviewStatus = "open" | "reviewed" | "resolved";

export type NotificationEventType =
  | "issueSubmitted"
  | "swapRequested"
  | "requestMessageAdded"
  | "requestStatusChanged"
  | "assignmentUpdated"
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
  id: string;
  name: string;
  doctorSides: DoctorSide[];
  rooms: Room[];
  beds: Bed[];
}

export interface DoctorSide {
  id: string;
  name: string;
}

export interface Room {
  id: string;
  doctorSideId: string;
  label: string;
  bedCount: number;
}

export interface Bed {
  id: string;
  roomId: string;
  label: string;
  bedNumber: number;
}

export interface Shift {
  id: string;
  floorTemplateId: string;
  floorName: string;
  startedAt?: string;
  status: ShiftStatus;
  admittingDoctorSideId: string;
  doctorSides: DoctorSide[];
  rooms: Room[];
  beds: Bed[];
  sideLoadLimits: SideLoadLimits;
  nurses: Nurse[];
  bedStates: BedState[];
  assignmentResult?: AssignmentResult;
  flags: Flag[];
  nurseRequests?: NurseRequest[];
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
  id: string;
  name: string;
  licenseType: LicenseType;
  experienceLevel: ExperienceLevel;
  maxPatientLoad: number;
}

export interface BedState {
  id: string;
  bedId: string;
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
  id: string;
  generatedTeams: GeneratedTeam[];
  roomCoverage: RoomCoverage[];
  bedAssignments: BedAssignment[];
}

export interface GeneratedTeam {
  id: string;
  label: string;
  nurseIds: string[];
}

export interface RoomCoverage {
  id: string;
  roomId: string;
  nurseIds: string[];
}

export interface BedAssignment {
  id: string;
  bedId: string;
  nurseId: string;
}

export type OverrideWarningType = Extract<
  FlagType,
  "over_side_load_limit" | "over_max_load" | "team_imbalance"
>;

export interface OverrideWarningAcknowledgementInput {
  id?: string;
  warningType: OverrideWarningType;
  message?: string;
  nurseId?: string;
  bedId?: string;
}

export interface OverrideWarningAcknowledgement {
  id: string;
  warningType: OverrideWarningType;
  message: string;
  nurseId?: string;
  bedId?: string;
  acknowledgedByProfileId: string;
  acknowledgedAt: string;
}

export interface ManualAssignmentOverride {
  id: string;
  shiftId: string;
  baselineAssignmentResultId: string;
  bedId: string;
  fromNurseId: string;
  toNurseId: string;
  createdByProfileId: string;
  createdAt: string;
  status: "active" | "superseded";
  supersededAt?: string;
  serverSequence: number;
  relatedSwapRequestId?: string;
  warningAcknowledgements: OverrideWarningAcknowledgement[];
}

export type ActiveAssignmentOverridesByBedId = Record<
  string,
  ManualAssignmentOverride
>;

export interface Flag {
  id: string;
  type: FlagType;
  severity: FlagSeverity;
  message: string;
  nurseId?: string;
  roomId?: string;
  bedId?: string;
  teamId?: string;
}

export interface NurseRequest {
  id: string;
  type: NurseRequestType;
  status: NurseRequestStatus;
  requestingNurseId: string;
  requestingNurseName: string;
  message: string;
  createdAt: string;
  sourceBedId?: string;
  targetNurseId?: string;
  targetBedId?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  issueReviewStatus?: NurseIssueReviewStatus;
  reviewedAt?: string;
  reviewedByProfileId?: string;
  issueResolvedAt?: string;
  issueResolvedByProfileId?: string;
  swapCompletedAt?: string;
  swapCompletedByProfileId?: string;
  completedOverrideId?: string;
  completedAssignmentChangedLater?: boolean;
}

export interface NurseRequestMessage {
  id: string;
  shiftId: string;
  requestId: string;
  authorProfileId: string;
  body: string;
  createdAt: string;
  clientMutationId?: string;
}

export interface NurseCarryOverSuggestion {
  id: string;
  previousNurseId: string;
  name: string;
  licenseType: LicenseType;
  experienceLevel: ExperienceLevel;
}

export interface PatientCarryOverSuggestion {
  id: string;
  previousBedId: string;
  previousBedLabel: string;
  patient: Patient;
  acuity?: Acuity;
}

export interface PreviousShiftSnapshot {
  id: string;
  floorTemplateId: string;
  completedAt: string;
  nurseSuggestions: NurseCarryOverSuggestion[];
  patientSuggestions: PatientCarryOverSuggestion[];
}

export interface SimulatedSessionState {
  role: SimulatedRole;
  selectedNurseId?: string;
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
  activeAssignmentOverridesByBedId?: ActiveAssignmentOverridesByBedId;
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
  nurseId: string;
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
  relatedRequestId?: string;
  relatedBedId?: string;
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
  nurseId: string;
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

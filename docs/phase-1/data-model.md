# Phase 1 Data Model

This document defines a simple TypeScript-friendly data model for the Phase 1 local charge nurse prototype.

The model is local-first and can live in React state. It can also be saved to local storage later if needed for manual testing, but Phase 1 does not require backend persistence, auth, user accounts, realtime sync, push notifications, deep links, or offline queues.

## Modeling Rules

- Use simple string IDs generated locally.
- Keep data plain and serializable.
- Store template structure separately from active shift state.
- Store patient, acuity, nurse, assignment, and flags on the active shift, not on the reusable floor template.
- Use IDs to connect entities instead of deeply nesting everything.
- If a child object is stored inside its parent, it does not also need the parent's ID.
- Keep future backend fields out of the core Phase 1 model.

## Shared Types

```ts
type LocalId = string;

type LicenseType = 'RN' | 'LPN';

type ExperienceLevel = 'new_grad' | 'mid' | 'experienced';

type Acuity = 'green' | 'yellow' | 'red';

type Sex = 'female' | 'male' | 'other' | 'unknown';

type ShiftStatus = 'setup' | 'assigned';

type FlagSeverity = 'info' | 'warning' | 'critical';

type FlagType =
  | 'validation'
  | 'unassigned_bed'
  | 'no_eligible_coverage'
  | 'rn_required'
  | 'over_side_load_limit'
  | 'over_max_load'
  | 'team_imbalance'
  | 'understaffed';
```

## Floor Template

The floor template stores the reusable unit structure: floor name, two doctor sides, rooms, and generated beds.

```ts
interface FloorTemplate {
  id: LocalId;
  name: string;
  doctorSides: DoctorSide[];
  rooms: Room[];
  beds: Bed[];
}
```

### Relationships

- `FloorTemplate` has exactly two `DoctorSide` records in Phase 1.
- `Room.doctorSideId` points to one doctor side.
- `Bed.roomId` points to one room.

## Doctor Side

Doctor sides are part of a floor template. Phase 1 has exactly two.

```ts
interface DoctorSide {
  id: LocalId;
  name: string;
}
```

## Room

A room belongs to one floor template and one doctor side.

```ts
interface Room {
  id: LocalId;
  doctorSideId: LocalId;
  label: string;
  bedCount: number;
}
```

## Bed

A bed belongs to one room. Beds are generated from the room label and bed count.

```ts
interface Bed {
  id: LocalId;
  roomId: LocalId;
  label: string;
  bedNumber: number;
}
```

Example bed labels:

- `101-1`
- `101-2`

## Shift

The active shift is the local working copy for Phase 1. It references a floor template but owns all shift-specific state.

```ts
interface Shift {
  id: LocalId;
  floorTemplateId: LocalId;
  status: ShiftStatus;
  admittingDoctorSideId: LocalId;
  sideLoadLimits: SideLoadLimits;
  nurses: Nurse[];
  bedStates: BedState[];
  assignmentResult?: AssignmentResult;
  flags: Flag[];
}
```

### Relationships

- `Shift.floorTemplateId` identifies which template the shift started from.
- `Shift.admittingDoctorSideId` points to one of the template's doctor sides.
- `Shift.nurses` stores local shift nurses.
- `Shift.bedStates` stores patient and acuity data for template beds during this shift.
- `Shift.assignmentResult` stores generated assignment output.
- `Shift.flags` stores local warnings and validation problems.

## Side Load Limits

Side load limits are shift-specific defaults. They guide local assignment based on the side a nurse covers.

```ts
interface SideLoadLimits {
  admitting: LoadLimitRange;
  nonAdmitting: LoadLimitRange;
}

interface LoadLimitRange {
  min: number;
  max: number;
}
```

Phase 1 defaults:

- `admitting`: about 4-5 patients.
- `nonAdmitting`: about 6-7 patients.

The charge nurse can override these values for the shift. A nurse's individual `maxPatientLoad` is still the hard cap if lower.

## Nurse

Nurses are shift-specific in Phase 1.

```ts
interface Nurse {
  id: LocalId;
  name: string;
  licenseType: LicenseType;
  experienceLevel: ExperienceLevel;
  maxPatientLoad: number;
}
```

## Bed State

`Bed` is the template location. `BedState` is the active shift data for that bed.

```ts
interface BedState {
  id: LocalId;
  bedId: LocalId;
  patient?: Patient;
  acuity?: Acuity;
}
```

### Rules

- A bed with `patient` is occupied.
- A bed without `patient` is empty.
- Occupied beds require `acuity` before local assignment.
- Empty beds do not require acuity and are not assigned.

## Patient

Patient data is intentionally non-sensitive and simple for Phase 1.

```ts
interface Patient {
  initials: string;
  age?: number;
  sex?: Sex;
  diagnosis?: string;
}
```

### Rules

- `initials` are required for an occupied bed.
- Duplicate initials are allowed.
- `diagnosis` is plain text in Phase 1.
- No medical record numbers, account IDs, or EHR identifiers are included.

## Assignment Result

Assignment is one local action from the charge nurse's point of view. Internally it produces balanced teams, room coverage, bed assignments, and flags.

```ts
interface AssignmentResult {
  id: LocalId;
  generatedTeams: GeneratedTeam[];
  roomCoverage: RoomCoverage[];
  bedAssignments: BedAssignment[];
}
```

## Generated Team

Generated teams are local algorithm output. They are not user accounts or permanent teams.

```ts
interface GeneratedTeam {
  id: LocalId;
  label: string;
  nurseIds: LocalId[];
}
```

### Rules

- Teams are not one-to-one with doctor sides.
- A team can cover rooms from one doctor side or both doctor sides.
- Teams help balance nurse license type, experience level, patient count, and acuity.

## Room Coverage

Room coverage says which nurses are eligible and expected to cover beds in a room.

```ts
interface RoomCoverage {
  id: LocalId;
  roomId: LocalId;
  nurseIds: LocalId[];
}
```

### Rules

- A room can have coverage from more than one nurse.
- Room coverage does not assign every patient in that room to the same nurse.
- Bed assignment decides final patient responsibility.
- Rooms with red critical beds require RN coverage.

## Bed Assignment

Bed assignment is the final patient-to-nurse result.

```ts
interface BedAssignment {
  id: LocalId;
  bedId: LocalId;
  nurseId: LocalId;
}
```

### Rules

- Only occupied beds are assigned.
- Each occupied bed can have at most one assigned nurse.
- A bed can only be assigned to a nurse who appears in that room's `RoomCoverage`.
- LPNs are never assigned red critical beds.
- Nurse `maxPatientLoad` cannot be exceeded by local assignment.

## Flag

Flags are local warnings or validation messages for the charge nurse.

```ts
interface Flag {
  id: LocalId;
  type: FlagType;
  severity: FlagSeverity;
  message: string;
  nurseId?: LocalId;
  roomId?: LocalId;
  bedId?: LocalId;
  teamId?: LocalId;
}
```

### Example Flags

- Occupied bed has no acuity.
- Red critical bed has no eligible RN.
- Occupied bed could not be assigned.
- Nurse is over side-based load limit.
- Nurse would exceed max patient load.
- Generated teams are not balanced by license type, experience level, patient count, or acuity.
- Room has no eligible coverage for occupied beds.
- Total occupied beds exceed total nurse capacity.

## Suggested Local State Shape

This is a simple shape for React state. It avoids backend-style normalization while staying easy to reason about.

```ts
interface NurseFlowPhase1State {
  floorTemplates: FloorTemplate[];
  activeShift?: Shift;
}
```

For a beginner-friendly implementation, it is okay for `Shift` to contain arrays of nurses, bed states, assignment results, and flags. If the arrays become hard to work with, they can be normalized later.

## Relationship Summary

- `FloorTemplate` owns reusable `DoctorSide`, `Room`, and `Bed` structure.
- Each `Room` belongs to one `DoctorSide`.
- Each `Bed` belongs to one `Room`.
- `Shift` starts from one `FloorTemplate`.
- `Shift` owns nurses, bed states, assignment result, and flags.
- `BedState` connects a template bed to shift-specific patient and acuity data.
- `AssignmentResult` contains generated teams, room coverage, and bed assignments.
- `GeneratedTeam` groups nurses for local assignment balancing.
- `RoomCoverage` connects rooms to eligible nurses.
- `BedAssignment` connects one occupied bed to one nurse.
- `Flag` points to whichever entity needs attention.

## Supports Phase 1 Stories

This model supports:

- Creating a floor template.
- Adding rooms and beds.
- Defining exactly two doctor sides.
- Assigning rooms to doctor sides.
- Starting a local shift from a template.
- Selecting an admitting side.
- Overriding side-based nurse load defaults.
- Adding nurses.
- Setting max patient loads.
- Adding patients to beds.
- Setting bed-level acuity.
- Showing census totals.
- Running local assignment.
- Showing the charge nurse floor board.
- Showing imbalance and unassigned-bed flags.
- Editing inputs and re-running assignment.

## Future Phase Notes

These are intentionally not part of the core Phase 1 model:

- User account IDs.
- Auth/session state.
- Backend database IDs.
- Organization or hospital IDs.
- Realtime subscription metadata.
- Invite link tokens.
- Push notification tokens.
- Offline sync queue records.
- Server conflict/version fields.
- Regular nurse role sessions.
- Drag-and-drop override history.
- Break schedules.
- Board snapshot/share records.

# Phase 3 Data Model

This document defines the data model changes for Phase 3 local nurse view simulation.

Phase 3 builds on the Phase 1 model in `docs/phase-1/data-model.md` and the Phase 2 persisted local model in `docs/phase-2/data-model.md`. It keeps templates, active shifts, previous-shift snapshots, nurses, bed states, assignments, and existing flags compatible with earlier phases.

## Modeling Rules

- Preserve the Phase 1 and Phase 2 models unless local nurse simulation requires a small addition.
- Keep all new data plain, serializable, and TypeScript-friendly.
- Model the simulated regular nurse as local state, not a real account.
- Model issue flags and swap requests as local active-shift records.
- Keep mock request records small and readable.
- Do not add backend IDs, account IDs, invite tokens, push tokens, realtime status, sync metadata, offline queue records, break schedules, drag-and-drop override history, or AI fields.

## Shared Types

Phase 3 reuses these existing types:

```ts
type LocalId = string;

type LicenseType = 'RN' | 'LPN';

type ExperienceLevel = 'new_grad' | 'mid' | 'experienced';

type Acuity = 'green' | 'yellow' | 'red';

type ShiftStatus = 'setup' | 'assigned';
```

Phase 3 can add simple simulation-specific types:

```ts
type SimulatedRole = 'charge' | 'regular_nurse';

type NurseRequestStatus = 'pending' | 'accepted' | 'declined';

type NurseRequestType = 'issue' | 'swap';
```

## Simulated Role State

The current simulated role should be local UI state. It does not have to be persisted across app restarts.

```ts
interface SimulatedSessionState {
  role: SimulatedRole;
  selectedNurseId?: LocalId;
}
```

### Rules

- `role: 'charge'` shows the existing charge nurse workflow.
- `role: 'regular_nurse'` shows the selected nurse's local view.
- `selectedNurseId` must reference a nurse in the active shift.
- If the selected nurse is removed, clear `selectedNurseId` and return to charge view or nurse selection.
- This state does not represent login, authorization, or a real session.

## Active Shift Extension

Phase 3 can extend `Shift` with local nurse requests:

```ts
interface Shift {
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
  nurseRequests?: NurseRequest[];
}
```

### Rules

- `nurseRequests` belongs to the active shift.
- It may be optional so restored Phase 1 or Phase 2 shifts remain valid.
- Ending a shift clears active shift request state with the active shift.
- Previous-shift snapshots do not need to carry issue flags or swap requests in Phase 3.

## Nurse Request

`NurseRequest` is a small local record for simulated nurse-to-charge communication.

```ts
interface NurseRequest {
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
```

### Rules

- `requestingNurseName` is stored for display if the nurse is later removed.
- `createdAt` and `resolvedAt` can be ISO date strings for display and debugging.
- `message` stores the issue text or swap reason.
- `sourceBedId` is optional for issue flags and required for swap requests.
- `targetNurseId` and `targetBedId` are optional. Include them only if the UI stays simple.
- `resolutionNote` should stay short and local, such as `Declined locally` or `Accepted for review`.

## Mock Issue Flag

A mock issue flag is a `NurseRequest` with `type: 'issue'`.

```ts
interface MockIssueRequest extends NurseRequest {
  type: 'issue';
  sourceBedId?: LocalId;
}
```

### Rules

- Issue messages must not be blank.
- If `sourceBedId` is present, it must belong to the selected simulated nurse's assigned beds.
- Issue requests do not create push notifications.
- Issue requests can be shown alongside or near existing flags, but they should remain distinguishable from assignment-generated flags.

## Mock Swap Request

A mock swap request is a `NurseRequest` with `type: 'swap'`.

```ts
interface MockSwapRequest extends NurseRequest {
  type: 'swap';
  sourceBedId: LocalId;
  targetNurseId?: LocalId;
  targetBedId?: LocalId;
}
```

### Rules

- Swap requests start with `status: 'pending'`.
- The source bed must be assigned to the selected simulated nurse.
- Accepting or declining updates request status locally.
- Phase 3 does not require automatic patient movement.
- If automatic movement is added, keep it simple, deterministic, and compatible with existing assignment flags.
- Do not add drag-and-drop override records in Phase 3.

## Nurse Assignment View Model

The nurse-facing screen can derive its display data from the active shift and assignment result instead of storing duplicate data.

```ts
interface NurseAssignmentView {
  nurse: Nurse;
  coveredRooms: Room[];
  assignedBeds: NurseAssignedBed[];
  pendingRequests: NurseRequest[];
}

interface NurseAssignedBed {
  bed: Bed;
  room: Room;
  doctorSide: DoctorSide;
  bedState?: BedState;
}
```

### Rules

- Derive `assignedBeds` from `assignmentResult.bedAssignments` filtered by `selectedNurseId`.
- Derive `coveredRooms` from `assignmentResult.roomCoverage` filtered by `selectedNurseId`.
- Join beds to rooms, doctor sides, and bed states for display.
- Do not copy patient or acuity data into a separate nurse-only model.
- If assignment has not been run, the view model should return an empty state instead of crashing.

## Persistence Rules

Phase 2 introduced:

```ts
interface PersistedLocalAppState {
  storageVersion: LocalStorageVersion;
  floorTemplates: FloorTemplate[];
  activeShift?: Shift;
  previousShiftSnapshots: PreviousShiftSnapshot[];
}
```

### Phase 3 Rules

- If `nurseRequests` is stored on `activeShift`, it will persist naturally with the active shift.
- `SimulatedSessionState` does not need to persist.
- Restored shifts with no `nurseRequests` should default to an empty request list.
- Previous-shift snapshots should not include request history in Phase 3.

## Relationship Summary

- The charge nurse still owns the full active shift view.
- The simulated regular nurse view filters the same active shift by `selectedNurseId`.
- `AssignmentResult` remains the source of truth for which beds belong to which nurse.
- `NurseRequest` records represent local mock issue flags and swap requests.
- Request status changes are local active-shift updates.
- No Phase 3 model should imply real users, devices, invitations, notifications, or server persistence.

## Supports Phase 3 Stories

This model supports:

- Switching between charge and simulated regular nurse views.
- Selecting one active-shift nurse for simulation.
- Showing only that nurse's assigned rooms, beds, patients, and acuity.
- Creating local mock issue flags.
- Creating local mock swap requests.
- Showing charge nurse review of local requests.
- Accepting and declining mock swap requests locally.

## Future Phase Notes

These are intentionally not part of the Phase 3 model:

- Authenticated users.
- Real charge nurse and regular nurse role records.
- Nurse invite links or deep link tokens.
- Realtime connection state.
- Push notification delivery records.
- Server-side request IDs.
- Offline write queue entries.
- Break schedules.
- Drag-and-drop override history.
- Multi-device read receipts or presence.


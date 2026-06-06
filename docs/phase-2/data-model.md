# Phase 2 Data Model

This document defines the data model changes for Phase 2 local persistence and reuse.

Phase 2 builds on the Phase 1 model in `docs/phase-1/data-model.md`. It keeps the same core entities for floor templates, shifts, nurses, bed states, patients, assignment results, and flags. The main change is that the local app state can now be serialized to device storage and restored when the app opens.

## Modeling Rules

- Preserve the Phase 1 model unless persistence requires a small addition.
- Keep data plain, serializable, and TypeScript-friendly.
- Store templates separately from active shifts.
- Store previous-shift snapshots separately from active shifts.
- Keep previous-shift data local and minimal.
- Do not add backend IDs, account IDs, sync metadata, push tokens, invite tokens, server versions, or conflict records.
- Prefer one small storage boundary so persistence stays easy to explain.

## Shared Types

Phase 2 reuses the Phase 1 shared types:

```ts
type LocalId = string;

type LicenseType = 'RN' | 'LPN';

type ExperienceLevel = 'new_grad' | 'mid' | 'experienced';

type Acuity = 'green' | 'yellow' | 'red';

type Sex = 'female' | 'male' | 'other' | 'unknown';

type ShiftStatus = 'setup' | 'assigned';
```

Phase 2 can add a tiny storage version number so future migrations are easier to reason about:

```ts
type LocalStorageVersion = 1;
```

## Persisted Local App State

Phase 1 suggested:

```ts
interface LocalAppState {
  floorTemplates: FloorTemplate[];
  activeShift?: Shift;
}
```

Phase 2 expands that shape for persistence:

```ts
interface PersistedLocalAppState {
  storageVersion: LocalStorageVersion;
  floorTemplates: FloorTemplate[];
  activeShift?: Shift;
  previousShiftSnapshots: PreviousShiftSnapshot[];
}
```

### Rules

- `floorTemplates` stores reusable unit structure.
- `activeShift` stores the current local working shift, if one exists.
- `previousShiftSnapshots` stores the most recent completed shift summary for each floor template.
- The app may keep temporary draft UI state outside this persisted shape.
- Invalid persisted data should be handled with a local recovery path instead of crashing.

## Floor Template

Phase 2 uses the Phase 1 `FloorTemplate` unchanged:

```ts
interface FloorTemplate {
  id: LocalId;
  name: string;
  doctorSides: DoctorSide[];
  rooms: Room[];
  beds: Bed[];
}
```

### Persistence Rules

- Floor templates are saved after create or edit.
- Floor templates contain reusable structure only.
- Patient data, nurse data, acuity, assignment results, and flags do not belong on the template.
- Template edits are allowed only outside an active shift in Phase 2.

## Active Shift

Phase 2 uses the Phase 1 `Shift` unchanged for active shift data:

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

### Persistence Rules

- Active shift data is saved locally after meaningful changes.
- Restoring an active shift should restore setup or assigned state.
- Assignment results may be persisted so the board can reopen as it was.
- If restored active shift data references a missing template, show a recovery state.
- Restored data should still pass Phase 1 validation before assignment can run again.

## Previous Shift Snapshot

The previous-shift snapshot is a small local record used only for carry-over suggestions. Suggestions for a new shift come from the most recent ended shift that used the same `floorTemplateId`.

```ts
interface PreviousShiftSnapshot {
  id: LocalId;
  floorTemplateId: LocalId;
  completedAt: string;
  nurseSuggestions: NurseCarryOverSuggestion[];
  patientSuggestions: PatientCarryOverSuggestion[];
}
```

### Rules

- Store only the most recent snapshot per `floorTemplateId` for Phase 2.
- Ignore snapshots from other floor templates when starting a shift.
- `completedAt` can be an ISO date string for display and debugging.
- This is not an audit log, shift history screen, analytics source, backend archive, or sync queue.

## Nurse Carry-Over Suggestion

Nurse suggestions carry over stable profile details only.

```ts
interface NurseCarryOverSuggestion {
  id: LocalId;
  previousNurseId: LocalId;
  name: string;
  licenseType: LicenseType;
  experienceLevel: ExperienceLevel;
}
```

### Rules

- Accepted nurse suggestions create new `Nurse` records in the active shift.
- Accepted nurses get new local IDs for the new shift.
- Generated teams, room coverage, bed assignments, flags, and assignment status do not carry over.
- Max patient load is configured fresh for the new shift.

## Patient Carry-Over Suggestion

Patient suggestions carry over non-sensitive patient details plus previous bed and acuity context.

```ts
interface PatientCarryOverSuggestion {
  id: LocalId;
  previousBedId: LocalId;
  previousBedLabel: string;
  patient: Patient;
  acuity?: Acuity;
}
```

### Rules

- Accepted patient suggestions create or update `BedState` records in the new active shift.
- If `previousBedId` still exists in the selected template, the accepted patient can pre-fill that bed.
- If the previous bed no longer exists, the patient needs a new bed selection before assignment.
- Acuity can carry over as a starting value, but it remains shift-specific.
- Patient suggestions use only Phase 1 patient fields: initials, age, sex, and diagnosis.

## Carry-Over Review State

The accept/dismiss UI needs temporary review state. This does not have to be persisted unless the implementation chooses to autosave unfinished setup.

```ts
type CarryOverDecision = 'pending' | 'accepted' | 'dismissed';

interface CarryOverReviewItem {
  suggestionId: LocalId;
  decision: CarryOverDecision;
}
```

### Rules

- Keep this as screen or setup state when possible.
- Accepted suggestions should be converted into normal active shift data before assignment.
- Dismissed suggestions should not be added to the shift.

## Storage Boundary

Phase 2 should introduce one beginner-friendly storage boundary:

```ts
interface StorageRepository {
  loadAppState(): Promise<PersistedLocalAppState>;
  saveAppState(state: PersistedLocalAppState): Promise<void>;
  clearAppState(): Promise<void>;
}
```

### Rules

- UI and assignment code should not call the storage API directly from many places.
- Storage should serialize and deserialize the persisted app state.
- Storage errors should become local recovery messages, not server-style errors.
- The storage layer should be small enough to explain in one walkthrough.

## Relationship Summary

- `FloorTemplate` remains the reusable floor structure.
- `Shift` remains the active shift working state.
- `PersistedLocalAppState` saves templates, the active shift, and previous-shift snapshots.
- `PreviousShiftSnapshot` belongs to one floor template and only feeds carry-over for that same template.
- Nurse suggestions become new shift nurses only after acceptance.
- Patient suggestions become new shift bed states only after acceptance.
- Carry-over suggestions support setup speed but do not change assignment rules.

## Supports Phase 2 Stories

This model supports:

- Saving floor templates locally.
- Reusing saved templates.
- Editing templates outside active shifts.
- Saving and restoring active shifts.
- Storing the most recent previous shift per template.
- Showing nurse carry-over suggestions.
- Showing patient carry-over suggestions.
- Accepting or dismissing suggestions before assignment.

## Future Phase Notes

These are intentionally not part of the Phase 2 model:

- User account IDs.
- Backend database IDs.
- Auth/session records.
- Organization or hospital IDs.
- Realtime subscription metadata.
- Deep link or invite tokens.
- Push notification tokens.
- Offline write queue records.
- Server conflict/version fields.
- Regular nurse role sessions.
- Break schedules.
- Drag-and-drop override history.
- Board snapshot/share records.

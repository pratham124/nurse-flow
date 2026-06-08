# Phase 4 Data Model

This document defines the data model changes for Phase 4 local break scheduling.

Phase 4 builds on the Phase 1 model in `docs/phase-1/data-model.md`, the Phase 2 persisted local model in `docs/phase-2/data-model.md`, and the Phase 3 local nurse simulation model in `docs/phase-3/data-model.md`. It keeps templates, active shifts, previous-shift snapshots, nurses, bed states, assignment results, flags, and local nurse requests compatible with earlier phases.

## Modeling Rules

- Preserve the Phase 1, Phase 2, and Phase 3 models unless local break scheduling requires a small addition.
- Keep new data plain, serializable, and TypeScript-friendly.
- Model break scheduling as active-shift data, not floor-template data.
- Derive schedule decisions from existing active shift assignment data when possible.
- Keep warnings local and readable.
- Do not add backend IDs, account IDs, invite tokens, push tokens, notification jobs, realtime status, sync metadata, offline queue records, drag-and-drop override history, tablet layout fields, or AI fields.

## Shared Types

Phase 4 reuses these existing concepts:

```ts
type LocalId = string;

type ExperienceLevel = 'new_grad' | 'mid' | 'experienced';

type ShiftStatus = 'setup' | 'assigned';
```

Phase 4 can add break-specific types:

```ts
type FloorActivityLevel = 'low' | 'moderate' | 'high';

type BreakScheduleStatus = 'not_started' | 'generated' | 'needs_refresh';

type BreakWarningType =
  | 'no_experienced_nurse_for_side'
  | 'overlapping_room_coverage'
  | 'missing_assignment_result'
  | 'missing_nurse'
  | 'unable_to_schedule_break';
```

## Active Shift Extension

Phase 4 can extend `Shift` with optional break scheduling state:

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
  breakSchedule?: BreakSchedule;
}
```

### Rules

- `breakSchedule` belongs to the active shift.
- It may be optional so restored Phase 1, Phase 2, or Phase 3 shifts remain valid.
- Saved floor templates do not store break schedules.
- Previous-shift snapshots do not need to carry break schedules in Phase 4.
- Ending a shift clears the active break schedule with the active shift unless a later phase explicitly stores historical break data.

## Break Schedule

`BreakSchedule` stores the charge nurse's local break inputs and generated result.

```ts
interface BreakSchedule {
  status: BreakScheduleStatus;
  shiftStartTime: string;
  activityLevel: FloorActivityLevel;
  generatedAt?: string;
  entries: BreakScheduleEntry[];
  warnings: BreakScheduleWarning[];
}
```

### Rules

- `shiftStartTime` can be a simple local time string for Phase 4, such as `19:00`.
- `activityLevel` controls spacing assumptions, not acuity or assignment rules.
- `entries` contains one suggested break per schedulable nurse.
- `warnings` explains safety rules that could not be satisfied.
- `generatedAt` can be an ISO date string for display and debugging.
- The schedule is deterministic for the same inputs.

## Break Schedule Entry

Each entry represents one nurse's suggested break.

```ts
interface BreakScheduleEntry {
  id: LocalId;
  nurseId: LocalId;
  nurseName: string;
  startTime: string;
  durationMinutes: number;
  doctorSideIds: LocalId[];
  coveredRoomIds: LocalId[];
  warningIds: LocalId[];
}
```

### Rules

- `nurseName` is stored for display if the nurse is later removed.
- `doctorSideIds` and `coveredRoomIds` come from current assignment room coverage at generation time.
- `durationMinutes` should stay simple in Phase 4, such as one default break length for all nurses.
- `warningIds` links the entry to relevant schedule warnings.
- Phase 4 does not need multiple breaks per nurse unless a later task explicitly expands scope.

## Break Schedule Warning

Warnings explain local safety rule tradeoffs.

```ts
interface BreakScheduleWarning {
  id: LocalId;
  type: BreakWarningType;
  message: string;
  nurseIds: LocalId[];
  doctorSideIds: LocalId[];
  roomIds: LocalId[];
}
```

### Rules

- Warnings are local display records, not assignment flags or push notifications.
- Keep messages short enough for the charge nurse to scan.
- Use warnings when a rule cannot be satisfied, not for every normal schedule choice.
- Warnings may point to nurses, doctor sides, rooms, or a combination.

## Derived Break View Models

Break display should derive screen-friendly data instead of copying large shift objects.

```ts
interface ChargeBreakScheduleView {
  status: BreakScheduleStatus;
  shiftStartTime?: string;
  activityLevel?: FloorActivityLevel;
  entries: ChargeBreakEntryView[];
  warnings: BreakScheduleWarning[];
}

interface ChargeBreakEntryView {
  entry: BreakScheduleEntry;
  nurse?: Nurse;
  roomLabels: string[];
  doctorSideNames: string[];
}

interface NurseBreakView {
  breakTimeLabel: string;
  warningMessages: string[];
}
```

### Rules

- Charge views can show every break entry.
- Simulated nurse views show only the selected nurse's break entry.
- Missing schedules should return empty-state labels instead of crashing.
- Missing nurse references should use saved `nurseName` where possible.

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

### Phase 4 Rules

- If `breakSchedule` is stored on `activeShift`, it can persist through the existing local active-shift save and restore path.
- Restored shifts with no `breakSchedule` should default to a `not_started` break schedule view.
- Break schedules should not be copied into saved floor templates.
- Previous-shift snapshots should not include break schedules in Phase 4.
- No server persistence or migration to remote storage belongs in Phase 4.

## Relationship Summary

- The active shift remains the source of truth for today's nurses, assignments, local requests, and break schedule.
- `AssignmentResult.roomCoverage` helps decide which nurses cover the same room zones.
- `Nurse.experienceLevel` helps decide whether at least one experienced nurse remains active per doctor side.
- Charge nurse screens can see the full break schedule.
- Simulated regular nurse screens can see only the selected nurse's break time.
- Break warnings are separate from assignment flags and local nurse requests.

## Supports Phase 4 Stories

This model supports:

- Entering break scheduling inputs.
- Generating deterministic local break suggestions.
- Showing break times on charge nurse board cards.
- Refreshing the local schedule after shift changes.
- Showing one simulated nurse's own break time.
- Preserving previous phase data and behavior.

## Future Phase Notes

These are intentionally not part of the Phase 4 model:

- Authenticated users.
- Server-side break storage.
- Realtime break updates across devices.
- Push notification jobs for upcoming breaks.
- Invite link or deep link records.
- Offline write queue and conflict metadata.
- Drag-and-drop assignment override records.
- Board snapshot sharing records.
- AI scheduling metadata.

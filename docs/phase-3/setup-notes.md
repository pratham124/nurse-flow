# Phase 3 Setup Notes

These notes complete Task 0.2: confirm current app compatibility before Phase 3 implementation begins.

Phase 3 should connect to the existing local app without changing assignment rules. The current app already has local templates, active shifts, saved previous-shift snapshots, assignment results, and assignment-generated flags. The Phase 3 work can build on those pieces instead of introducing accounts, backend state, realtime collaboration, invite links, push notifications, offline queues, break scheduling, drag-and-drop, board sharing, tablet layout, or AI.

## Current Routes

The app currently uses Expo Router with these local screens:

- `src/app/index.tsx` for Local Workspace.
- `src/app/floor-details.tsx`, `src/app/rooms-and-beds.tsx`, `src/app/doctor-sides.tsx`, and `src/app/template-review.tsx` for floor template setup and editing.
- `src/app/start-shift.tsx`, `src/app/carry-over-review.tsx`, `src/app/nurses.tsx`, `src/app/patients-and-acuity.tsx`, and `src/app/assignment-review.tsx` for shift setup.
- `src/app/floor-board.tsx` for the charge nurse board.
- `src/app/flags.tsx` for assignment-generated flags.

### Phase 3 Connection Points

- Add simulated nurse routes later, likely near the existing board and flags routes.
- Add a `View as nurse` entry from `FloorBoardScreen` later, after assignment has run.
- Keep the existing setup routes unchanged until a Phase 3 task specifically needs a small link or status display.
- Keep `APP_SCREEN_NAMES` aligned when new screens are actually implemented.

## Current State Boundary

`LocalStateProvider` owns the local app state and persists these records:

- Saved floor templates.
- The active shift.
- Previous-shift snapshots.

The active shift already contains:

- Nurses.
- Bed states.
- Assignment result.
- Assignment-generated flags.

### Phase 3 Connection Points

- Simulated role selection should be temporary UI state because it only answers who the tester is pretending to view as.
- Nurse assignment display should be derived from `activeShift.assignmentResult`, `activeShift.nurses`, `activeShift.beds`, `activeShift.rooms`, `activeShift.doctorSides`, and `activeShift.bedStates`.
- Do not duplicate patient, acuity, room, or assignment data into a separate nurse-only model.

## Request Record Decision

Mock issue flags and mock swap requests should live on the active shift as an optional `activeShift.nurseRequests` field when Phase 3 reaches the request-model task.

Reasons:

- Requests belong to the active shift being simulated.
- The charge nurse and simulated nurse views both need to read the same request status.
- Active shift persistence can save and restore request state without a new storage system.
- Optional field support keeps older Phase 1 and Phase 2 saved shifts valid.

Do not store mock requests in previous-shift snapshots for Phase 3. Previous-shift snapshots should continue to feed carry-over suggestions only.

## Current Flags Screen

`FlagsScreen` currently reads only `activeShift.flags`, maps assignment-generated flags into rows, and filters by severity.

### Phase 3 Connection Points

- Keep assignment-generated flags working as-is.
- Add local nurse requests as a separate section or clearly labeled rows in a later task.
- Avoid replacing existing flag behavior when mock issue and swap request review is added.

## Assignment Compatibility

Phase 3 should not change deterministic assignment behavior.

The simulated nurse view can read:

- `assignmentResult.bedAssignments` to find beds assigned to the selected nurse.
- `assignmentResult.roomCoverage` to show generated room coverage.
- Existing bed, room, doctor side, bed state, patient, and acuity data for display.

Phase 3 should not change assignment utilities until a future task explicitly asks for a small helper that only derives display data.

## Likely Future Files

These files are likely to change in later Phase 3 tasks:

- `src/types/models.ts` for optional request types and request records.
- `src/store/LocalStateContext.tsx` only if request update helpers are useful.
- `src/screens/FloorBoardScreen.tsx` for a `View as nurse` entry.
- `src/screens/FlagsScreen.tsx` for local request review.
- `src/utils/screenNames.ts` when new screens are implemented.
- New `src/app/*` route files for simulated nurse picker, nurse assignment, issue form, and swap form.
- New `src/screens/*` files for those simulated nurse screens.
- A small helper under `src/utils/` if deriving nurse assignment display data becomes too noisy inside a screen.

## Manual Validation For Task 0.2

- The app structure supports adding simulated nurse screens without changing assignment rules.
- The current state model supports deriving nurse assignment display from the active shift.
- Mock request records should be active-shift data, not separate account or server-like state.
- No implementation code is written for Task 0.2.


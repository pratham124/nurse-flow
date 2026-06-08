# Phase 4 Setup Notes

Phase 4 adds local break scheduling after the existing local assignment workflow is already working. This setup pass confirms where that later work should attach and what should stay unchanged.

## Scope Guardrails

Phase 4 is local break scheduling only.

Include:

- Break schedule state attached to the active shift.
- Local inputs for shift start time and floor activity level.
- Deterministic local break generation.
- Local warnings for scheduling risks.
- Break schedule display on the charge nurse board and simulated nurse view.

Exclude:

- Backend, auth, server persistence, realtime collaboration, nurse invite links, deep links, push notifications, offline sync queues, drag-and-drop assignment override, board snapshot sharing, tablet layout, and AI.

## Current Compatibility Review

Current Phase 3 behavior is centered on one local `activeShift`.

- Routes live under `src/app/`, with screen logic in `src/screens/`.
- `src/store/LocalStateContext.tsx` owns local app state, simulated role state, and active-shift persistence.
- `src/types/models.ts` defines `Shift`, `AssignmentResult`, nurses, rooms, beds, flags, and local nurse requests.
- `src/screens/AssignmentReviewScreen.tsx` generates the assignment result, flags, and `assigned` shift status.
- `src/screens/FloorBoardScreen.tsx` reads `activeShift.assignmentResult`, flags, nurses, rooms, and beds to show the charge nurse board.
- `src/screens/SimulatedNurseAssignmentScreen.tsx` reads one selected nurse's view through `src/utils/nurseAssignmentView.ts`.
- `src/screens/NursesScreen.tsx` changes nurse lists and max patient loads.
- `src/screens/PatientsAndAcuityScreen.tsx` changes patient and acuity state before assignment.
- Local request code stores mock issue and swap requests on `activeShift.nurseRequests`.

## Future Phase 4 Touchpoints

Likely files for later implementation tasks:

- `src/types/models.ts` for serializable break schedule types and optional `Shift.breakSchedule`.
- A new small utility file under `src/utils/` for safe break schedule selectors.
- A new route file under `src/app/` and screen under `src/screens/` for Break Schedule.
- `src/utils/workflowFlows.ts` if Break Schedule becomes part of the board navigation flow.
- `src/screens/AssignmentReviewScreen.tsx`, `src/screens/NursesScreen.tsx`, and any later room coverage mutation path when a generated schedule needs to be marked `needs_refresh`.
- `src/screens/FloorBoardScreen.tsx` for the Break Schedule entry point, board summary status, and nurse break badges.
- `src/screens/SimulatedNurseAssignmentScreen.tsx` for showing only the selected nurse's own break.

## Active Shift Attachment

Break schedule state should attach to `activeShift`, not to saved floor templates or previous-shift snapshots.

Reason:

- Saved floor templates describe reusable room and bed structure.
- Previous-shift snapshots support carry-over suggestions.
- Break schedules depend on the current shift's nurses, assignments, room coverage, shift start time, and activity level.

The future model should use `breakSchedule?: BreakSchedule` on `Shift` so old active shifts without break data still load safely.

## Persistence Compatibility

Active shifts are already saved as plain JSON through `LocalStateContext` and `storageRepository`.

`storageRepository.isPersistedLocalAppState` currently accepts `activeShift` as an object without validating every nested field. That means an optional, plain JSON `breakSchedule` field can be persisted with the active shift without a storage version change for the first Phase 4 model task.

The future break schedule fields should stay serializable:

- strings
- numbers
- booleans
- arrays
- plain objects
- optional fields

Avoid Date instances, functions, class instances, server IDs, account IDs, invite tokens, push tokens, sync metadata, offline queue records, or AI fields.

## Stale Schedule Triggers To Consider Later

Generated break schedules should become stale when the source data changes.

Likely triggers:

- Nurses are added, removed, or their max load/profile changes.
- Assignment is rerun.
- Room coverage changes through a new assignment result.

The first stale-state implementation should mark a schedule as `needs_refresh`; it should not silently regenerate break times.

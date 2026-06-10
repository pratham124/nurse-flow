# Phase 4 Implementation Tasks

This task list builds local break scheduling in small, testable steps.

Phase 4 stays local-only. Do not add backend, auth, server-side persistence, realtime collaboration, nurse invite links, deep links, push notifications, offline sync queues, drag-and-drop assignment override, board snapshot sharing, tablet layout, AI, or complex multi-break scheduling.

Each task should be small enough for one focused Codex session. Each task includes a manual validation check that should be tested before moving on.

Status legend:

- Done
- No marker means not done yet.

## Build Order Summary

1. Confirm Phase 4 scope guardrails.
2. Add break schedule types.
3. Add break schedule defaults and safe selectors.
4. Capture automatic shift start time and derive floor activity locally.
5. Show shift start time and floor activity on the Floor Board.
6. Add deterministic local break generation.
7. Show generated break entries and warnings.
8. Add refresh behavior.
9. Show break badges on the Floor Board.
10. Show own break time in the simulated nurse view.
11. Run a full manual Phase 4 test pass.

## Setup Tasks

### Done Task 0.1: Create Phase 4 Planning Docs

Story coverage: US1, US2, US3, US4, US5, US6

Build:

- Added Phase 4 planning docs for user stories, data model, mobile design, screens, and implementation tasks.
- Confirmed Phase 4 is local break scheduling only, based on `docs/phases.md`.
- Preserved Phase 1 assignment, Phase 2 local persistence, and Phase 3 local nurse simulation behavior in the plan.
- Kept backend, auth, server persistence, realtime, deep links, push notifications, offline sync, drag-and-drop, board sharing, tablet layout, and AI out of Phase 4.

Validation check:

- You can point to `docs/phases.md` and `docs/phase-4/` and explain what Phase 4 includes and excludes before writing feature code.

### Done Task 0.2: Confirm Current App Compatibility

Story coverage: US6

Build:

- Reviewed current Phase 3 routes, state, storage, floor board, simulated nurse view, and local request code.
- Identified likely implementation file touchpoints before writing feature code in `docs/phase-4/setup-notes.md`.
- Confirmed break schedule state should attach to `activeShift`.
- Confirmed existing active-shift persistence can handle an optional plain JSON `breakSchedule` field.

Validation check:

- You can explain which existing files will likely change before implementation starts.
- No implementation code is written in this task.

## Break Schedule Model

### Done Task 1.1: Add Break Schedule Types

Story coverage: US1, US2, US3, US4, US5, US6

Build:

- Add TypeScript types for floor activity level, break schedule status, break schedule, break schedule entry, and break schedule warning.
- Add optional `breakSchedule` to the active shift model.
- Keep all new fields plain and serializable.
- Avoid server IDs, account IDs, invite tokens, push tokens, notification jobs, realtime metadata, sync metadata, offline queue records, and AI fields.

Validation check:

- TypeScript compiles.
- Restored active shifts without `breakSchedule` still load safely.

### Done Task 1.2: Add Break Schedule Defaults and Selectors

Story coverage: US1, US3, US5, US6

Build:

- Add small helpers that return a safe default break schedule view when no schedule exists.
- Add a helper for finding one nurse's break entry.
- Add a helper for finding break warnings attached to a nurse.
- Keep display helpers separate from schedule generation rules.

Validation check:

- A shift with no break schedule shows `Break not scheduled yet.`
- A simulated nurse with no break entry shows a safe missing-break state.

### Done Task 1.3: Mark Schedule as Needing Refresh When Inputs Change

Story coverage: US4, US6

Build:

- Decide the small set of changes that make a generated schedule stale: nurse changes, assignment result changes, or room coverage changes.
- Mark the local break schedule as `needs_refresh` when those changes happen.
- Do not auto-regenerate yet.

Validation check:

- Generate a schedule, then change nurses or rerun assignment.
- Confirm the schedule shows `Needs refresh` without silently changing break times.

## Break Context Inputs

### Done Task 2.1: Capture Shift Start Time Automatically

Story coverage: US1, US2, US4

Build:

- Add a local `startedAt` timestamp when a shift is started from a floor template.
- Keep the field optional so restored older active shifts still load safely.
- Use the timestamp as the default shift start time for break scheduling.
- Do not ask the charge nurse to enter start time manually in Phase 4.

Validation check:

- Starting a shift records a local start timestamp.
- Restored active shifts without `startedAt` still load safely.

### Done Task 2.2: Derive Floor Activity Locally

Story coverage: US1

Build:

- Add a simple local helper that derives `low`, `moderate`, or `high` floor activity from current bed-level acuity.
- Keep the rule deterministic and beginner-readable.
- Do not call AI, backend services, or network APIs.
- Document AI-assisted floor acuity as a later-phase idea only.

Validation check:

- Mostly green acuity derives low activity.
- Red or multiple yellow acuity beds derive moderate or high activity based on the local rule.

### Done Task 2.3: Show Break Context on Floor Board

Story coverage: US1, US2

Build:

- Show shift start time in the Floor Board summary.
- Show locally derived floor activity in the Floor Board summary.
- Preserve existing occupied bed, admitting side, flag, workload, filter, and local nurse simulation behavior.
- Do not add break generation, break entries, warnings, refresh behavior, or nurse-facing break display yet.

Validation check:

- After assignment, the Floor Board shows the shift start time.
- The Floor Board shows low, moderate, or high floor activity from current acuity.

## Break Generation

### Done Task 3.1: Add Deterministic Break Slot Helper

Story coverage: US2

Build:

- Create a small helper that derives staggered break slots from shift start time, nurse count, and activity level.
- Keep the helper deterministic and local.
- Keep the first version simple enough to explain.

Validation check:

- The same shift start time, activity level, and nurse count produce the same break slots.
- Low, moderate, and high activity can produce different spacing if the rule remains easy to explain.

### Done Task 3.2: Add Room-Zone Overlap Checks

Story coverage: US2

Build:

- Use existing assignment room coverage to detect nurses covering overlapping rooms.
- Avoid placing overlapping nurses in the same break window when possible.
- Add a local warning when overlap cannot be avoided.

Validation check:

- Two nurses covering the same room zone are not scheduled at the same time when another option exists.
- If every nurse overlaps, the schedule still generates and shows a warning.

### Done Task 3.3: Add Experienced-Nurse Coverage Checks

Story coverage: US2

Build:

- Use nurse experience level and doctor side coverage to check whether at least one experienced nurse remains active per doctor side when possible.
- Avoid unsafe break windows when another option exists.
- Add a local warning when the rule cannot be satisfied.

Validation check:

- With two experienced nurses on different sides, breaks keep one experienced nurse active per side when possible.
- With no experienced nurse on a side, the schedule shows a warning instead of crashing.

### Done Task 3.4: Save Generated Break Schedule Locally

Story coverage: US2, US4, US6

Build:

- Convert generated slots into break schedule entries.
- Save entries, inputs, generated timestamp, status, and warnings on `activeShift.breakSchedule`.
- Keep bed assignments, patients, nurse requests, templates, and previous-shift snapshots unchanged.

Validation check:

- Generate breaks and confirm a local schedule appears.
- Reopen the app if active shift persistence is enabled and confirm the active shift still loads safely.

## Break Schedule Review

### Task 4.1: Show Generated Break Entries

Story coverage: US2, US4

Build:

- Show break entries sorted by time.
- Include nurse name, break time, experience chip, and compact coverage summary.
- Show missing or stale nurse references safely.

Validation check:

- A shift with at least three nurses shows three break entries sorted by time.
- Removing a nurse after generation does not crash the schedule screen.

### Task 4.2: Show Break Warnings

Story coverage: US2, US3, US4

Build:

- Show local break warnings in a dedicated warning section.
- Link warning rows to affected nurses, doctor sides, or rooms when available.
- Keep warnings separate from assignment flags and local nurse requests.

Validation check:

- A schedule with limited experienced coverage shows an experienced-nurse warning.
- Existing assignment flags still appear only in the Flags flow.

### Task 4.3: Add Refresh Breaks Action

Story coverage: US4

Build:

- Add a `Refresh breaks` action when a schedule exists.
- Use the latest active shift data and existing inputs.
- Replace the previous generated entries and warnings.

Validation check:

- Change nurses or rerun assignment after generation.
- Refresh breaks and confirm entries update from the latest local data.

## Floor Board Integration

### Task 5.1: Add Break Schedule Entry Point to Floor Board

Story coverage: US3

Build:

- Add `Schedule breaks` when no generated schedule exists.
- Add `View breaks` when a generated schedule exists.
- Disable or explain the action before assignment is ready.

Validation check:

- Before assignment, break scheduling is unavailable with a clear message.
- After assignment, the action opens Break Schedule.

### Task 5.2: Add Break Badges to Nurse Cards

Story coverage: US3

Build:

- Show each nurse's scheduled break time on the existing floor board nurse card.
- Show `Break not scheduled` when no entry exists.
- Show a compact warning state when an entry has warning context.

Validation check:

- Generate breaks and confirm each nurse card shows the correct break time.
- Existing load, max load, acuity, assignment flags, and local request indicators still appear.

### Task 5.3: Show Break Status in Board Summary

Story coverage: US3, US4

Build:

- Show break schedule status in the floor board summary.
- Show warning count when warnings exist.
- Show `Needs refresh` when the schedule is stale.

Validation check:

- Generate breaks and confirm the board summary says break scheduling is complete.
- Change nurse or assignment data and confirm the board summary says `Needs refresh`.

## Simulated Nurse Integration

### Task 6.1: Show Own Break Time in Simulated Nurse View

Story coverage: US5

Build:

- Add a compact break summary to the simulated nurse assignment screen.
- Show only the selected nurse's break time.
- Show `Break not scheduled yet` when there is no schedule.

Validation check:

- Select Nurse A and confirm only Nurse A's break appears.
- Select Nurse B and confirm only Nurse B's break appears.

### Task 6.2: Show Own Break Warning in Simulated Nurse View

Story coverage: US5

Build:

- Show a short warning message when the selected nurse's break entry has warning context.
- Keep warnings local and concise.
- Do not show all charge nurse warnings in the simulated nurse view.

Validation check:

- Create a schedule with a nurse-specific warning.
- Confirm only the selected nurse's relevant warning appears.

## Manual Testing Pass

### Task 7.1: Break Input Test

Build:

- No new feature work.
- Manually test shift start time and activity level validation.

Validation check:

- Missing and invalid time values are blocked.
- Low, moderate, and high activity selections are visible and preserved.

### Task 7.2: Break Generation Test

Build:

- No new feature work.
- Manually test deterministic break generation.

Validation check:

- Use at least three nurses.
- Generate breaks twice with the same inputs and confirm the same schedule appears.
- Confirm entries are staggered.

### Task 7.3: Safety Rule Test

Build:

- No new feature work.
- Manually test overlap and experienced-nurse warnings.

Validation check:

- Create overlapping room coverage and confirm same-zone nurses are separated when possible.
- Create a side with no experienced nurse and confirm a warning appears.

### Task 7.4: Floor Board Break Display Test

Build:

- No new feature work.
- Manually test floor board integration.

Validation check:

- Generate breaks.
- Return to the Floor Board.
- Confirm each nurse card shows the correct break time and existing assignment details remain visible.

### Task 7.5: Simulated Nurse Break Display Test

Build:

- No new feature work.
- Manually test the Phase 3 simulated nurse view after Phase 4 changes.

Validation check:

- Select one simulated nurse and confirm only that nurse's break appears.
- Confirm assigned beds, local issue history, and local swap history still appear.

### Task 7.6: Previous Phase Compatibility Test

Build:

- No new feature work.
- Manually test Phase 1, Phase 2, and Phase 3 behavior after Phase 4 changes.

Validation check:

- Create or reuse a saved template.
- Start a shift.
- Accept carry-over suggestions if available.
- Run assignment.
- Submit local issue and swap requests.
- Generate breaks.
- End shift and confirm existing local persistence behavior still works.

### Task 7.7: Local-Only Scope Test

Build:

- No new feature work.
- Review implementation for scope leaks.

Validation check:

- There are no Phase 4 screens, dependencies, or data fields for backend, auth, server persistence, realtime collaboration, invite links, deep links, push notifications, offline sync queues, drag-and-drop assignment override, board sharing, tablet layout, or AI.

### Task 7.8: Beginner Readability Pass

Build:

- Refactor only if needed for clarity.
- Keep break schedule inputs, generation, warnings, board badges, and nurse break display easy to explain.
- Remove abstractions that make local scheduling harder to understand.

Validation check:

- A beginner can explain how the app stores break inputs, generates schedule entries, shows warnings, and displays one nurse's own break.

## Later, Not Phase 4

Save these for future phases:

- Backend, auth, and server-side persistence.
- Real charge nurse and regular nurse accounts.
- Realtime break updates across devices.
- Nurse invite links and deep links.
- Push notifications for upcoming breaks.
- Offline write queue and conflict handling.
- Drag-and-drop assignment override.
- Board snapshot sharing.
- Tablet layout.
- AI-generated schedules after `assignmentResult` exists, using the assigned beds, room coverage, nurse experience, and local acuity context as inputs.
- AI-assisted floor acuity detection from richer clinical context.

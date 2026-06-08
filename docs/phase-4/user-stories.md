# NurseFlow Phase 4 User Stories

These user stories cover Phase 4 only: local break scheduling after the assignment workflow is stable.

Phase 4 preserves the Phase 1 charge nurse assignment workflow, the Phase 2 local persistence and carry-over behavior, and the Phase 3 simulated nurse view and local request behavior. It does not include backend, auth, server-side persistence, realtime collaboration, nurse invite links, deep links, push notifications, offline sync queues, drag-and-drop assignment override, board snapshot sharing, tablet layout, or AI.

Phase source note: `docs/phases.md` defines Phase 4 as Break Scheduling. Backend, auth, and server persistence are planned for Phase 5 in that file.

## Story 1: Enter Break Scheduling Inputs

As a charge nurse, I want to enter the shift start time and floor activity level so NurseFlow can generate break times from the current local shift.

### Acceptance Criteria

- Break scheduling is available only after a shift has nurses and assignment results.
- The charge nurse can enter or confirm a shift start time.
- The charge nurse can choose one floor activity level: `low`, `moderate`, or `high`.
- The chosen inputs are saved on the active shift's local break schedule state.
- Changing inputs does not change floor templates, patients, acuity, room coverage, bed assignments, or local nurse requests.

### Validation and Edge Cases

- If there is no active shift, show a clear empty state instead of break controls.
- If assignment has not run, show `Run assignment before scheduling breaks.`
- If the shift has no nurses, show `Add nurses before scheduling breaks.`
- If the shift start time is missing or invalid, block schedule generation with a clear validation message.
- Do not add account, server, realtime, invite, notification, or sync language.

## Story 2: Generate a Local Break Schedule

As a charge nurse, I want NurseFlow to generate suggested break times locally so I have a starting schedule for the active shift.

### Acceptance Criteria

- The app generates one suggested break time per active-shift nurse.
- Break generation uses the active shift's nurses, doctor sides, generated room coverage, assignment result, shift start time, and activity level.
- Breaks are staggered across the shift.
- Nurses covering the same room zone should not be scheduled for the same break window when possible.
- At least one experienced nurse should remain active per doctor side when possible.
- The result is deterministic: the same inputs produce the same schedule.
- The generated schedule is stored locally on the active shift.

### Validation and Edge Cases

- If the safety rules cannot all be satisfied, generate the safest schedule possible and add local warning flags.
- If there are no experienced nurses for a doctor side, warn that the experienced-nurse rule cannot be met.
- If one nurse covers both doctor sides, account for that nurse in both side coverage checks.
- If every nurse covers overlapping rooms, stagger by time and warn that room-zone separation is limited.
- Do not call AI, network services, backend APIs, realtime channels, or notification services.

## Story 3: Show Break Times on the Charge Nurse Floor Board

As a charge nurse, I want each nurse's break time visible on the floor board so I can review workload and breaks together.

### Acceptance Criteria

- Each nurse card on the charge nurse floor board can show that nurse's suggested break time.
- Break schedule warnings are visible from the floor board summary or nurse card.
- Nurses without a generated break show a clear missing-break state.
- Existing nurse workload, room coverage, acuity, assignment flags, and local request indicators continue to show.
- The charge nurse can navigate from the floor board to the break schedule screen.

### Validation and Edge Cases

- A nurse removed after break generation should not crash the board.
- A break schedule that references a missing nurse should be ignored or flagged as stale.
- Existing Phase 1 imbalance and unassigned-bed flags must remain visible.
- Phase 3 local issue and swap request indicators must remain visible.

## Story 4: Refresh the Break Schedule Locally

As a charge nurse, I want to refresh break suggestions after activity or staffing changes so the schedule matches the current local shift.

### Acceptance Criteria

- The charge nurse can refresh the break schedule from the break schedule screen.
- Refresh uses the latest local shift data.
- Refresh replaces the prior generated break schedule.
- Refresh preserves the selected shift start time and floor activity level unless the charge nurse changes them.
- Refresh does not change bed assignments, patients, local nurse requests, or previous-shift snapshots.

### Validation and Edge Cases

- Refresh after nurse changes should remove breaks for deleted nurses and add breaks for new nurses.
- Refresh after assignment reruns should use the latest room coverage.
- If refresh creates warnings, show them with the new schedule.
- Do not create break history, audit logs, server records, or notification jobs in Phase 4.

## Story 5: Show Each Simulated Nurse Their Own Break Time

As a simulated regular nurse, I want to see my own break time in the local nurse view so the nurse-facing experience includes break information.

### Acceptance Criteria

- The simulated nurse assignment view shows only the selected nurse's break time.
- The simulated nurse view does not show other nurses' break times.
- If no break has been generated, show `Break not scheduled yet.`
- If the selected nurse has a break warning or missing break, show a concise local message.
- Existing assigned rooms, beds, patients, acuity, local issue history, and local swap history still appear.

### Validation and Edge Cases

- If the selected simulated nurse is removed, existing Phase 3 recovery behavior still applies.
- If a break schedule references the selected nurse but the active shift assignment is missing, keep the nurse view safe.
- Do not add real nurse accounts, invite links, connected-device status, or push notification timing.

## Story 6: Preserve Previous Phase Behavior

As a learner building NurseFlow, I want Phase 4 to add breaks without rewriting assignment, persistence, or local nurse simulation so each phase stays understandable.

### Acceptance Criteria

- Phase 1 floor setup, assignment, board, and flags still work.
- Phase 2 saved templates, active shift restore, previous-shift snapshots, and carry-over review still work.
- Phase 3 simulated nurse views and local issue/swap requests still work.
- Break schedule state belongs to the active shift and does not change saved floor templates.
- No new dependency is added unless a clear beginner-friendly reason is documented.

### Validation and Edge Cases

- A restored active shift with no break schedule should still load.
- Ending a shift clears or archives break schedule state only through the existing active-shift lifecycle.
- A fresh app with no saved data should still show the local workspace empty state.
- Phase 4 must not make the app feel like it has real connected nurse devices or server-backed scheduling.

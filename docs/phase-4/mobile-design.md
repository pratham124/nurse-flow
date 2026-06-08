# Phase 4 Mobile Design

This document defines the mobile-first design direction for Phase 4: local break scheduling for the active shift.

Phase 4 should feel like a practical scheduling layer added after assignment. It should help the charge nurse review nurse workload and break timing together without making the product look like it already supports backend storage, realtime collaboration, push notifications, invite links, or multi-device nurse joins.

## Design Goals

- Make break scheduling feel connected to the active assignment result.
- Keep inputs short: shift start time and activity level.
- Show generated break times in the same places nurses are already reviewed.
- Make safety warnings visible but not alarming when the app has generated the best local schedule it can.
- Let the charge nurse refresh the schedule after local changes.
- Preserve the Phase 1, Phase 2, and Phase 3 phone-first design system.

## Visual Direction

Reuse the visual system from:

- `docs/phase-1/mobile-design.md`
- `docs/phase-2/mobile-design.md`
- `docs/phase-3/mobile-design.md`

Continue using compact cards, sticky summaries, status chips, section headers, and bottom action bars. Keep the schedule readable in a one-column phone layout.

Break scheduling states should use plain labels:

- `Breaks`
- `Schedule breaks`
- `Break scheduled`
- `Break not scheduled yet`
- `Needs refresh`
- `Low activity`
- `Moderate activity`
- `High activity`
- `Local schedule`

Avoid future-phase labels:

- Do not use `Notification scheduled`.
- Do not use `Synced`.
- Do not use `Live`.
- Do not use `Connected`.
- Do not use `Invite`.
- Do not use `Server saved`.

## Layout Rules

- Keep the phone layout single-column.
- Keep touch targets at least 44 px tall.
- Use segmented controls or chips for activity level.
- Use a simple time input or picker for shift start time.
- Keep warning messages short and tied to the affected nurse, side, or room zone.
- Use sticky summaries for generated break schedule status and warning count.
- Show break time on nurse cards without crowding assignment details.
- Do not add tablet-specific layouts in Phase 4.

## New or Updated Components

These are design components, not implementation code.

### Break Schedule Entry Point

Purpose:

Let the charge nurse open break scheduling from the floor board after assignment.

Content:

- Action label: `Schedule breaks` or `View breaks`.
- Status chip: `Not scheduled`, `Break scheduled`, or `Needs refresh`.
- Warning count when warnings exist.

Rules:

- Show only when there is an active shift.
- Disable or explain when assignment has not run.
- Do not show notification, sync, or server states.

### Break Input Panel

Purpose:

Collect the minimal inputs needed for local break generation.

Content:

- Shift start time.
- Floor activity level segmented control: `Low`, `Moderate`, `High`.
- Primary action: `Generate breaks`.
- Secondary action: `Back`.

Rules:

- Keep the panel short enough for one-handed use.
- Explain validation with concise inline messages.
- Do not add shift end time, multiple break types, or complex staffing rules in Phase 4 unless a task explicitly calls for it.

### Break Schedule Summary

Purpose:

Show the charge nurse whether the schedule is ready to use.

Content:

- Schedule status.
- Shift start time.
- Activity level.
- Number of nurses scheduled.
- Warning count.
- Last generated time if useful.

Rules:

- Keep summary near the top of the Break Schedule screen.
- Use `Needs refresh` when current shift data changed after generation.

### Break Entry Row

Purpose:

Show one nurse's suggested break.

Content:

- Nurse name.
- RN/LPN and experience chips when space allows.
- Suggested break time.
- Covered doctor sides or room coverage summary.
- Warning chip if this entry has a warning.

Rules:

- Sort by break time.
- Keep time visually prominent.
- Use saved nurse name if the nurse was removed after generation.

### Break Warning Row

Purpose:

Explain a schedule tradeoff.

Content:

- Warning type label.
- Short message.
- Affected nurse, side, or room context when available.

Rules:

- Warnings should explain what the charge nurse needs to know.
- Do not require the charge nurse to resolve every warning before returning to the board.

### Nurse Card Break Badge

Purpose:

Show break time on existing charge nurse floor board nurse cards.

Content:

- `Break 01:30` when scheduled.
- `Break not scheduled` when missing.
- `Break warning` when the nurse's entry has warning context.

Rules:

- Keep the badge small.
- Do not hide load, max load, assignment flags, acuity, room coverage, or local request signals.

### Simulated Nurse Break Summary

Purpose:

Show the selected simulated nurse only their own break time.

Content:

- `Break 01:30` when scheduled.
- `Break not scheduled yet` when no schedule exists.
- Short warning message when the selected nurse has a break warning.

Rules:

- Place near the nurse assignment summary.
- Do not show other nurses' break entries.
- Do not mention push reminders.

## Updated Navigation Model

Phase 4 can keep the Phase 3 stack navigation model with local additions:

1. Local Workspace
2. Floor Template Setup and Template Review
3. Start Shift
4. Carry-Over Review
5. Nurses
6. Patients and Acuity
7. Assignment Review
8. Floor Board
9. Flags / Local Requests
10. Simulated Nurse Picker
11. Simulated Nurse Assignment
12. Mock Issue Form
13. Mock Swap Form
14. Break Schedule

The Break Schedule screen should be reachable from the Floor Board after assignment has run.

## Updated Screens

### Floor Board

Phase 4 Floor Board should continue to show the full charge nurse board.

New behavior:

- Show a `Schedule breaks` action when assignment has run and no schedule exists.
- Show a `View breaks` action when a schedule exists.
- Show break time badges on nurse cards after generation.
- Show a break warning count when warnings exist.

### Break Schedule

Purpose:

Let the charge nurse enter inputs, generate breaks, refresh breaks, and review warnings.

Layout:

- Header: `Breaks`.
- Sticky summary for status, shift start time, activity level, scheduled nurse count, and warnings.
- Input panel when no schedule exists or inputs need editing.
- Break entry list sorted by time.
- Warning section when warnings exist.
- Bottom action bar with `Generate breaks`, `Refresh breaks`, and `Back`.

Empty states:

- `Run assignment before scheduling breaks.`
- `Add nurses before scheduling breaks.`
- `Break not scheduled yet.`

Validation states:

- Missing shift start time: `Enter a shift start time.`
- Invalid shift start time: `Use a valid time.`

### Simulated Nurse Assignment

Purpose:

Show the selected nurse's assignment plus that nurse's own break time.

New behavior:

- Show a compact break summary near the existing nurse assignment summary.
- Show `Break not scheduled yet` if no local schedule exists.
- Show only the selected nurse's break time and warning messages.

## Manual Testing Checks

- Start or restore an assigned shift with at least three nurses.
- Generate breaks with low, moderate, and high activity levels.
- Confirm every active nurse receives one suggested break when possible.
- Confirm break rows are staggered by time.
- Confirm warnings appear when there are not enough experienced nurses to keep one active per side.
- Confirm the Floor Board shows each nurse's break badge.
- Confirm the simulated nurse view shows only the selected nurse's break time.
- Refresh breaks after adding, removing, or changing nurses and confirm the schedule updates locally.
- Confirm existing assignment flags and local nurse requests still appear.
- Reopen the app and confirm a persisted active shift without breaks still loads safely.

## Phase 4 Exclusions In UI

Do not design Phase 4 UI for:

- Login, signup, profile, or account settings.
- Backend or server save states.
- Realtime presence or connected devices.
- Nurse invite links or deep link join screens.
- Push notification setup or upcoming-break reminders.
- Offline queue status.
- Drag-and-drop reassignment.
- Board snapshot sharing.
- Tablet-specific layout.
- AI scheduling suggestions.

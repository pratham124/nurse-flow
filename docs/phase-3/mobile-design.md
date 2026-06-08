# Phase 3 Mobile Design

This document defines the mobile-first design direction for Phase 3: local role switching, simulated regular nurse assignment view, mock issue flags, and mock swap requests.

Phase 3 should feel like a training-mode layer on top of the existing local prototype. It should help the tester understand future regular nurse workflows without making the product look like it already supports real accounts, invite links, push notifications, realtime collaboration, or multiple devices.

## Design Goals

- Make local role simulation obvious and safe.
- Let the charge nurse return to the full board quickly.
- Show regular nurses a focused, read-only assignment view.
- Make mock issue and swap request flows lightweight.
- Keep request review local and understandable.
- Preserve the Phase 1 and Phase 2 phone-first design system.

## Visual Direction

Reuse the visual system from:

- `docs/phase-1/mobile-design.md`
- `docs/phase-2/mobile-design.md`

Continue using compact cards, clear section headers, status chips, sticky summaries, and bottom action bars. Do not introduce a new theme for the nurse view.

Simulation states should use plain labels:

- `Local simulation`
- `Charge nurse`
- `Regular nurse`
- `Viewing as`
- `Mock issue`
- `Mock swap`
- `Pending`
- `Accepted`
- `Declined`

Avoid future-phase labels:

- Do not use `Logged in`.
- Do not use `Invite sent`.
- Do not use `Connected`.
- Do not use `Synced`.
- Do not use `Notification sent`.
- Do not use `Live`.

## Layout Rules

- Keep the phone layout single-column.
- Keep touch targets at least 44 px tall.
- Keep the role switcher compact and visible only when useful.
- Use sticky summaries for the nurse assignment view and request review.
- Use bed cards or rows that can be scanned quickly by room and acuity.
- Use chips for nurse role, license type, experience, room coverage, acuity, and request status.
- Keep forms short enough for one-handed use.
- Do not add tablet-specific layouts in Phase 3.

## New or Updated Components

These are design components, not implementation code.

### Local Role Switcher

Purpose:

Let the tester switch between charge nurse and simulated regular nurse views.

Content:

- Current mode chip: `Charge nurse` or `Regular nurse`.
- `View as nurse` action when an assigned shift has nurses.
- Nurse picker when entering regular nurse mode.
- `Back to charge view` action in regular nurse mode.

Rules:

- Show local simulation language.
- Do not show login, account, invite, or connection labels.
- If no assigned shift exists, hide the switcher or show a disabled state.

### Nurse Picker Row

Purpose:

Choose which active-shift nurse to simulate.

Content:

- Nurse name.
- RN/LPN chip.
- Experience chip.
- Current load summary if assignment has run.

Rules:

- Nurses come from the active shift.
- Selecting a nurse does not create a user account.

### Nurse Assignment Summary

Purpose:

Give the simulated regular nurse immediate context.

Content:

- `Viewing as [Nurse Name]`.
- License and experience chips.
- Assigned bed count.
- Generated room coverage.
- Pending local request count.

Rules:

- Keep this summary sticky or near the top.
- Use `Local simulation` chip to prevent confusion with a real nurse login.

### Nurse Bed Card

Purpose:

Show one assigned bed in the simulated regular nurse view.

Content:

- Room label and bed label.
- Acuity color chip.
- Patient initials, age, sex, and diagnosis when present.
- Empty bed state if no patient is assigned.
- Actions: `Flag issue`, `Request swap`.

Rules:

- Only show beds assigned to the selected nurse.
- Do not show other nurses' beds.
- Keep patient details compact and non-sensitive.

### Mock Issue Form

Purpose:

Let the simulated nurse send a local issue to the charge nurse.

Content:

- Optional selected bed context.
- Short message field.
- Primary action: `Submit mock issue`.
- Secondary action: `Cancel`.

Rules:

- Message is required.
- Bed choices are limited to the selected nurse's assigned beds.
- Submit should feel local, not like a notification send.

### Mock Swap Form

Purpose:

Let the simulated nurse request a local patient swap.

Content:

- Source bed selector from assigned beds.
- Short reason field.
- Optional simple target nurse or target bed selector if it remains understandable.
- Primary action: `Submit mock swap`.
- Secondary action: `Cancel`.

Rules:

- Source bed is required.
- Reason is required.
- Avoid complex reassignment controls.

### Request Review Row

Purpose:

Show charge nurse review items for mock issues and swap requests.

Content:

- Request type chip: `Mock issue` or `Mock swap`.
- Requesting nurse name.
- Bed context when available.
- Message or reason.
- Timestamp.
- Status chip.
- Swap actions: `Accept`, `Decline`.

Rules:

- Issue flags can be informational and do not need accept/decline.
- Swap requests are actionable only while pending.
- Accepted or declined requests remain visible during the active shift.

## Updated Navigation Model

Phase 3 can keep the Phase 2 stack navigation model with local additions:

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

The simulated nurse screens should be reachable only after there is an active assigned shift with nurses.

## Updated Screens

### Floor Board

Phase 3 Floor Board should continue to show the full charge nurse board.

New behavior:

- Show a compact `View as nurse` action when assignment has run.
- Show a local request count if mock issue flags or swap requests exist.
- Keep existing `View flags`, `Re-run`, and `End shift` actions.

### Simulated Nurse Picker

Purpose:

Choose one nurse from the active shift to view locally.

Layout:

- Header: `View as nurse`.
- Local simulation explanation chip.
- Nurse list.
- Back action to Floor Board.

Empty states:

- `Run assignment before opening nurse view.`
- `Add nurses before opening nurse view.`

### Simulated Nurse Assignment

Purpose:

Show the selected nurse's assignment.

Layout:

- Sticky assignment summary.
- Generated room coverage section.
- Assigned bed list grouped by room when useful.
- Local request history for this nurse.
- Bottom or row actions for issue and swap flows.

Empty states:

- `No assigned beds for this nurse yet.`
- `This nurse has no local requests yet.`

### Mock Issue Form

Purpose:

Submit a local issue flag.

Layout:

- Header: `Flag issue`.
- Optional bed selector.
- Message field.
- Bottom action bar.

Validation states:

- Blank message: `Add a short issue description.`
- Invalid bed selection: `Choose one of your assigned beds.`

### Mock Swap Form

Purpose:

Submit a local swap request.

Layout:

- Header: `Request swap`.
- Source bed selector.
- Reason field.
- Optional target selector only if simple.
- Bottom action bar.

Validation states:

- Missing source bed: `Choose the bed you want to swap.`
- Blank reason: `Add a short reason for the request.`

### Flags / Local Requests

Purpose:

Let the charge nurse review existing assignment flags plus Phase 3 mock requests.

Layout:

- Header: `Flags and requests`.
- Existing assignment flag section.
- Mock issue section.
- Mock swap request section.
- Empty state when no flags or requests exist.

User actions:

- View request details.
- Accept pending mock swap request.
- Decline pending mock swap request.
- Return to Floor Board.

## Manual Testing Checks

- Start or restore an assigned shift with at least two nurses and assigned beds.
- Switch from charge nurse view to simulated regular nurse view.
- Select one nurse and confirm only that nurse's assigned beds appear.
- Submit a mock issue for one assigned bed and confirm it appears for charge nurse review.
- Submit a mock swap request and confirm it appears as pending.
- Accept a mock swap request and confirm its status changes to accepted.
- Decline a second mock swap request and confirm its status changes to declined.
- Return to charge nurse board and confirm Phase 1 assignment flags still appear.
- Reopen the app and confirm active shift local data still restores without requiring a simulated role.

## Phase 3 Exclusions In UI

Do not design Phase 3 UI for:

- Login, signup, profile, or account settings.
- Nurse invite links.
- Deep link join screens.
- Push notification settings or delivery.
- Realtime presence or connected devices.
- Backend request queues.
- Offline queue status.
- Break scheduling.
- Drag-and-drop reassignment.
- Board snapshot sharing.
- Tablet-specific layout.
- AI suggestions.


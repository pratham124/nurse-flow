# Phase 3 Screens

This document describes the Phase 3 mobile screens for local nurse view simulation. It is planning and design only, not React Native implementation code.

Each screen should be simple enough to build and test independently. Existing Phase 1 and Phase 2 screens should be updated only where Phase 3 behavior requires it.

## Screen Map

| Screen | Main Stories |
| --- | --- |
| Floor Board | US1, US5, US7 |
| Simulated Nurse Picker | US1, US2 |
| Simulated Nurse Assignment | US2, US3, US4 |
| Mock Issue Form | US3 |
| Mock Swap Form | US4 |
| Flags and Local Requests | US3, US4, US5, US6 |
| Local Request Detail | US5, US6 |

## 1. Floor Board

### Purpose

Keep the charge nurse's full active shift board as the home base and provide entry points into local nurse simulation.

### Layout

- Existing sticky top summary with floor name, census, admitting side, assignment status, and flag count.
- Existing board grouped by doctor side, nurse, rooms, and beds.
- Local request count chip when mock issues or swaps exist.
- Role simulation action: `View as nurse`.
- Existing actions: `Re-run`, `View flags`, `End shift`.

### Components

- Existing board summary.
- Existing nurse workload rows.
- Existing doctor side, room, and bed display.
- Local simulation chip.
- Request count chip.
- Button or row action: `View as nurse`.

### User Actions

- Open simulated nurse picker.
- Open flags and local requests.
- Re-run assignment through existing Phase 1 path.
- End shift through existing Phase 2 persistence behavior.

### Navigation Targets

- `View as nurse` goes to Simulated Nurse Picker.
- `View flags` goes to Flags and Local Requests.
- Existing actions keep their current targets.

### Empty State

- If assignment has not run, do not show `View as nurse`; route the user through Assignment Review first.

### Validation and Error States

- If the active shift has no nurses, disable `View as nurse` with `Add nurses before opening nurse view.`
- If assignment result is missing, disable `View as nurse` with `Run assignment before opening nurse view.`
- Do not show invite, deep link, notification, or connected-device actions.

## 2. Simulated Nurse Picker

### Purpose

Let the tester choose which active-shift nurse to view as locally.

### Layout

- Header: `View as nurse`.
- Local simulation chip.
- Nurse list.
- Back action to Floor Board.

### Components

- Nurse picker rows.
- RN/LPN chip.
- Experience chip.
- Assigned bed count.
- Room coverage summary.

### User Actions

- Select a nurse.
- Return to Floor Board.

### Navigation Targets

- Selecting a nurse goes to Simulated Nurse Assignment.
- Back returns to Floor Board.

### Empty State

- `No nurses available for simulation.`

### Validation and Error States

- If assignment result is missing, show `Run assignment before opening nurse view.`
- If a nurse has no assignments, still allow selection and show an empty assignment state.

## 3. Simulated Nurse Assignment

### Purpose

Show only the selected nurse's local assignment and request history.

### Layout

- Sticky summary: `Viewing as [Nurse Name]`.
- Local simulation chip.
- Nurse profile chips.
- Room coverage summary.
- Assigned bed list grouped by room.
- Local request history for this nurse.
- Actions: `Flag issue`, `Request swap`, `Back to charge view`.

### Components

- Nurse assignment summary.
- Room coverage chips.
- Nurse bed cards.
- Patient summary text.
- Acuity chip.
- Request history rows.
- Bottom action bar or compact actions.

### User Actions

- Review assigned rooms and beds.
- Open Mock Issue Form.
- Open Mock Swap Form.
- Return to Simulated Nurse Picker.
- Return to charge nurse Floor Board.

### Navigation Targets

- `Flag issue` goes to Mock Issue Form.
- `Request swap` goes to Mock Swap Form.
- `Back to charge view` goes to Floor Board.

### Empty State

- `No assigned beds for this nurse yet.`
- `This nurse has no local requests yet.`

### Validation and Error States

- If selected nurse no longer exists, route back to Simulated Nurse Picker.
- If assignment result is missing, route back to Floor Board with a local message.
- Invalid bed assignment references should be skipped safely.

## 4. Mock Issue Form

### Purpose

Let the simulated regular nurse submit a local issue flag for charge nurse review.

### Layout

- Header: `Flag issue`.
- Local simulation chip.
- Optional assigned bed selector.
- Message field.
- Bottom action bar with `Submit mock issue` and `Cancel`.

### Components

- Bed selector limited to selected nurse's assigned beds.
- Text input for issue message.
- Validation message area.
- Primary and secondary buttons.

### User Actions

- Choose an assigned bed, if relevant.
- Enter issue message.
- Submit mock issue.
- Cancel.

### Navigation Targets

- Submit returns to Simulated Nurse Assignment.
- Cancel returns to Simulated Nurse Assignment.

### Empty State

- If the selected nurse has no assigned beds, allow a general issue with no bed context.

### Validation and Error States

- Blank message: `Add a short issue description.`
- Bed not assigned to nurse: `Choose one of your assigned beds.`
- No push notification or network sending state.

## 5. Mock Swap Form

### Purpose

Let the simulated regular nurse submit a local swap request.

### Layout

- Header: `Request swap`.
- Local simulation chip.
- Source bed selector.
- Reason field.
- Optional target selector if simple.
- Bottom action bar with `Submit mock swap` and `Cancel`.

### Components

- Source bed selector.
- Text input for reason.
- Optional nurse or bed selector.
- Validation message area.
- Primary and secondary buttons.

### User Actions

- Choose source bed.
- Enter reason.
- Optionally choose a target nurse or bed.
- Submit mock swap.
- Cancel.

### Navigation Targets

- Submit returns to Simulated Nurse Assignment.
- Cancel returns to Simulated Nurse Assignment.

### Empty State

- If the selected nurse has no assigned beds, show `No assigned beds available for swap requests.`

### Validation and Error States

- Missing source bed: `Choose the bed you want to swap.`
- Blank reason: `Add a short reason for the request.`
- Source bed not assigned to nurse: `Choose one of your assigned beds.`

## 6. Flags and Local Requests

### Purpose

Let the charge nurse review both existing assignment flags and Phase 3 mock nurse requests.

### Layout

- Header: `Flags and requests`.
- Existing assignment flag section.
- Mock issue section.
- Mock swap request section.
- Empty state when there are no items.

### Components

- Existing flag rows.
- Request review rows.
- Request type chips.
- Status chips.
- Accept and decline actions for pending swap requests.

### User Actions

- Review assignment-generated flags.
- Review mock issue requests.
- Accept or decline pending mock swap requests.
- Open request detail if needed.
- Return to Floor Board.

### Navigation Targets

- Back returns to Floor Board.
- Request row can open Local Request Detail if detail is useful.

### Empty State

- `No flags or local requests yet.`

### Validation and Error States

- Swap requests with missing source beds should show `Bed no longer available`.
- Requests from removed nurses should show the saved requester name and disable action.
- Already accepted or declined requests should not show active decision controls.

## 7. Local Request Detail

### Purpose

Show one mock issue or swap request with enough detail for local review.

### Layout

- Header based on type: `Mock issue` or `Mock swap`.
- Request status chip.
- Requesting nurse details.
- Bed context when available.
- Message or reason.
- Created timestamp.
- Resolution details when accepted or declined.
- Swap decision buttons when pending.

### Components

- Status chip.
- Nurse detail row.
- Bed context row.
- Message block.
- Decision buttons.

### User Actions

- Accept pending swap request.
- Decline pending swap request.
- Return to Flags and Local Requests.

### Navigation Targets

- Back returns to Flags and Local Requests.

### Empty State

- Not expected for a valid request.

### Validation and Error States

- If request no longer exists, return to Flags and Local Requests.
- If request is not pending, decision buttons are hidden.

## Build Order Recommendation

1. Add local simulated role and nurse selection planning boundary.
2. Add Simulated Nurse Picker entry from Floor Board.
3. Add Simulated Nurse Assignment using derived active shift data.
4. Add mock issue request records and form.
5. Add mock swap request records and form.
6. Update Flags to show local requests.
7. Add accept and decline status updates for mock swap requests.
8. Run a full Phase 3 manual local simulation test pass.


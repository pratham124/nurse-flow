# Phase 1 Implementation Tasks

This task list builds the local charge nurse prototype in a small, testable order.

Phase 1 stays local-only. Do not add backend, auth, realtime collaboration, push notifications, deep links, regular nurse invite flow, drag-and-drop assignment override, offline sync, AI, break scheduling, board sharing, or tablet layout.

Each task should be small enough for one focused Codex session. Each task includes a validation check that should be manually tested before moving on.

Status legend:

- ✅ Done
- No marker means not done yet.

## Build Order Summary

1. Set up the Phase 1 app shell.
2. Add navigation and static screens.
3. Add the local Phase 1 state shape.
4. Implement floor template stories.
5. Implement shift setup stories.
6. Implement nurse, patient, acuity, and census stories.
7. Implement local assignment.
8. Implement floor board, flags, edits, and re-run.
9. Run a full manual test pass.

## Setup Tasks

### ✅ Task 0.1: Confirm Phase 1 Scope Guardrails

Story coverage: US18

Build:

- Add a short implementation note in the working task or PR description that Phase 1 is local-only.
- Confirm the app has no planned screens for login, invite links, regular nurse join, realtime status, notifications, deep links, drag-and-drop, offline sync, AI, breaks, sharing, or tablet layout.

Validation check:

- You can point to the Phase 1 docs and explain what is included and excluded before writing feature code.

### ✅ Task 0.2: Define Phase 1 Screen List

Story coverage: US1-US18

Build:

- Create the screen names from `docs/phase-1/screens.md`.
- Keep the list simple: Local Workspace, Floor Details, Rooms and Beds, Doctor Sides, Template Review, Start Shift, Nurses, Patients and Acuity, Assignment Review, Floor Board, Flags.
- Do not add future-phase screens.

Validation check:

- The app has a clear screen list that matches the Phase 1 screen map.

### ✅ Task 0.3: Add Basic Visual Tokens

Story coverage: US18

Build:

- Add Phase 1 colors from `docs/phase-1/mobile-design.md`.
- Keep acuity colors separate from brand colors.
- Add basic spacing, radius, and text-size constants if the app does not already have them.

Validation check:

- A static screen can use the burgundy primary action color, the palette tints, and separate green/yellow/red acuity colors.

## Navigation and Static Screens First

### ✅ Task 1.1: Add Local Workspace Static Screen

Story coverage: US1, US18

Build:

- Show the `NurseFlow` title.
- Show `Local charge nurse prototype`.
- Show an empty state for no local floors.
- Add a visible `Create floor` action.

Validation check:

- Opening the app shows the Local Workspace without needing any data, account, network, or setup.

### ✅ Task 1.2: Add Static Floor Template Setup Screens

Story coverage: US1-US6

Build:

- Add Floor Details screen.
- Add Rooms and Beds screen.
- Add Doctor Sides screen.
- Add Template Review screen.
- Include headers, step labels, placeholder form controls, and bottom actions.

Validation check:

- A tester can navigate through the static floor setup path without feature logic.

### ✅ Task 1.3: Add Static Shift Setup Screens

Story coverage: US7-US13

Build:

- Add Start Shift screen.
- Add Nurses screen.
- Add Patients and Acuity screen.
- Include static summaries, placeholder controls, and bottom actions.

Validation check:

- A tester can navigate through the static shift setup path without saved data.

### ✅ Task 1.4: Add Static Assignment and Board Screens

Story coverage: US14-US17

Build:

- Add Assignment Review screen.
- Add Floor Board screen.
- Add Flags screen.
- Include placeholder census, nurse workload rows, room sections, bed pills, and flag rows.

Validation check:

- A tester can reach Assignment Review, Floor Board, and Flags from the navigation flow.

### ✅ Task 1.5: Add Basic Back Navigation

Story coverage: US1-US17

Build:

- Add back actions between setup screens.
- Keep navigation linear for the first implementation.
- Do not add tabs or complex nested navigation yet unless the app already uses them.

Validation check:

- A tester can move forward and backward through every Phase 1 static screen without getting stuck.

## Local State and Data Model Setup

### ✅ Task 2.1: Add Phase 1 Local Types

Story coverage: US1-US18

Build:

- Add TypeScript types from `docs/phase-1/data-model.md`.
- Include FloorTemplate, DoctorSide, Room, Bed, Shift, SideLoadLimits, Nurse, BedState, Patient, AssignmentResult, GeneratedTeam, RoomCoverage, BedAssignment, and Flag.
- Keep the types local-first and plain.

Validation check:

- The app can compile with the Phase 1 types and no backend/auth/user account fields.

### ✅ Task 2.2: Add Simple Local State Container

Story coverage: US1-US18

Build:

- Add a simple state shape with `floorTemplates` and optional `activeShift`.

Validation check:

- The Local Workspace can read an empty floor template list from local app state.

### ✅ Task 2.3: Add Local ID Helper

Story coverage: US1-US18

Build:

- Add a simple local ID helper for Phase 1 entities.
- IDs only need to be unique inside the current local app session.

Validation check:

- Creating mock local objects gives each object a distinct local ID without server IDs.

## User Story Tasks

### ✅ Task 3.1: US1 Floor Name Entry

Build:

- Connect Floor Details to local form state.
- Save a valid floor name into a new FloorTemplate draft.
- Trim leading and trailing spaces.

Validation check:

- Entering `4 North` allows continuing.
- Entering blank or spaces-only text shows `Floor name is required.`

### ✅ Task 3.2: US1 Duplicate Floor Name Validation

Build:

- Check new floor names against existing local floor templates.
- Compare trimmed names.

Validation check:

- If `4 North` exists, entering `4 North` or `4 North` shows a duplicate-name validation message and does not create another template.

### ✅ Task 3.3: US2 Add Room

Build:

- Let the charge nurse add a room label to the draft floor template.
- Show the room in the Rooms and Beds list.

Validation check:

- Adding room `101` displays room `101` in the room list.
- Blank or spaces-only room labels show validation.

### Task 3.4: US2 Remove Room

Build:

- Let the charge nurse remove a room from the draft template.
- Remove that room's generated beds too.

Validation check:

- Removing room `101` also removes beds such as `101-1` and `101-2`.
- If all rooms are removed, continue is disabled or blocked.

### Task 3.5: US2 Duplicate Room Validation

Build:

- Prevent duplicate room labels within the same floor template.
- Compare trimmed labels.

Validation check:

- Adding `101` twice shows a duplicate-room validation message.

### Task 3.6: US3 Bed Count Per Room

Build:

- Add a bed count control to each room.
- Generate bed labels from room label and bed number.

Validation check:

- Room `101` with bed count `2` shows `101-1` and `101-2`.

### Task 3.7: US3 Bed Count Validation

Build:

- Require bed count to be a whole number.
- Prevent values below 1.
- Add a simple Phase 1 upper limit.

Validation check:

- Bed count `0`, negative values, decimals, or very large values show clear validation.

### Task 3.8: US4 Two Doctor Side Names

Build:

- Create exactly two doctor side records for the draft template.
- Let the charge nurse edit both names.

Validation check:

- The Doctor Sides screen always shows two side name fields.
- There is no action to add a third side or remove a side.

### Task 3.9: US4 Doctor Side Name Validation

Build:

- Require both side names.
- Prevent duplicate side names.

Validation check:

- Blank side names show validation.
- Naming both sides `AB Side` shows a duplicate-side validation message.

### Task 3.10: US5 Assign Rooms to Doctor Sides

Build:

- Let each room be assigned to one of the two doctor sides.
- Show room counts by side.

Validation check:

- Each room can be switched between the two sides.
- A room appears under only one side.

### Task 3.11: US5 Missing Side Validation

Build:

- Block template review/confirmation when any room has no doctor side.

Validation check:

- A room without a side shows `Every room needs a doctor side.`

### Task 3.12: US6 Template Review

Build:

- Show floor name, doctor sides, rooms, and generated beds.
- Group rooms by doctor side.
- Add edit actions back to floor details, rooms, and doctor sides.

Validation check:

- A completed template review clearly shows both sides, all rooms, and generated bed labels.

### Task 3.13: US6 Save Template Locally

Build:

- Save a valid completed template into local state.
- Return to Local Workspace or show a `Start shift` action.

Validation check:

- After saving, the template appears on Local Workspace.
- Incomplete templates cannot be saved.

### Task 4.1: US7 Start Shift From Template

Build:

- Start an active local shift from a completed floor template.
- Copy the template's doctor sides, rooms, and beds into shift-ready local state.
- Initialize bed states for template beds.

Validation check:

- Starting a shift creates an active local shift with all template beds represented in bed state.

### Task 4.2: US7 Select Admitting Side

Build:

- Let the charge nurse choose one of the two doctor sides as admitting side.
- Require admitting side before assignment.

Validation check:

- Assignment cannot be reached or run until one doctor side is selected as admitting.

### Task 4.3: US8 Default Side-Based Load Limits

Build:

- Show default admitting-side load range around 4-5.
- Show default non-admitting-only load range around 6-7.

Validation check:

- Starting a shift displays both default load limits clearly.

### Task 4.4: US8 Override Side-Based Load Limits

Build:

- Let the charge nurse override both side-based load limits for the shift.
- Validate values.

Validation check:

- Changing admitting-side or non-admitting-side limits updates active shift state.
- Values below 1 or above the Phase 1 limit show validation.

### Task 5.1: US9 Add Nurse

Build:

- Add nurse name, license type, and experience level controls.
- Add valid nurses to the active shift nurse list.

Validation check:

- Adding `Taylor`, RN, experienced shows that nurse in the nurse list.
- Blank nurse name shows validation.

### Task 5.2: US9 Remove Nurse

Build:

- Let the charge nurse remove a nurse before or after assignment.
- Clear stale assignment results if removing a nurse after assignment.

Validation check:

- Removing a nurse removes them from the list.
- If all nurses are removed, assignment cannot run.

### Task 5.3: US9 Allow Duplicate Nurse Names Safely

Build:

- Allow duplicate nurse names.
- Keep each nurse distinct by local ID and row controls.

Validation check:

- Two nurses named `Sam` can exist and be edited independently.

### Task 5.4: US10 Set Nurse Max Load

Build:

- Add max patient load control for each nurse.
- Store max load on each nurse.

Validation check:

- Each nurse row shows its max load.
- Assignment readiness catches nurses missing max load.

### Task 5.5: US10 Max Load Validation

Build:

- Require max load to be a whole number.
- Prevent values below 1.
- Add a simple Phase 1 upper limit.

Validation check:

- Invalid max load values show clear validation and block assignment.

### Task 6.1: US11 Add Patient To Bed

Build:

- Let the charge nurse add patient initials to a bed.
- Add optional age, sex, and diagnosis fields.
- Mark beds with patient info as occupied.

Validation check:

- Adding initials to bed `101-1` makes it occupied and visible in the census.

### Task 6.2: US11 Patient Validation

Build:

- Require patient initials when a bed is occupied.
- Allow duplicate initials.
- Validate age if provided.

Validation check:

- Blank initials do not count as occupied.
- Two patients with initials `J.S.` are allowed.
- Non-whole-number age shows validation.

### Task 6.3: US11 Remove Patient From Bed

Build:

- Let the charge nurse clear patient info from a bed.
- Treat the bed as empty after patient removal.

Validation check:

- Removing patient info from `101-1` decreases occupied census and removes it from assignment eligibility.

### Task 6.4: US12 Set Bed-Level Acuity

Build:

- Add green, yellow, and red acuity selection for occupied beds.
- Store acuity on bed state, not on template bed.

Validation check:

- An occupied bed can show green, yellow, or red.
- Empty beds do not require acuity.

### Task 6.5: US12 Acuity Validation

Build:

- Block assignment when an occupied bed has no acuity.
- Keep red beds visually obvious.

Validation check:

- An occupied bed with no acuity appears in Assignment Review as a blocker.

### Task 6.6: US13 Census Totals

Build:

- Calculate occupied bed count and total active bed count.
- Show census on Patients and Acuity, Assignment Review, and Floor Board.

Validation check:

- Adding and removing patients updates census immediately.
- Empty beds count toward total but not occupied.

### Task 7.1: US14 Assignment Input Validation

Build:

- Add pre-assignment validation for nurses, max loads, admitting side, side load limits, and occupied-bed acuity.
- Show blockers on Assignment Review.

Validation check:

- Assignment cannot run with no nurses, missing max loads, missing admitting side, invalid load limits, or occupied beds without acuity.

### Task 7.2: US14 Patient Need Summary

Build:

- Calculate occupied bed counts by side and room.
- Calculate acuity mix by side and room.
- Identify red beds requiring RN coverage.

Validation check:

- Assignment Review can display accurate census, red-bed count, and capacity summary from local state.

### Task 7.3: US14 Generate Balanced Teams

Build:

- Generate deterministic nurse teams from nurse license type, experience, max load, side load limits, patient count, and acuity mix.
- Teams must not be one-to-one with doctor sides.

Validation check:

- Running assignment twice with the same inputs produces the same generated teams.
- Teams can contain nurses who cover one or both doctor sides.

### Task 7.4: US14 Generate Room Coverage

Build:

- Generate room coverage from teams.
- Allow a room to have more than one covering nurse when needed.
- Require RN coverage for rooms with red beds when an eligible RN exists.

Validation check:

- A room can show multiple coverage nurses.
- A room with a red bed does not rely on LPN-only coverage when an RN is available.

### Task 7.5: US14 Assign Beds To Nurses

Build:

- Assign occupied beds only.
- Assign red before yellow before green.
- Respect room coverage eligibility.
- Respect nurse max patient load as a hard cap.
- Never assign LPNs to red beds.

Validation check:

- Empty beds are not assigned.
- Red beds are assigned to eligible RNs before lower-acuity beds.
- No nurse exceeds max load.

### Task 7.6: US14 Deterministic Tie-Breakers

Build:

- Add stable tie-breakers for equal candidates.
- Prefer lower acuity load, then lower patient count, then stable nurse order.

Validation check:

- Re-running assignment without input changes produces identical bed assignments.

### Task 7.7: US16 Generate Assignment Flags

Build:

- Generate flags for unassigned occupied beds, no eligible coverage, RN required, over side load limit, over max load, team imbalance, and understaffing.

Validation check:

- Red bed with no RN creates a critical flag.
- Too many occupied beds for total nurse capacity creates a floor-level warning.

### Task 8.1: US15 Basic Floor Board

Build:

- Show the active floor board grouped by doctor side, then room.
- Show room coverage and bed assignments.
- Show occupied, empty, and unassigned beds distinctly.

Validation check:

- A completed assignment can be understood from the board on a phone-sized screen.

### Task 8.2: US15 Nurse Workload Summary

Build:

- Show each nurse's name, license type, experience, generated team, room coverage, current load, and max load.

Validation check:

- A nurse with no assigned beds still appears.
- Current load updates from bed assignments.

### Task 8.3: US15 Admitting Side Highlight

Build:

- Highlight the admitting doctor side on the board.
- Show which nurses are affected by admitting-side load limits when coverage includes admitting-side rooms.

Validation check:

- The admitting side is visually clear without hiding the non-admitting side.

### Task 8.4: US16 Inline Board Flags

Build:

- Show flag chips or banners on affected nurse, room, or bed rows.
- Keep flags non-blocking.

Validation check:

- Unassigned beds and overloaded nurses are visible without opening another screen.

### Task 8.5: US16 Flags Screen

Build:

- Show all local flags in one list.
- Group or filter by severity.
- Add jump actions back to relevant board/setup areas where simple.

Validation check:

- A generated critical RN-required flag appears in Flags and can be traced back to the affected bed.

### Task 8.6: US17 Edit Shift Inputs After Assignment

Build:

- Let the charge nurse return to nurses, load limits, patients, and acuity after assignment.
- Mark assignment as needing re-run when inputs change.

Validation check:

- Changing a nurse from RN to LPN after assignment marks the board as needing re-run.

### Task 8.7: US17 Re-Run Assignment

Build:

- Clear stale generated teams, room coverage, bed assignments, and flags before re-running.
- Replace previous results with new local results.

Validation check:

- Lowering a nurse max load and re-running changes assignments or creates unassigned-bed flags as expected.

## Full Manual Testing Pass

### Task 9.1: Happy Path Test

Build:

- No new feature work.
- Manually test the full path from empty app to floor board.

Validation check:

- Create floor `4 North`.
- Add rooms and beds.
- Define two doctor sides.
- Start a shift.
- Select admitting side.
- Add nurses.
- Add patients.
- Set acuity.
- Run assignment.
- View floor board and flags.

### Task 9.2: Validation Test

Build:

- No new feature work.
- Manually test required fields and invalid values.

Validation check:

- Blank floor name, duplicate floor name, duplicate room, missing doctor side, missing nurse max load, invalid patient age, and missing acuity all show clear validation.

### Task 9.3: Assignment Edge Case Test

Build:

- No new feature work.
- Manually test known assignment edge cases from `docs/phase-1/assignment-algorithm.md`.

Validation check:

- Red bed with only LPNs remains unassigned and flagged.
- Red bed with multiple RNs prefers experienced RN, then mid RN, then new grad RN.
- A room with multiple occupied beds can split patients across nurses.
- A low total nurse capacity creates understaffed or unassigned flags.

### Task 9.4: Local-Only Scope Test

Build:

- No new feature work.
- Review the Phase 1 implementation for scope leaks.

Validation check:

- There are no Phase 1 screens or dependencies for backend, auth, realtime, push notifications, deep links, invite links, drag-and-drop, offline sync, AI, breaks, board sharing, regular nurse devices, or tablet layout.

### Task 9.5: Beginner Readability Pass

Build:

- Refactor only if needed for clarity.
- Keep names close to the data model and user stories.
- Remove confusing abstractions that are not needed for Phase 1.

Validation check:

- A beginner can explain where floor templates, active shift state, nurses, bed states, assignment results, and flags live.

## Later, Not Phase 1

Save these for future phases:

- Local persistence across app restarts.
- Carry-over suggestions from a previous shift.
- Simulated regular nurse view.
- Backend and auth.
- Realtime collaboration.
- Nurse invite links and deep links.
- Push notifications.
- Offline sync.
- Drag-and-drop assignment override.
- Break scheduling.
- Board snapshot sharing.
- Tablet layout.
- AI or external assignment services.

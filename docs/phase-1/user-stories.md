# NurseFlow Phase 1 User Stories

These user stories cover Phase 1 only: a local charge nurse prototype running on one device.

Phase 1 does not include auth, backend, realtime collaboration, push notifications, deep links, drag-and-drop, regular nurse invite flow, offline sync, AI, break scheduling, board sharing, or tablet layout.

## Story 1: Create a Floor Template

As a charge nurse, I want to create a floor template with a name so I can start building the structure of my unit.

### Acceptance Criteria

- The charge nurse can enter a floor name.
- The floor name is required.
- The floor name cannot be only spaces.
- The floor name must be unique among floor templates already created in the current local app session.
- The charge nurse can continue only after entering a valid floor name.
- The created template exists locally in the current app session.

### Validation and Edge Cases

- If the name is blank, show a clear validation message.
- If the name has leading or trailing spaces, trim them before saving.
- If the entered floor name already exists in the current local app session, show a clear validation message and do not create a duplicate template.
- Duplicate checks should compare trimmed names so `4 North` and ` 4 North ` are treated as the same name.
- If the charge nurse edits the name before continuing, the latest valid value is used.

## Story 2: Add Rooms to a Floor Template

As a charge nurse, I want to add rooms to a floor template so the app knows which rooms are on the unit.

### Acceptance Criteria

- The charge nurse can add a room with a room number or room name.
- Each room has a required room label.
- The charge nurse can add multiple rooms.
- The room list shows the rooms that have been added.
- The charge nurse can remove a room before starting the shift.
- The charge nurse can continue only when at least one room exists.

### Validation and Edge Cases

- A room label cannot be blank or only spaces.
- Duplicate room labels are not allowed within the same floor template.
- Removing a room also removes its beds from the template.
- If all rooms are removed, the app returns to an invalid state until at least one room is added.

## Story 3: Add Beds to Rooms

As a charge nurse, I want to define how many beds each room has so every assignable patient location exists in the template.

### Acceptance Criteria

- The charge nurse can set a bed count for each room.
- Each room must have at least one bed.
- Beds are auto-labeled from the room label and bed number, such as `101-1` and `101-2`.
- Updating a room's bed count updates the generated bed list.
- The charge nurse can review each room with its generated beds.

### Validation and Edge Cases

- Bed count must be a whole number.
- Bed count cannot be less than 1.
- Bed count should have a simple upper limit for Phase 1 to prevent accidental huge templates.
- If a room label changes before shift start, generated bed labels update to match.
- Reducing the bed count removes the highest-numbered generated beds first.

## Story 4: Define Two Doctor Sides

As a charge nurse, I want to define two doctor sides so the floor can be grouped the way assignments are usually managed.

### Acceptance Criteria

- The floor template has exactly two doctor sides.
- The charge nurse can name each doctor side, such as `AB Side` and `SK Side`.
- Each doctor side name is required.
- The app shows both doctor sides before local assignment.
- The charge nurse can edit either doctor side name before starting the shift.

### Validation and Edge Cases

- A doctor side name cannot be blank or only spaces.
- The two doctor side names cannot be duplicates.
- The charge nurse cannot add a third doctor side in Phase 1.
- The charge nurse cannot remove either doctor side in Phase 1.
- The charge nurse cannot finish the floor template while rooms are missing doctor side assignments.

## Story 5: Assign Rooms to Doctor Sides

As a charge nurse, I want to assign each room to a doctor side so the floor board can group rooms correctly.

### Acceptance Criteria

- The charge nurse can assign each room to one doctor side.
- A room belongs to exactly one doctor side.
- The app shows which rooms are assigned to each doctor side.
- The charge nurse can change a room's doctor side before starting the shift.
- The floor template can be completed only when every room has a doctor side.

### Validation and Edge Cases

- If a room has no doctor side, show a clear validation message.
- If a doctor side has no rooms, allow it during editing but make it visible in the review.
- Changing a room's doctor side does not change its beds.

## Story 6: Review the Floor Template

As a charge nurse, I want to review the floor template before using it so I can catch setup mistakes.

### Acceptance Criteria

- The review shows the floor name.
- The review groups rooms by doctor side.
- Each room shows its generated beds.
- The charge nurse can go back and edit floor details, rooms, beds, or doctor sides before confirming.
- Confirming the review makes the floor template available for starting a local shift.

### Validation and Edge Cases

- The template cannot be confirmed if it has no rooms.
- The template cannot be confirmed if any room has no beds.
- The template cannot be confirmed if any room is missing a doctor side.
- The review should make empty doctor sides easy to notice.

## Story 7: Start a Local Shift From a Floor Template

As a charge nurse, I want to start a local shift from a floor template so I can manage today's assignments.

### Acceptance Criteria

- The charge nurse can start a shift from the completed floor template.
- The shift copies the template's doctor sides, rooms, and beds into local shift state.
- The shift can have one admitting doctor side selected.
- The admitting side is required before assignment.
- The active shift is local to the current device and current app session.

### Validation and Edge Cases

- A shift cannot start from an incomplete floor template.
- Since Phase 1 uses exactly two doctor sides, one of the two sides must be selected as the admitting side.
- Per-shift changes do not need to update the original template in Phase 1.
- No server, account, invite link, or multi-device behavior is created.

## Story 8: Override Side-Based Nurse Load Defaults

As a charge nurse, I want to override the default nurse patient-load limits based on doctor side coverage so the assignment algorithm matches the staffing reality of the shift.

### Acceptance Criteria

- The app provides a default patient-load limit for nurses covering the admitting side.
- Nurses covering the admitting side default to about 4-5 patients.
- The app provides a default patient-load limit for nurses covering only the non-admitting side.
- Nurses covering only the non-admitting side default to about 6-7 patients.
- The charge nurse can override both default load limits before running local assignment.
- The side-based nurse load limits are used by local assignment.
- Nurse max load remains a hard cap even if the side-based load limit is higher.

### Validation and Edge Cases

- Each side-based nurse load limit must be a whole number or a simple min/max range.
- Side-based nurse load limits cannot be less than 1.
- Side-based nurse load limits should have a simple upper limit for Phase 1 to prevent unrealistic values.
- The admitting-side nurse load limit can be changed, but it should still be clear which side is the admitting side.
- If the admitting-side nurse load limit is set higher than the non-admitting-side nurse load limit, allow it but show the values clearly so the charge nurse can notice.
- Changing side-based nurse load limits after assignment requires re-running local assignment.

## Story 9: Add Nurses to the Shift

As a charge nurse, I want to add nurses to the active shift so the app knows who can receive generated assignment results.

### Acceptance Criteria

- The charge nurse can add a nurse name.
- The charge nurse can choose license type: RN or LPN.
- The charge nurse can choose experience level: new grad, mid, or experienced.
- The shift nurse list shows all added nurses.
- The charge nurse can remove a nurse before running assignment.
- The charge nurse can continue only when at least one nurse exists.

### Validation and Edge Cases

- Nurse name is required and cannot be only spaces.
- Duplicate nurse names should be allowed only if the app can still distinguish the nurses locally.
- If a nurse is removed, any generated team, room coverage, and bed assignments for that nurse are cleared.
- If all nurses are removed, local assignment cannot run.

## Story 10: Set Nurse Max Patient Load

As a charge nurse, I want to set each nurse's max patient load so the assignment algorithms respect staffing limits.

### Acceptance Criteria

- The charge nurse can set a max patient load for each nurse.
- The charge nurse can override any suggested or default max patient load for an individual nurse.
- Max load is required before local assignment.
- Max load is treated as a hard cap during assignment.
- The app shows each nurse's max load.
- The app can flag when total nurse capacity is lower than occupied bed count.

### Validation and Edge Cases

- Max load must be a whole number.
- Max load cannot be less than 1.
- Max load should have a simple upper limit for Phase 1 to prevent accidental unrealistic values.
- If a nurse's max load is lower than the side-based load limit, the nurse's max load still wins.
- If total max load is too low, the app should not fail silently.

## Story 11: Add Patients to Beds

As a charge nurse, I want to add patients to beds so the assignment board reflects the current census before local assignment runs.

### Acceptance Criteria

- The charge nurse can select a bed and add patient initials.
- Multiple patients can have the same initials.
- The charge nurse can enter patient age.
- The charge nurse can enter patient sex.
- The charge nurse can enter one or more diagnoses as plain text.
- A bed with patient info counts as occupied.
- A bed with no patient info counts as empty.
- The charge nurse can edit patient info before assignment.
- The charge nurse can remove patient info from a bed.

### Validation and Edge Cases

- Patient initials are required when adding a patient.
- Patient initials cannot be only spaces.
- Duplicate patient initials are allowed because initials are only display information in Phase 1.
- Age must be a whole number if provided.
- Diagnosis can be simple free text in Phase 1.
- Empty beds should stay visible but should not be assigned as patients.
- Removing patient info updates the census.

## Story 12: Set Bed-Level Acuity

As a charge nurse, I want to set acuity for each occupied bed so local assignment accounts for patient difficulty.

### Acceptance Criteria

- The charge nurse can set acuity on each occupied bed.
- Supported acuity values are green, yellow, and red.
- Green means stable.
- Yellow means moderate.
- Red means critical.
- The app displays the selected acuity for each occupied bed.
- Acuity is part of the active shift, not the reusable floor template.

### Validation and Edge Cases

- Occupied beds require an acuity before local assignment.
- Empty beds do not require acuity.
- Changing a bed from occupied to empty clears or ignores acuity for assignment.
- Rooms with red critical beds require RN room coverage.
- LPNs are not eligible for red critical beds during assignment.

## Story 13: Show Census Totals

As a charge nurse, I want to see occupied and total bed counts so I understand the current shift census before assignment runs.

### Acceptance Criteria

- The app shows occupied bed count.
- The app shows total active bed count.
- Empty beds are included in the total bed count.
- Only beds with patients count as occupied.
- Census updates when patient info is added or removed.

### Validation and Edge Cases

- A floor with zero occupied beds shows `0` occupied without error.
- Census should not count a partially started but invalid patient form as occupied.
- Census should remain local and not imply server sync.

## Story 14: Run Local Assignment

As a charge nurse, I want to run one local assignment process so the app can balance nurses, generate room coverage, and assign occupied beds to eligible nurses.

### Acceptance Criteria

- Assignment runs locally on the device without network access.
- The same shift inputs produce the same assignment results every time.
- Assignment runs after nurses, max loads, patient info, acuity, side-based nurse load limits, and admitting side are set.
- Assignment generates balanced nurse teams.
- Assignment generates room coverage from the balanced teams.
- Assignment assigns occupied beds to eligible nurses from generated room coverage.
- Generated teams are not one-to-one with doctor sides.
- A generated team can cover rooms from one doctor side or both doctor sides if needed.
- A room can have generated coverage from more than one nurse when needed.
- Only occupied beds are assigned.
- A bed can only be assigned to a nurse with generated coverage for that bed's room.
- Each occupied bed is assigned to one nurse when an eligible nurse is available.
- Different beds in the same room can be assigned to different nurses if generated room coverage and nurse limits require it.
- The algorithm considers nurse license type, experience level, and max load.
- The algorithm considers patient info entered for occupied beds.
- The algorithm considers occupied patient count and acuity mix by doctor side and room.
- The algorithm considers which side is the admitting side.
- Nurses whose generated coverage includes admitting-side rooms use the admitting-side load limit, which defaults to about 4-5 patients unless the charge nurse overrides it.
- Nurses whose generated coverage includes only non-admitting-side rooms use the non-admitting-side load limit, which defaults to about 6-7 patients unless the charge nurse overrides it.
- A nurse's manually set max load remains the hard cap even if the side-based load limit is higher.
- LPNs are never assigned red critical beds.
- Nurses are not assigned more patients than their max load.
- Red beds are prioritized before yellow beds.
- Yellow beds are prioritized before green beds.
- Among eligible nurses, the algorithm favors lower current acuity load.
- Assignment details are documented in `docs/phase-1/assignment-algorithm.md`.
- Assignment results are visible on the charge nurse floor board.

### Validation and Edge Cases

- If no nurses exist, assignment cannot run and shows a clear message.
- If any nurse is missing a max load, assignment cannot run and shows a clear message.
- If an occupied bed has no acuity, assignment cannot run or clearly flags the bed.
- Rooms with red critical beds require RN coverage.
- If no eligible RN can cover a red critical bed, the bed remains unassigned and is flagged.
- If no nurse is eligible to cover occupied beds in a room, the room is flagged as having no eligible coverage.
- If no eligible nurse exists for a bed, the bed remains unassigned and is flagged.
- If total occupied beds exceed total max load, some beds may remain unassigned and a floor-level warning appears.
- If there are not enough RNs for red beds, red beds fall back from experienced RN to mid RN to new grad RN before becoming unassigned.
- If staffing is too limited to create balanced teams, the app should generate the best local assignment and show a clear warning.
- The algorithm does not call AI, external APIs, backend services, or realtime services.

## Story 15: Show the Charge Nurse Floor Board

As a charge nurse, I want to see the active shift floor board so I can understand assignments at a glance.

### Acceptance Criteria

- The board is grouped by doctor side.
- Each doctor side shows its rooms.
- Each nurse card shows nurse name, license type, experience level, generated team, generated room coverage, current load, and max load.
- Beds show patient initials when occupied.
- Beds show acuity when occupied.
- Empty beds are visually distinct from occupied beds.
- The admitting side is highlighted.
- Unassigned occupied beds are visible.

### Validation and Edge Cases

- If no assignment has been run yet, the board can still show the floor setup and patient data.
- If a nurse has no assigned beds, the nurse still appears on the board.
- Rooms with mixed acuity should show each bed's own acuity instead of a room-level acuity.
- The board should stay understandable on a phone-sized screen.

## Story 16: Show Imbalance and Unassigned-Bed Flags

As a charge nurse, I want clear flags for unsafe or incomplete assignments so I know what needs attention.

### Acceptance Criteria

- The app flags nurses over their side-based load limit.
- The app flags nurses over max load if that state ever occurs.
- The app flags generated teams that are not balanced by experience level, license type, patient count, or acuity.
- The app flags nurses with no generated room coverage after local assignment.
- The app flags rooms that could not receive generated nurse coverage.
- The app flags occupied beds that remain unassigned.
- The app shows a floor-level warning when staffing capacity is too low for occupied beds.

### Validation and Edge Cases

- Flags should explain the problem in plain language.
- Flags should not block viewing the board.
- Flags update after changing nurses, max load, patients, acuity, or generated assignments.
- An empty bed should not be flagged as unassigned.
- A red bed with no generated RN coverage should be flagged as unassigned because no eligible RN exists.

## Story 17: Edit Phase 1 Shift Inputs and Re-Run Assignment

As a charge nurse, I want to edit local shift inputs and re-run assignment so I can correct mistakes during setup.

### Acceptance Criteria

- The charge nurse can edit nurses before finalizing the local assignment.
- The charge nurse can edit side-based nurse load limits.
- The charge nurse can edit nurse max loads.
- The charge nurse can edit patient info.
- The charge nurse can edit bed acuity.
- The charge nurse can re-run local assignment after edits.
- Updated assignment results replace the previous local results.

### Validation and Edge Cases

- Re-running assignment should clear stale generated teams, room coverage, and bed assignments before creating new results.
- Removing a patient removes that bed from assignment.
- Changing a nurse from RN to LPN can make red beds unassigned.
- Raising a side-based nurse load limit can allow the algorithm to place more patients with nurses on that side.
- Lowering max load can create new unassigned-bed flags.
- No drag-and-drop assignment override is included.

## Story 18: Keep Phase 1 Local-Only

As a learner building NurseFlow, I want Phase 1 to stay local-only so the first prototype remains understandable and testable.

### Acceptance Criteria

- Phase 1 stories do not require user accounts.
- Phase 1 stories do not require a backend.
- Phase 1 stories do not require network access.
- Phase 1 stories do not require realtime subscriptions.
- Phase 1 stories do not require push notifications.
- Phase 1 stories do not require invite links or deep links.
- Phase 1 stories do not require regular nurse devices.
- Phase 1 stories do not require offline sync.
- Phase 1 stories do not require AI.

### Validation and Edge Cases

- If a future feature seems useful while building Phase 1, it should be documented for a later phase instead of implemented.
- Local state is enough for Phase 1 unless a tiny amount of local save behavior is needed for manual testing.
- Any dependency added in Phase 1 should support the local prototype directly and be easy to explain.

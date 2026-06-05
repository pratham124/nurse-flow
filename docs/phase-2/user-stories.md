# NurseFlow Phase 2 User Stories

These user stories cover Phase 2 only: local persistence, reusable floor templates, active-shift restore, and carry-over suggestions from the most recent previous shift that used the same floor template.

Phase 2 preserves the Phase 1 local charge nurse prototype. It does not include backend, auth, server persistence, realtime collaboration, push notifications, deep links, regular nurse invite flow, multi-device collaboration, offline write queue/sync, AI, break scheduling, drag-and-drop assignment override, board sharing, or tablet layout.

## Story 1: Save Floor Templates Locally

As a charge nurse, I want completed floor templates to stay available after closing and reopening the app so I do not have to rebuild my unit each time.

### Acceptance Criteria

- Completed floor templates are saved to local device storage.
- Saved floor templates are loaded when the app opens.
- The Local Workspace shows saved templates after app restart.
- Existing Phase 1 template validation still applies before saving.
- Saved templates keep floor name, doctor sides, rooms, and beds.

### Validation and Edge Cases

- If no templates have been saved, the Local Workspace still shows the no-floor empty state.
- If local storage has invalid or unreadable template data, the app should recover to an empty template list and avoid crashing.
- Saving a template should not save shift-specific patients, acuity, nurses, assignments, or flags onto the template.
- Duplicate floor names should still be prevented against the saved template list.

## Story 2: Reuse a Saved Floor Template

As a charge nurse, I want to start a new shift from a saved floor template so setup begins from the known unit structure.

### Acceptance Criteria

- The charge nurse can choose a saved template from the Local Workspace.
- Starting a shift copies the saved template's doctor sides, rooms, and beds into the active shift.
- The original template remains unchanged by shift-specific setup.
- The Phase 1 shift setup flow still works after selecting a saved template.

### Validation and Edge Cases

- A shift cannot start from an incomplete or corrupted template.
- If a saved template has no rooms or beds, the app should show a local validation message instead of starting a broken shift.
- Per-shift patients, acuity, nurses, load limits, generated assignment, and flags are not written back to the template.

## Story 3: Edit a Floor Template Outside an Active Shift

As a charge nurse, I want to edit a saved floor template when no shift is active so the reusable setup can stay accurate.

### Acceptance Criteria

- The charge nurse can open a saved template for editing from Local Workspace.
- The charge nurse can edit floor name, rooms, bed counts, doctor side names, and room-to-side assignments.
- Existing Phase 1 validation rules still apply.
- Saving edits updates the stored template.
- Template editing is not available while an active shift is in progress.

### Validation and Edge Cases

- Renaming a template must still avoid duplicate saved template names.
- Reducing bed count removes generated beds from the template, following Phase 1 rules.
- Editing a template should not change any active shift because editing is blocked during active shifts.
- If the user cancels or backs out before saving, the saved template should remain unchanged.

## Story 4: Save Active Shift Locally

As a charge nurse, I want the active shift setup and board to survive app close so I can reopen NurseFlow without losing the shift.

### Acceptance Criteria

- Active shift data is saved locally after meaningful changes.
- The saved active shift includes template reference, shift status, admitting side, side load limits, nurses, bed states, assignment result, and flags.
- Reopening the app restores the most recent active shift.
- The restored shift can be viewed from Local Workspace.
- Existing Phase 1 assignment and board behavior still works after restore.

### Validation and Edge Cases

- If no active shift exists, app launch should not create one.
- If saved active shift data is invalid or references a missing template, the app should show a clear local recovery state instead of crashing.
- Restoring an assigned shift should keep the assignment result visible.
- Restoring a setup shift should return the charge nurse to the appropriate setup or review screen.

## Story 5: End and Store a Previous Shift Locally

As a charge nurse, I want ending a shift to preserve a local previous-shift snapshot so the next shift can suggest carry-over nurses and patients.

### Acceptance Criteria

- Ending an active shift stores a previous-shift snapshot locally before clearing the active shift.
- The previous-shift snapshot belongs to the floor template used by that shift.
- The snapshot keeps nurse profile data needed for suggestions.
- The snapshot keeps patient data, previous bed assignment, and previous acuity needed for suggestions.
- Carry-over suggestions are created only from the most recent ended shift for the same floor template.
- Ending the shift clears active-shift working state while leaving saved templates available.

### Validation and Edge Cases

- Ending a shift with no nurses should still be allowed.
- Ending a shift with no patients should still be allowed.
- Only the most recent previous shift per template is required for Phase 2.
- Previous-shift snapshots should not imply shift history, analytics, backend archive, or audit logging.

## Story 6: Show Nurse Carry-Over Suggestions

As a charge nurse, I want to review nurses from the most recent previous shift on this floor template so I can quickly add the nurses who are working again.

### Acceptance Criteria

- When starting a new shift from a template with a previous-shift snapshot for that same template, the app shows nurse suggestions.
- Each nurse suggestion shows name, license type, and experience level.
- The charge nurse can accept or dismiss each nurse suggestion.
- Accepted nurse suggestions become nurses in the new active shift.
- Dismissed nurse suggestions are not added to the new shift.
- The charge nurse can still add new nurses manually.

### Validation and Edge Cases

- Accepted nurses do not carry over generated teams, room coverage, bed assignments, flags, or max patient load.
- Nurse max patient load is configured fresh for the new shift.
- If there is no previous-shift snapshot, the nurse suggestion section should be hidden or show a small empty state.
- Accepting or dismissing a suggestion should be reversible until the new shift setup is confirmed when practical.

## Story 7: Show Patient Carry-Over Suggestions

As a charge nurse, I want to review patients from the most recent previous shift on this floor template so I can keep patients who are still admitted and dismiss those who left.

### Acceptance Criteria

- When starting a new shift from a template with a previous-shift snapshot for that same template, the app shows patient suggestions.
- Each patient suggestion shows initials, age, sex, diagnosis, previous bed, and previous acuity.
- The charge nurse can accept or dismiss each patient suggestion.
- Accepted patient suggestions pre-fill the new shift's bed state when the previous bed still exists.
- Accepted patients can be edited before assignment.
- The charge nurse can still add new patients manually.

### Validation and Edge Cases

- If the previous bed no longer exists on the edited template, the accepted patient should be marked as needing a bed selection.
- Accepted patients carry over acuity as a starting value, but acuity remains shift-specific.
- Dismissed patients are not added to the new shift.
- Patient suggestions use only the non-sensitive Phase 1 patient fields.

## Story 8: Keep Phase 2 Local and Understandable

As a learner building NurseFlow, I want Phase 2 to add persistence without introducing server concepts too early.

### Acceptance Criteria

- Phase 2 uses local device storage only.
- Phase 2 does not require network access.
- Phase 2 does not add accounts, login, backend IDs, realtime status, notifications, invite links, or offline sync queues.
- Phase 2 docs and tasks explain what is saved, restored, and intentionally not saved.
- Phase 2 remains compatible with Phase 1 data and screens.

### Validation and Edge Cases

- If a future feature seems useful while building Phase 2, document it for a later phase instead of adding it.
- Persistence should be implemented through a small storage boundary that a beginner can explain.
- Local persistence should not be described as sync because there is no server or multi-device behavior in Phase 2.

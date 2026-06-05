# Phase 2 Screens

This document describes the Phase 2 mobile screens for local persistence and reuse. It is planning and design only, not React Native implementation code.

Each screen should be simple enough to build and test independently. Existing Phase 1 screens should be updated only where Phase 2 behavior requires it.

## Screen Map

| Screen | Main Stories |
| --- | --- |
| Local Workspace | US1, US2, US3, US4, US8 |
| Template Review and Edit | US1, US3 |
| Start Shift | US2, US6, US7 |
| Carry-Over Review | US6, US7 |
| Nurses | US6 |
| Patients and Acuity | US7 |
| Assignment Review | US4, US7 |
| Floor Board | US4 |
| Local Recovery | US1, US4, US8 |

## 1. Local Workspace

### Purpose

Show saved local templates and provide a clear path to resume an active shift.

### Layout

- Header: `NurseFlow`.
- Local status line: `Saved on this device`.
- Active shift resume row, if an active shift exists.
- Saved floor template list.
- Empty state if no saved templates exist.
- Primary action: `Create floor`.

### Components

- App header.
- Active shift resume row.
- Template row.
- Local status chips.
- Primary button: `Create floor`.
- Row actions: `Start shift`, `Edit`.

### User Actions

- Resume active shift.
- Start a new shift from a saved template.
- Edit a saved template when no shift is active.
- Create a new floor template.

### Navigation Targets

- `Resume` goes to Floor Board for assigned shifts or the relevant setup screen for setup shifts.
- `Start shift` goes to Start Shift.
- `Edit` goes to Template Review and Edit.
- `Create floor` goes to the existing Phase 1 floor setup flow.

### Empty State

- Message: `No local floor yet.`
- Action: `Create floor`.

### Validation and Error States

- If an active shift exists, disable template editing with a local message: `End the active shift before editing templates.`
- If persisted data cannot load, route to Local Recovery.
- No network, account, sync, invite, or notification errors.

## 2. Template Review and Edit

### Purpose

Let the charge nurse review and edit a saved floor template outside an active shift.

### Layout

- Header: `Edit floor` or `Review floor`.
- Summary block with floor name, room count, bed count, and doctor sides.
- Sections grouped by doctor side.
- Edit actions for floor details, rooms, beds, and doctor sides.
- Bottom action bar.

### Components

- Summary counters.
- Doctor side sections.
- Room rows.
- Bed label chips.
- Edit buttons.
- Primary button: `Save changes`.

### User Actions

- Review saved template structure.
- Navigate to edit floor name, rooms, beds, and doctor sides.
- Save changes locally.
- Cancel without saving.

### Navigation Targets

- Edit actions reuse existing Phase 1 setup screens in edit mode.
- `Save changes` returns to Local Workspace.
- `Cancel` returns to Local Workspace without changing saved data.

### Empty State

- Not expected for a valid saved template.

### Validation and Error States

- Existing Phase 1 template validation still applies.
- Duplicate saved floor names are blocked.
- If a saved template is incomplete, show a recovery message and require review before starting a shift.
- Template editing is blocked while an active shift exists.

## 3. Start Shift

### Purpose

Start a new local shift from a saved template and decide whether carry-over review is needed for that same template.

### Layout

- Header: floor name.
- Template summary.
- Admitting side segmented control.
- Side-based load limit controls.
- Previous-shift availability row when present.
- Bottom action bar.

### Components

- Template summary.
- Segmented control for admitting side.
- Number steppers for load limits.
- Previous shift chip.
- Primary button: `Continue`.

### User Actions

- Choose admitting side.
- Review or override side-based load limits.
- Continue to carry-over review or nurses.

### Navigation Targets

- If a previous-shift snapshot exists for the selected template, `Continue` goes to Carry-Over Review.
- If no previous-shift snapshot exists for the selected template, `Continue` goes to Nurses.
- Back returns to Local Workspace.

### Empty State

- If no saved template exists, route back to Local Workspace with `Create a floor template before starting a shift`.

### Validation and Error States

- Missing admitting side: `Choose the admitting side for this shift.`
- Invalid load limit values use existing Phase 1 validation.
- If the saved template is invalid, show Local Recovery instead of starting a shift.

## 4. Carry-Over Review

### Purpose

Let the charge nurse accept or dismiss nurses and patients from the most recent previous shift for the same floor template before continuing setup.

### Layout

- Header: `Review carry-over`.
- Sticky summary with floor name and previous shift timestamp.
- Nurse suggestions section.
- Patient suggestions section.
- Bottom action bar.

### Components

- Suggestion section headers.
- Nurse suggestion rows.
- Patient suggestion rows.
- Accept/dismiss decision controls.
- Status chips: `Accepted`, `Dismissed`, `Needs bed`.
- Primary button: `Continue`.

### User Actions

- Accept nurse suggestion.
- Dismiss nurse suggestion.
- Accept patient suggestion.
- Dismiss patient suggestion.
- Continue setup.

### Navigation Targets

- `Continue` goes to Nurses.
- Back returns to Start Shift.

### Empty State

- If no nurse or patient suggestions exist for this template, show `No previous shift suggestions for this floor.`

### Validation and Error States

- Accepted patients whose previous bed no longer exists show `Needs bed`.
- `Needs bed` does not block this screen, but it must be resolved before assignment.
- No future-phase notification or nurse invite UI appears.

## 5. Nurses

### Purpose

Show accepted nurse carry-over suggestions as editable shift nurses and allow adding new nurses.

### Layout

- Header with shift context.
- Nurse list.
- Accepted carry-over nurses mixed into the regular nurse list.
- Add-nurse form.
- Capacity summary.
- Bottom action bar.

### Components

- Nurse row.
- RN/LPN segmented control.
- Experience segmented control.
- Max patient load stepper.
- Carry-over chip when useful.
- Remove action.

### User Actions

- Edit accepted nurse details.
- Set max patient load.
- Remove accepted nurse if needed.
- Add new nurse manually.
- Continue to Patients and Acuity.

### Navigation Targets

- `Continue` goes to Patients and Acuity.
- Back returns to Carry-Over Review if it was shown, otherwise Start Shift.

### Empty State

- Message: `Add nurses for this shift.`

### Validation and Error States

- Existing Phase 1 nurse validation still applies.
- Accepted nurses still require max patient load before assignment.
- Generated teams and room coverage are not shown because they do not carry over.

## 6. Patients and Acuity

### Purpose

Show accepted patient carry-over suggestions as editable bed states and allow new patient entry.

### Layout

- Sticky census summary.
- Rooms grouped by doctor side.
- Bed rows.
- Accepted carry-over patients pre-filled where possible.
- Section for accepted patients needing a new bed, if any.
- Bottom action bar.

### Components

- Census counter.
- Room section header.
- Bed row.
- Patient fields.
- Acuity segmented control.
- Carry-over chip.
- Missing bed row.

### User Actions

- Review accepted patient information.
- Edit patient initials, age, sex, diagnosis, and acuity.
- Assign a carried-over patient to a new bed if the previous bed is missing.
- Add new patients manually.
- Remove patient info from a bed.

### Navigation Targets

- `Review assignment` goes to Assignment Review.
- Back returns to Nurses.

### Empty State

- If no occupied beds: `No occupied beds yet.`
- If accepted patient has no valid bed: `Choose a bed for this carried-over patient.`

### Validation and Error States

- Existing Phase 1 patient and acuity validation still applies.
- Accepted patients with missing beds block assignment until resolved or dismissed.
- Carried-over acuity is editable and remains shift-specific.

## 7. Assignment Review

### Purpose

Confirm the restored or newly built active shift is ready for local assignment.

### Layout

- Header: `Assignment review`.
- Sticky summary with census, nurse count, total capacity, admitting side, and flag count.
- Readiness checklist.
- Carry-over warnings if any accepted patient still needs review.
- Bottom action bar.

### Components

- Summary counters.
- Checklist rows.
- Warning banners.
- Nurse capacity rows.
- Red-bed list.
- Primary button: `Run local assignment`.

### User Actions

- Review readiness.
- Jump back to fix nurses, patients, acuity, or bed selections.
- Run local assignment.

### Navigation Targets

- Successful assignment goes to Floor Board.
- Edit actions go back to relevant setup screens.

### Empty State

- Same as Phase 1: a no-patient shift may show floor structure if validation allows it.

### Validation and Error States

- Existing Phase 1 assignment validation still applies.
- Accepted carried-over patients with missing beds are blockers.
- Restored active shift data should be validated before re-running assignment.

## 8. Floor Board

### Purpose

Show a restored or newly assigned active shift floor board.

### Layout

- Sticky top summary with floor name, census, admitting side, assignment status, and flag count.
- Local status chip: `Saved locally` or `Restored`.
- Existing Phase 1 board grouping by doctor side, room, and bed.
- Existing nurse workload summary and flags.

### Components

- Summary counters.
- Local status chip.
- Filter chips.
- Nurse workload row.
- Doctor side header.
- Room section.
- Bed pill.
- Inline flag chips.
- Actions: `Re-run`, `View flags`, `End shift`.

### User Actions

- Resume viewing a restored board.
- Re-run local assignment after setup edits if supported.
- End shift to create previous-shift snapshot.
- View flags.

### Navigation Targets

- `End shift` returns to Local Workspace after confirmation.
- `View flags` goes to Flags.
- `Re-run` goes to Assignment Review or runs after validation.

### Empty State

- If restored active shift has no assignment, show setup state and route to Assignment Review or setup screens.

### Validation and Error States

- If restored shift references missing template data, route to Local Recovery.
- No sync, account, or collaboration indicators.

## 9. Local Recovery

### Purpose

Give the charge nurse a safe local path when saved data cannot be restored.

### Layout

- Header: `Local data needs review`.
- One plain-language recovery message.
- Affected data summary when possible.
- Local actions.

### Components

- Recovery banner.
- Summary row.
- Primary action.
- Secondary action.

### User Actions

- Return to Local Workspace.
- Start from saved templates if they are valid.
- Clear invalid active shift only if needed and confirmed.

### Navigation Targets

- Return to Local Workspace.
- Open Template Review and Edit for invalid templates.

### Empty State

- Not applicable.

### Validation and Error States

- Keep messages local and understandable.
- Do not mention server conflict, account recovery, sync repair, or cloud backup.

## Build Order Recommendation

1. Update Local Workspace for saved templates and active shift restore.
2. Add the storage boundary and persisted state loading.
3. Save and restore floor templates.
4. Add template edit outside active shifts.
5. Save and restore active shifts.
6. Create previous-shift snapshots when ending shifts.
7. Add Carry-Over Review.
8. Connect accepted nurse suggestions to Nurses.
9. Connect accepted patient suggestions to Patients and Acuity.
10. Run a full Phase 2 manual persistence and carry-over test pass.

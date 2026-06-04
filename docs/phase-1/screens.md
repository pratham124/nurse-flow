# Phase 1 Screens

This document describes the Phase 1 mobile screens for the local charge nurse prototype. It is planning and design only, not React Native implementation code.

Each screen should be simple enough to build and test independently.

## Screen Map

| Screen | Main Stories |
| --- | --- |
| Local Workspace | US1, US18 |
| Floor Details | US1 |
| Rooms and Beds | US2, US3 |
| Doctor Sides | US4, US5 |
| Template Review | US6 |
| Start Shift | US7, US8 |
| Nurses | US9, US10 |
| Patients and Acuity | US11, US12, US13 |
| Assignment Review | US13, US14, US16 |
| Floor Board | US15, US16, US17 |
| Flags | US16, US17 |

## 1. Local Workspace

### Purpose

Give the charge nurse a local starting point for Phase 1. This screen should make it clear that the prototype is local to the current device/app session.

### Layout

- Header: `NurseFlow`.
- Short local status line: `Local charge nurse prototype`.
- Primary section for floor templates.
- Empty state if no templates exist.
- If a shift exists in local state, show an active shift entry above templates.

### Components

- App header.
- Floor template list rows.
- Active shift row.
- Primary button: `Create floor`.
- Secondary button on completed templates: `Start shift`.

### User Actions

- Create a new floor template.
- Open an existing local floor template.
- Start a local shift from a completed template.
- Return to an active local shift if one exists.

### Navigation Targets

- `Create floor` goes to Floor Details.
- Completed template row goes to Template Review.
- `Start shift` goes to Start Shift.
- Active shift row goes to Floor Board or Shift Setup depending on assignment status.

### Empty State

- Message: `No local floor yet.`
- Action: `Create floor`.

### Validation and Error States

- If a template is incomplete, show `Finish setup` instead of `Start shift`.
- No network, account, sync, invite, or notification error states.

## 2. Floor Details

### Purpose

Capture the floor name before rooms and beds are created.

### Layout

- Header with back button.
- Step indicator with `Floor` active.
- Single input section for floor name.
- Bottom action bar.

### Components

- Text input: floor name.
- Inline validation message.
- Primary button: `Continue`.

### User Actions

- Enter a floor name.
- Continue to room setup.
- Go back to Local Workspace.

### Navigation Targets

- Valid `Continue` goes to Rooms and Beds.
- Back returns to Local Workspace.

### Empty State

- The empty input is the default state.

### Validation and Error States

- Blank name: `Floor name is required.`
- Spaces-only name: `Floor name is required.`
- Duplicate trimmed name: `This floor name already exists.`
- Leading/trailing spaces are trimmed before saving.

## 3. Rooms and Beds

### Purpose

Let the charge nurse create rooms and define each room's bed count.

### Layout

- Header: floor name.
- Step indicator with `Rooms` active.
- Add-room form at top.
- Room list below.
- Each room row shows label, bed count stepper, generated bed labels, and remove action.
- Bottom action bar.

### Components

- Text input: room label.
- Button: add room.
- Room row.
- Number stepper for bed count.
- Generated bed label preview.
- Remove icon button.
- Primary button: `Continue`.

### User Actions

- Add a room.
- Set bed count for each room.
- Remove a room.
- Review generated bed labels.
- Continue to doctor sides.

### Navigation Targets

- Valid `Continue` goes to Doctor Sides.
- Back returns to Floor Details.

### Empty State

- Message: `Add at least one room to continue.`

### Validation and Error States

- Blank room label: `Room label is required.`
- Duplicate room label in the same template: `Room already exists.`
- Bed count below 1: `Each room needs at least one bed.`
- Bed count over Phase 1 limit: `Use a smaller bed count for Phase 1.`
- Removing all rooms disables continue.

## 4. Doctor Sides

### Purpose

Define exactly two doctor sides and assign every room to one side.

### Layout

- Header: floor name.
- Step indicator with `Sides` active.
- Two side-name inputs at top.
- Room assignment list below.
- Each room row has a two-option segmented control.
- Bottom action bar.

### Components

- Text input for doctor side 1.
- Text input for doctor side 2.
- Segmented control for each room.
- Side summary counts, such as `AB Side: 12 rooms`.
- Primary button: `Review`.

### User Actions

- Name both doctor sides.
- Assign each room to one doctor side.
- Change a room's doctor side.
- Continue to template review.

### Navigation Targets

- Valid `Review` goes to Template Review.
- Back returns to Rooms and Beds.

### Empty State

- If rooms are missing, show `Add rooms before assigning doctor sides` and route back to Rooms and Beds.

### Validation and Error States

- Blank side name: `Doctor side name is required.`
- Duplicate side names: `Doctor side names must be different.`
- Unassigned room: `Every room needs a doctor side.`
- Empty doctor side is allowed during editing but called out in the summary.
- Do not allow adding or removing doctor sides in Phase 1.

## 5. Template Review

### Purpose

Let the charge nurse review the reusable floor template before using it for a local shift.

### Layout

- Header: `Review floor`.
- Summary block with floor name, room count, bed count, and two doctor sides.
- Sections grouped by doctor side.
- Room rows with generated bed labels.
- Bottom action bar.

### Components

- Summary counters.
- Doctor side sections.
- Room rows.
- Bed label chips.
- Secondary edit buttons: `Edit rooms`, `Edit sides`.
- Primary button: `Save template`.
- Optional primary button after save: `Start shift`.

### User Actions

- Review floor details.
- Go back to edit floor details, rooms, beds, or doctor sides.
- Save the template locally.
- Start a local shift after saving.

### Navigation Targets

- Edit actions return to the relevant setup screen.
- `Save template` returns to Local Workspace or reveals `Start shift`.
- `Start shift` goes to Start Shift.

### Empty State

- Not expected for a valid review. If the template is empty, show a blocker and route back to Rooms and Beds.

### Validation and Error States

- No rooms: `Add at least one room before saving.`
- Room without beds: `Each room needs at least one bed.`
- Room without doctor side: `Every room needs a doctor side.`
- Empty doctor side: show a visible warning but allow save if all rooms belong to the other side.

## 6. Start Shift

### Purpose

Start a local shift from the saved template, choose the admitting side, and review side-based nurse load defaults.

### Layout

- Header: floor name.
- Step indicator with `Shift` active.
- Shift summary from template.
- Admitting side segmented control with the two doctor sides.
- Load limit section with two rows:
  - Admitting-side coverage
  - Non-admitting-only coverage
- Bottom action bar.

### Components

- Template summary.
- Segmented control for admitting side.
- Number steppers for load limit ranges or max values.
- Helper text explaining defaults.
- Primary button: `Continue`.

### User Actions

- Select admitting doctor side.
- Keep or override admitting-side load default.
- Keep or override non-admitting-side load default.
- Continue to nurses.

### Navigation Targets

- Valid `Continue` goes to Nurses.
- Back returns to Template Review or Local Workspace.

### Empty State

- If no completed template exists, show `Create a floor template before starting a shift`.

### Validation and Error States

- Missing admitting side: `Choose the admitting side for this shift.`
- Load limit below 1: `Load limit must be at least 1.`
- Load limit over Phase 1 limit: `Use a smaller load limit for Phase 1.`
- If admitting limit is higher than non-admitting limit, allow it but show a warning row.
- Changing these values after assignment marks assignment as needing re-run.

## 7. Nurses

### Purpose

Add nurses for the shift and set each nurse's hard max patient load.

### Layout

- Header with census placeholder if patients already exist.
- Step indicator with `Nurses` active.
- Add-nurse form at top.
- Nurse list grouped as rows.
- Capacity summary at bottom above the action bar.

### Components

- Text input: nurse name.
- Segmented control: RN / LPN.
- Segmented control: New grad / Mid / Experienced.
- Number stepper: max patient load.
- Nurse row with chips and remove action.
- Capacity summary: total max capacity.
- Primary button: `Continue`.

### User Actions

- Add nurse.
- Choose license type.
- Choose experience level.
- Set max patient load.
- Edit nurse details.
- Remove nurse before assignment.
- Continue to patients.

### Navigation Targets

- Valid `Continue` goes to Patients and Acuity.
- Back returns to Start Shift.

### Empty State

- Message: `Add nurses for this shift.`

### Validation and Error States

- Blank nurse name: `Nurse name is required.`
- Duplicate nurse names are allowed if each row remains visually distinct.
- Missing max load: `Set a max load for each nurse.`
- Max load below 1: `Max load must be at least 1.`
- Removing a nurse after assignment marks assignment as needing re-run.

## 8. Patients and Acuity

### Purpose

Capture occupied beds, patient info, and bed-level acuity for assignment.

### Layout

- Sticky top census summary: occupied beds / total beds.
- Step indicator with `Patients` active.
- Filter chips: All, Occupied, Empty, Missing acuity, Red.
- Rooms grouped by doctor side.
- Bed rows within each room.
- Bottom action bar.

### Components

- Census counter.
- Room section header.
- Bed row with occupancy state.
- Patient initials input.
- Age input.
- Sex segmented control or picker.
- Diagnosis text input.
- Acuity segmented control: Green / Yellow / Red.
- Remove patient action.
- Bulk room acuity action for occupied beds in a room.
- Primary button: `Review assignment`.

### User Actions

- Add patient initials to a bed.
- Add optional age, sex, and diagnosis.
- Set acuity for occupied beds.
- Remove patient from a bed.
- Bulk-set acuity for a room when useful.
- Review census.
- Continue to Assignment Review.

### Navigation Targets

- Valid `Review assignment` goes to Assignment Review.
- Back returns to Nurses.

### Empty State

- If no occupied beds: `No occupied beds yet.`
- Empty beds remain visible and muted.

### Validation and Error States

- Patient initials required when adding a patient.
- Duplicate initials are allowed.
- Invalid age: `Age must be a whole number.`
- Occupied bed missing acuity: `Choose acuity before assignment.`
- Empty beds do not require acuity and are not assigned.
- Removing patient info updates census immediately.

## 9. Assignment Review

### Purpose

Show whether the shift is ready for local assignment and let the charge nurse run the deterministic assignment process.

### Layout

- Header: `Assignment review`.
- Sticky summary with census, nurse count, total capacity, admitting side, and flag count.
- Readiness checklist.
- Preview sections:
  - Nurse capacity
  - Red beds and RN coverage risk
  - Missing inputs
- Bottom action bar with `Run local assignment`.

### Components

- Summary counters.
- Checklist rows.
- Warning banners.
- Nurse capacity rows.
- Red-bed list.
- Primary button: `Run local assignment`.
- Secondary buttons to edit nurses or patients.

### User Actions

- Review readiness.
- Jump back to fix nurses, load limits, patients, or acuity.
- Run local assignment.
- View generated results.

### Navigation Targets

- `Edit nurses` goes to Nurses.
- `Edit patients` goes to Patients and Acuity.
- `Edit load limits` goes to Start Shift.
- Successful assignment goes to Floor Board.

### Empty State

- If no occupied beds, show a neutral message and allow the app to present a board with no assigned patients only if validation rules allow it.

### Validation and Error States

- No nurses: `Add at least one nurse before assignment.`
- Nurse missing max load: `Every nurse needs a max patient load.`
- Occupied bed missing acuity: `All occupied beds need acuity.`
- Total occupied beds greater than total max capacity: show a floor-level warning.
- Red beds with no RNs: show a critical warning before running.
- The assignment action must stay local and must not mention network or AI.

## 10. Floor Board

### Purpose

Show the active shift floor board after assignment, with enough detail for a charge nurse to understand coverage, loads, patient assignments, acuity, and flags.

### Layout

- Sticky top summary:
  - Floor name.
  - Census.
  - Admitting side.
  - Assignment status.
  - Flag count.
- Horizontal filter chips.
- Nurse workload summary strip.
- Board grouped by doctor side, then room.
- Bed rows or bed pills inside each room.
- Bottom action area for editing and re-running assignment when needed.

### Components

- Summary counters.
- Filter chips: All, Flags, Unassigned, Red, RN coverage.
- Nurse workload row.
- Doctor side header with admitting highlight.
- Room section.
- Room coverage chips.
- Bed pill with patient initials, acuity, assigned nurse, and unassigned state.
- Inline flag chips.
- Buttons: `Re-run`, `View flags`.

### User Actions

- Scan board by side, room, nurse, and bed.
- Filter to flags, unassigned beds, or red beds.
- Open flag details.
- Re-run local assignment after edits.

### Navigation Targets

- `Re-run` goes to Assignment Review or runs again after validation.
- `View flags` goes to Flags.
- Back returns to Local Workspace.

### Empty State

- Before assignment, show room and patient data with `No local assignment yet` and a `Run local assignment` action.
- If no patients are occupied, show the floor structure and census `0/total`.

### Validation and Error States

- Unassigned occupied bed: bed pill uses unassigned styling and links to Flags.
- Nurse over side-based limit: nurse workload row shows warning chip.
- Nurse over max load should show critical styling if it ever appears.
- Red bed assigned to LPN should never be generated; if detected, show critical flag.

## 11. Flags

### Purpose

Give the charge nurse one place to review local assignment issues and jump to the related setup or board area.

### Layout

- Header: `Flags`.
- Summary count by severity.
- Filter chips: All, Critical, Warning, Info.
- Flag list grouped by type or severity.

### Components

- Severity summary.
- Filter chips.
- Flag row.
- Jump action per row.
- Empty success row.

### User Actions

- Review flags.
- Filter by severity.
- Jump to affected nurse, room, bed, or setup screen.
- Return to Floor Board.

### Navigation Targets

- A nurse flag goes to Nurses or highlights nurse on Floor Board.
- A bed flag goes to Patients and Acuity or highlights bed on Floor Board.
- A load-limit flag goes to Start Shift or Nurses.
- Back returns to Floor Board.

### Empty State

- Message: `No assignment issues found.`

### Validation and Error States

- Flags are informational or warning states and should not block viewing the board.
- Critical flags should be visually stronger but still local.
- No push notification or notification inbox UI is included in Phase 1.

## Build Order Recommendation

1. Local Workspace.
2. Floor Details.
3. Rooms and Beds.
4. Doctor Sides.
5. Template Review.
6. Start Shift.
7. Nurses.
8. Patients and Acuity.
9. Assignment Review.
10. Floor Board.
11. Flags.

This order follows the Phase 1 user stories and keeps each screen testable before moving to the next one.

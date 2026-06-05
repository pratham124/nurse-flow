# Phase 2 Mobile Design

This document defines the mobile-first design direction for Phase 2: local persistence, saved template reuse, active-shift restore, and carry-over suggestions from the most recent previous shift that used the same floor template.

Phase 2 should feel like a natural extension of the Phase 1 charge nurse workflow. The app should now remember useful local work without looking like it has accounts, cloud sync, collaboration, or a full shift-history product.

## Design Goals

- Make saved local data visible and trustworthy.
- Help the charge nurse resume the current shift quickly after reopening the app.
- Make starting a new shift from a saved template feel faster than rebuilding the floor.
- Let the charge nurse review carry-over suggestions without accidentally accepting stale data.
- Keep persistence language local and simple.
- Preserve the Phase 1 phone-first, work-focused design.

## Visual Direction

Reuse the Phase 1 visual system from `docs/phase-1/mobile-design.md`.

The same palette, type scale, spacing, compact cards, status chips, sticky summaries, and bottom action bars should continue. Do not introduce a new visual theme for persistence.

Persistence states should use calm, practical labels:

- `Saved locally`
- `Restored from this device`
- `Previous shift`
- `Needs review`

Avoid cloud-style labels:

- Do not use `Synced`.
- Do not use `Online`.
- Do not use `Connected`.
- Do not use account, team, or server language.

## Layout Rules

- Keep the phone layout single-column.
- Keep common touch targets at least 44 px tall.
- Keep template and suggestion rows compact enough for scanning.
- Use sticky top summaries on restore, carry-over, patient review, and floor board screens.
- Keep bottom action bars for primary continue/save actions.
- Use chips for local status, accepted/dismissed state, previous bed, acuity, and missing bed selection.
- Do not add tablet-specific layouts in Phase 2.

## New or Updated Components

These are design components, not implementation code.

### Local Status Chip

Use for saved and restored state.

Examples:

- `Saved locally`
- `Active shift`
- `Previous shift available`
- `Restored`

### Template Row

Shows a saved floor template on Local Workspace.

Content:

- Floor name.
- Room count.
- Bed count.
- Last local update if available.
- Actions: `Start shift`, `Edit`.

Rules:

- `Edit` is hidden or disabled while an active shift exists.
- `Start shift` remains the primary action for completed templates.

### Active Shift Resume Row

Shows the most recent active shift when restored.

Content:

- Floor name.
- Census if available.
- Assignment status: `Setup` or `Assigned`.
- Local status chip: `Restored` or `Active shift`.
- Primary action: `Resume`.

Rules:

- This row should sit above saved templates.
- It should not mention sync, devices, or accounts.

### Carry-Over Suggestion Row

Used for nurse and patient suggestions.

Nurse row content:

- Nurse name.
- RN/LPN chip.
- Experience chip.
- Decision controls: accept/dismiss.

Patient row content:

- Patient initials.
- Previous bed chip.
- Acuity chip when available.
- Optional age, sex, and diagnosis summary.
- Decision controls: accept/dismiss.
- `Needs bed` chip if the previous bed no longer exists.

### Decision Controls

Use a small segmented or two-button control:

- `Accept`
- `Dismiss`

Rules:

- Default state is pending.
- Accepted state should look selected but still reversible during review.
- Dismissed state should be visually muted.

### Local Recovery Banner

Use when persisted data cannot be restored safely.

Examples:

- `Saved shift could not be restored. Start a new shift from a saved floor.`
- `This saved floor needs review before it can start a shift.`

Rules:

- Keep recovery messages plain and local.
- Do not describe server errors or sync conflicts.

## Updated Navigation Model

Phase 2 can keep the Phase 1 stack navigation model with a few additions:

1. Local Workspace
2. Floor Template Setup and Template Review
3. Start Shift
4. Carry-Over Review
5. Nurses
6. Patients and Acuity
7. Assignment Review
8. Floor Board
9. Flags

The new Carry-Over Review step appears only when a previous-shift snapshot exists for the selected floor template.

If no previous snapshot exists for that same template, Start Shift can continue directly to Nurses as Phase 1 did.

## Updated Screens

### Local Workspace

Phase 2 Local Workspace should show:

- Active shift resume row when an active shift exists.
- Saved floor templates.
- Empty state when no saved templates exist.
- `Create floor` action.

Key behavior:

- Reopening the app should make saved templates visible.
- Reopening with an active shift should show a clear `Resume` path.
- Template editing should be disabled while an active shift exists.

### Template Review

Template Review should support edit and save for existing templates.

Key behavior:

- It should clearly show whether the charge nurse is reviewing a new template or editing an existing one.
- Saving edits updates local storage.
- Shift-specific data should never appear as part of the template review.

### Start Shift

Start Shift should continue to handle:

- Template summary.
- Admitting side selection.
- Side-based load limit review.

New Phase 2 behavior:

- If previous-shift data exists, show a small `Previous shift available` chip.
- Continue routes to Carry-Over Review before Nurses.

### Carry-Over Review

Purpose:

Let the charge nurse accept or dismiss nurse and patient suggestions from the most recent previous shift for the same floor template.

Layout:

- Header: `Review carry-over`.
- Sticky summary with floor name and previous shift timestamp.
- Nurse suggestions section.
- Patient suggestions section.
- Bottom action bar with `Continue`.

User actions:

- Accept nurse.
- Dismiss nurse.
- Accept patient.
- Dismiss patient.
- Continue after reviewing suggestions.

Validation and error states:

- Pending suggestions can be allowed if the UI makes the default decision clear, but explicit accept/dismiss is preferred.
- Accepted patients whose previous bed no longer exists must show `Needs bed`.
- Continuing with a `Needs bed` patient should route the charge nurse to Patients and Acuity before assignment.

### Nurses

Nurses screen should show accepted nurse suggestions as regular shift nurses.

Key behavior:

- Accepted nurse profiles pre-fill name, license type, and experience.
- Max patient load remains empty or defaulted according to the current shift setup decision.
- The charge nurse can edit or remove accepted nurses.
- The charge nurse can add new nurses manually.

### Patients and Acuity

Patients and Acuity should show accepted patient suggestions as regular bed states.

Key behavior:

- Accepted patients pre-fill previous bed when available.
- Accepted acuity pre-fills as a starting value.
- The charge nurse can edit patient info and acuity before assignment.
- Patients needing a new bed are visible and must be resolved before assignment.

## Empty States

- No saved templates: `No local floor yet.`
- No active shift: no resume row.
- No previous shift for this template: skip Carry-Over Review or show `No previous shift suggestions for this floor.`
- No nurse suggestions: `No nurses to carry over.`
- No patient suggestions: `No patients to carry over.`
- Previous bed missing: `Previous bed is no longer on this floor. Choose a bed.`

## Manual Testing Checks

- Create a floor template, close and reopen the app, and confirm it appears on Local Workspace.
- Start a shift, enter setup data, close and reopen the app, and confirm `Resume` opens the active shift.
- End a shift, start a new shift from the same template, and confirm carry-over suggestions appear.
- Accept and dismiss nurse suggestions and confirm only accepted nurses appear on Nurses.
- Accept and dismiss patient suggestions and confirm only accepted patients appear on Patients and Acuity.
- Edit a saved template outside an active shift and confirm the changed structure is used for the next shift.

## Phase 2 Exclusions In UI

Do not design Phase 2 UI for:

- Login, signup, profile, or account settings.
- Cloud sync status.
- Realtime presence or connected devices.
- Push notification settings or notification inbox.
- Invite links or deep links.
- Regular nurse join screens.
- Multi-device collaboration.
- Offline queue status.
- AI suggestions.
- Break scheduling.
- Drag-and-drop reassignment.
- Board snapshot sharing.
- Tablet-specific layout.

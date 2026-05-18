# Phase 1 Mobile Design

This document defines the mobile-first design direction for the Phase 1 local charge nurse prototype.

Phase 1 is a single-device charge nurse workflow. It does not include auth, backend, realtime collaboration, push notifications, deep links, regular nurse devices, drag-and-drop assignment override, offline sync, AI, break scheduling, board sharing, or tablet layout.

## Design Goals

- Help a charge nurse move from floor setup to local assignment without feeling lost.
- Keep the phone layout compact enough for a full floor board to stay readable.
- Make safety information visible: red acuity, unassigned beds, missing inputs, overloads, and imbalance flags.
- Keep controls realistic for React Native and simple enough to implement one screen at a time.
- Make every screen usable with local in-memory state first.

## Visual Direction

NurseFlow should feel calm, clinical, and work-focused. The app should not look like a marketing page or a decorative dashboard. Most screens should use compact lists, clear labels, small status chips, and persistent actions.

Use the requested palette as the main app palette:

| Token | Hex | Use |
| --- | --- | --- |
| Soft green | `#b9d2b5` | Calm success tint, selected safe states, light panels |
| Warm gold | `#f4cb8d` | Warning tint, admitting-side highlight, attention backgrounds |
| Lavender | `#d1b2d2` | Secondary accent, team chips, setup step accents |
| Burgundy | `#823549` | Primary action, active tab, important headings |
| Light blue | `#b5e9f6` | Informational tint, empty states, neutral highlights |

Clinical acuity colors should stay semantic and separate from the brand palette:

| Acuity | Meaning | UI Treatment |
| --- | --- | --- |
| Green | Stable | Green bed dot or left rail |
| Yellow | Moderate | Yellow bed dot or left rail |
| Red | Critical | Red bed dot or left rail, RN-required indicator |

Do not replace red/yellow/green acuity with the brand palette because charge nurses need the clinical colors to remain obvious.

## Layout Rules

- Design for a phone first, roughly 390-430 px wide.
- Use a single-column flow for setup screens.
- Use a sticky top summary on high-density screens, especially patients, assignment review, and floor board.
- Keep common touch targets at least 44 px tall.
- Use compact cards with 8 px or smaller corner radius.
- Avoid cards inside cards.
- Use full-width sections for large groups such as doctor sides, nurses, and rooms.
- Use bottom action bars for primary next/save/run actions.
- Keep long lists scannable with section headers, filters, and short row summaries.
- Use small status chips for license type, experience level, side, acuity, and flags.

## Navigation Model

Phase 1 can use a simple stack navigation model:

1. Local Workspace
2. Floor Template Setup
3. Template Review
4. Shift Setup
5. Assignment Review
6. Floor Board

During setup, a step indicator can show where the charge nurse is:

- Floor
- Rooms
- Sides
- Shift
- Nurses
- Patients
- Assign
- Board

The step indicator is for orientation only. It should not imply future account setup, invite links, or nurse-device joining.

## Core Components

These are design components, not implementation code.

### App Header

- Shows current screen title.
- Shows a short context line when useful, such as floor name or census.
- Can include a back button during setup.
- Should not include profile, login, sync, or notification controls in Phase 1.

### Step Indicator

- Compact horizontal row.
- Current step uses burgundy.
- Completed steps use soft green.
- Incomplete steps use neutral text and border.

### Bottom Action Bar

- Fixed to bottom on setup and review screens.
- Primary action on the right.
- Secondary action on the left when needed.
- Disabled state includes short helper text above or inside the bar.

### Form Row

- Label, input/control, validation message.
- Keep validation messages plain and specific.
- Examples: `Floor name is required.`, `Each room needs a doctor side.`

### Segmented Control

Use for:

- RN / LPN
- New grad / Mid / Experienced
- Green / Yellow / Red
- Doctor side selection

### Number Stepper

Use for:

- Bed count per room
- Side-based load limits
- Nurse max patient load

### Status Chip

Use for:

- Admitting side
- RN / LPN
- Experience level
- Current load, such as `4/5`
- Unassigned
- Needs acuity

### Flag Banner

- Floor-level issue at top of a screen.
- Use warm gold for warning and red for critical.
- One sentence of plain language.
- Link to the relevant screen when possible.

### Flag Row

- Compact row in the Flags screen or floor board.
- Shows severity, affected nurse/room/bed, and plain-language message.
- Does not block viewing the board.

### Bed Pill

- Small pill or row showing bed label, patient initials, and acuity color.
- Empty bed state is muted.
- Unassigned occupied bed uses an outline and `Unassigned` chip.
- Red beds include an RN-required marker where space allows.

## Floor Board Design

The floor board is the most information-dense screen in Phase 1. It should prioritize fast scanning over decorative layout.

### Top Summary

Sticky summary at the top:

- Floor name.
- Census, such as `36/38 occupied`.
- Admitting side chip.
- Assignment status: `Not run`, `Assigned`, or `Needs re-run`.
- Flag count.

### Filters

Use horizontal filter chips:

- All
- Flags
- Unassigned
- Red
- RN coverage

These filters only change local display. They do not imply realtime subscriptions or notifications.

### Grouping

Default board grouping:

1. Doctor side
2. Room
3. Bed

Each room section shows:

- Room label.
- Doctor side.
- Room coverage nurses.
- Bed pills.

Nurse workload should be visible through a nurse summary strip or expandable nurse list:

- Nurse name.
- RN/LPN.
- Experience.
- Team.
- Covered rooms.
- Current load and max load.
- Flags affecting the nurse.

This avoids implying that one room always belongs to exactly one nurse. The UI should show room coverage and final bed assignment separately.

## Empty States

Empty states should be short, practical, and connected to the next action.

- No floor templates: show `No local floor yet` and a `Create floor` action.
- No rooms: show `Add at least one room to continue`.
- No nurses: show `Add nurses for this shift`.
- No patients: show `No occupied beds yet`; assignment can run only if that is allowed by validation.
- No assignment: board can show rooms and patient data with `Run local assignment` as the primary action.
- No flags: show a quiet success row, such as `No assignment issues found`.

## Validation States

Validation should happen as early as possible without becoming noisy.

- Required text fields validate on continue/save.
- Duplicate floor and room names validate before save.
- Step-level validation appears near the bottom action bar.
- Field-level validation appears below the field.
- Assignment validation appears on Assignment Review before running.

Important Phase 1 validation:

- Floor name is required and unique in local state.
- Room labels are required and unique within a template.
- Each room needs at least one bed.
- Exactly two doctor sides exist and both need names.
- Every room needs a doctor side before template confirmation.
- A shift needs an admitting side.
- At least one nurse is required.
- Each nurse needs a max patient load.
- Occupied beds need patient initials.
- Occupied beds need acuity before assignment.
- Red beds can only be assigned to RNs.

## Error States

Errors should be local and recoverable.

- Use inline messages for form errors.
- Use a floor-level banner for assignment blockers.
- Use flag rows for assignment warnings after a best-effort assignment.
- Never show server, account, sync, invite, notification, or network errors in Phase 1.

Examples:

- `This floor name already exists.`
- `Room 312 needs a doctor side.`
- `Bed 101-2 is occupied but missing acuity.`
- `Red bed 306-1 has no eligible RN.`
- `Total occupied beds exceed nurse max capacity.`

## User Story Coverage

| Story | Design Coverage |
| --- | --- |
| US1 Create a Floor Template | Local Workspace, Floor Details |
| US2 Add Rooms | Rooms and Beds |
| US3 Add Beds | Rooms and Beds |
| US4 Define Two Doctor Sides | Doctor Sides |
| US5 Assign Rooms to Doctor Sides | Doctor Sides |
| US6 Review Floor Template | Template Review |
| US7 Start a Local Shift | Start Shift |
| US8 Override Side-Based Nurse Load Defaults | Start Shift |
| US9 Add Nurses | Nurses |
| US10 Set Nurse Max Patient Load | Nurses |
| US11 Add Patients to Beds | Patients and Acuity |
| US12 Set Bed-Level Acuity | Patients and Acuity |
| US13 Show Census Totals | Patients and Acuity, Assignment Review, Floor Board |
| US14 Run Local Assignment | Assignment Review |
| US15 Show Charge Nurse Floor Board | Floor Board |
| US16 Show Imbalance and Unassigned-Bed Flags | Assignment Review, Floor Board, Flags |
| US17 Edit Inputs and Re-Run Assignment | Floor Board, setup screens in edit mode |
| US18 Keep Phase 1 Local-Only | All screens by exclusion |

## Phase 1 Exclusions In UI

Do not design Phase 1 UI for:

- Login, signup, forgot password, or accounts.
- Invite links or link sharing.
- Nurse join screens.
- Realtime presence or connected-device indicators.
- Push notification preferences or notification inbox.
- Deep link handling.
- Drag-and-drop reassignment.
- Offline queue status.
- AI assignment suggestions.
- Break scheduling.
- Board snapshot sharing.
- Tablet-specific layout.

## Implementation Notes For Later

- Start with simple React state or `useReducer`.
- Keep screen state close to the current screen until it must be shared.
- The first implementation can use arrays from the Phase 1 data model.
- Prefer plain controls before custom gestures.
- Build and test one screen at a time in the order defined in `docs/phase-1/screens.md`.

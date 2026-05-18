# Phase 1 Assignment Algorithm

This document describes the internal deterministic assignment logic for the Phase 1 local charge nurse prototype.

The user-facing story is simple: the charge nurse runs local assignment once. Internally, that one assignment run performs several ordered steps.

Phase 1 assignment is local-only. It does not use AI, backend services, realtime sync, push notifications, invite links, or external APIs.

## Inputs

- Floor template rooms and beds.
- Two doctor sides.
- Admitting side for the shift.
- Side-based nurse load limits:
  - Nurses covering admitting-side rooms default to about 4-5 patients.
  - Nurses covering only non-admitting-side rooms default to about 6-7 patients.
  - The charge nurse can override these defaults for the shift.
- Nurses:
  - Name.
  - License type: RN or LPN.
  - Experience level: new grad, mid, or experienced.
  - Max patient load.
- Patients:
  - Initials.
  - Age.
  - Sex.
  - Diagnosis.
  - Bed location.
- Bed-level acuity:
  - Green: stable.
  - Yellow: moderate.
  - Red: critical.

## Outputs

- Generated balanced nurse teams.
- Generated room coverage.
- Bed-level patient assignments.
- Unassigned occupied beds.
- Warnings and flags for unsafe or incomplete assignment.

## Core Rules

- The same inputs must always produce the same output.
- Empty beds are not assigned.
- Each occupied bed is assigned to one nurse when an eligible nurse is available.
- Rooms can have generated coverage from more than one nurse when needed.
- Different beds in the same room can be assigned to different nurses.
- Red critical beds require an RN.
- LPNs are never eligible for red critical beds.
- Nurse max load is a hard cap for that nurse.
- Side-based nurse load limits guide balancing, but individual nurse max load wins when lower.

## Algorithm Steps

### Step 1: Validate Assignment Inputs

Before assignment can run, the app checks that:

- At least one nurse exists.
- Every nurse has a valid max patient load.
- Every occupied bed has an acuity.
- The admitting side is selected.
- Side-based nurse load limits are valid.

If validation fails, assignment does not run and the app shows clear local validation messages.

### Step 2: Summarize Patient Need

The app calculates patient demand from the current shift:

- Occupied bed count by doctor side.
- Occupied bed count by room.
- Acuity mix by doctor side.
- Acuity mix by room.
- Red critical beds that require RN coverage.
- Patient info that may affect balancing, such as age or diagnosis text.

Phase 1 does not need clinical interpretation of diagnosis text. Diagnosis can be used as display information and simple context only.

### Step 3: Generate Balanced Nurse Teams

The app splits nurses into generated balanced teams.

Teams are not one-to-one with doctor sides. A generated team can cover rooms from one doctor side or both doctor sides if needed.

Team balancing considers:

- License type.
- Experience level.
- Nurse max load.
- Side-based nurse load limits.
- Occupied patient count by side.
- Patient info entered for occupied beds.
- Acuity mix by side.
- Admitting side status.

The goal is to avoid putting all high-risk patients, all red beds, or all new nurses into one weak coverage group.

If a side has red critical beds, the generated team coverage for that side must include an RN when an eligible RN exists.

If staffing is too limited to create balanced teams, the app still generates the best deterministic team split and shows a warning.

### Step 4: Generate Room Coverage

Using the generated teams, the app creates room coverage.

Room coverage means a nurse is eligible and expected to cover beds in that room. It does not mean every bed in the room has the same nurse.

Room coverage considers:

- Generated nurse teams.
- Room doctor side.
- Whether the room is on the admitting side.
- Occupied bed count in the room.
- Acuity mix in the room.
- Nurse license type.
- Nurse experience level.
- Nurse max load.
- Side-based nurse load limits.

Rooms with red critical beds require RN coverage. If no eligible RN can cover those red beds, the red beds remain unassigned and flagged.

### Step 5: Sort Beds for Assignment

The app assigns hardest beds first:

1. Red critical beds.
2. Yellow moderate beds.
3. Green stable beds.

Within the same acuity level, deterministic tie-breakers should be used, such as doctor side order, room order, then bed order.

### Step 6: Assign Beds to Nurses

For each occupied bed, the app filters eligible nurses:

- The nurse must have generated coverage for that bed's room.
- The nurse must not exceed their max patient load.
- LPNs are excluded from red critical beds.

For red critical beds, prefer RNs in this order:

1. Experienced RN.
2. Mid RN.
3. New grad RN.

Among eligible nurses, choose the nurse with the lowest current acuity load. Acuity score:

- Red = 3.
- Yellow = 2.
- Green = 1.

If there is still a tie, use stable deterministic tie-breakers, such as lower current patient count, then nurse list order.

### Step 7: Generate Flags

The app creates local flags for:

- Occupied beds that could not be assigned.
- Red critical beds with no eligible RN.
- Nurses over side-based load limit.
- Nurses over max load, if that state ever occurs.
- Generated teams that are not balanced by experience level, license type, patient count, or acuity.
- Rooms with no eligible generated coverage for occupied beds.
- Total occupied beds exceeding total nurse capacity.

Flags do not require push notifications in Phase 1. They appear locally in the charge nurse prototype.

## Re-Running Assignment

Assignment can be re-run after changes to:

- Nurses.
- Nurse license type.
- Nurse experience level.
- Nurse max load.
- Side-based nurse load limits.
- Patient info.
- Bed acuity.
- Admitting side.

Re-running assignment clears stale generated teams, room coverage, and bed assignments before producing new results.

## Manual Testing Examples

- Red bed with only LPN coverage should remain unassigned and flagged.
- Red bed with multiple RNs should prefer experienced RN, then mid RN, then new grad RN.
- A room with multiple occupied beds can split beds across different nurses.
- A nurse assigned admitting-side room coverage should use the admitting-side load limit.
- A nurse covering only non-admitting-side rooms should use the non-admitting-side load limit.
- If total nurse capacity is too low, some occupied beds should remain unassigned and a floor-level warning should appear.

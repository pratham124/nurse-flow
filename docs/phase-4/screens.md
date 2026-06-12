# Phase 4 Screens

This document describes the Phase 4 mobile screens for local break scheduling. It is planning and design only, not React Native implementation code.

Each screen should be simple enough to build and test independently. Existing Phase 1, Phase 2, and Phase 3 screens should be updated only where Phase 4 behavior requires it.

## Screen Map

| Screen | Main Stories |
| --- | --- |
| Floor Board | US2, US3, US4, US6 |
| Break Schedule | US1, US2, US4, US6 |
| Simulated Nurse Assignment | US5, US6 |

## 1. Floor Board

### Purpose

Keep the charge nurse's full active shift board as the home base and add break schedule visibility.

### Layout

- Existing sticky top summary with floor name, census, admitting side, assignment status, flag count, and local request count.
- Existing board grouped by doctor side, nurse, rooms, and beds.
- Break warning count when warnings exist.
- Nurse card break badge when a break exists.
- Board-context bottom tabs: `Board`, `Breaks`, and `Flags`.
- Existing actions: `Re-run`, `View as nurse`, `End shift`.

### Components

- Existing board summary.
- Existing nurse workload rows.
- Existing doctor side, room, and bed display.
- Break warning chip.
- Nurse card break badge.
- Bottom board sub-tab bar.

### User Actions

- Open Break Schedule from the `Breaks` bottom sub-tab.
- Re-run assignment through the existing Phase 1 path.
- Open flags and local requests through the existing Phase 3 path.
- Open simulated nurse view through the existing Phase 3 path.
- End shift through existing Phase 2 persistence behavior.

### Navigation Targets

- `Schedule breaks` goes to Break Schedule.
- `View breaks` goes to Break Schedule.
- Existing actions keep their current targets.

### Empty State

- If assignment has not run, disable `Schedule breaks` and show `Run assignment before scheduling breaks.`

### Validation and Error States

- If the active shift has no nurses, disable break scheduling with `Add nurses before scheduling breaks.`
- If the current break schedule references a missing nurse, show a stale-warning count and keep the board usable.
- Do not show notification, server, sync, connected-device, invite, or AI actions.

## 2. Break Schedule

### Purpose

Let the charge nurse enter break inputs, generate a local schedule, refresh it, and review warnings.

### Layout

- Header: `Breaks`.
- Compact summary card with:
  - Schedule status.
  - Shift start time.
  - Activity level.
  - Scheduled nurse count.
  - Warning count.
- Inline refresh action when the schedule is stale.
- Break entry list sorted by time.
- Warning section when warnings exist.
- Board-context bottom sub-tab bar.

### Components

- Break schedule summary.
- Time input or time picker entry.
- Activity level segmented control.
- Break entry rows.
- Break warning rows.
- Inline refresh action when the schedule is stale.
- Board-context bottom sub-tab bar.

### User Actions

- Refresh the break schedule after changes when the inline refresh action appears.
- Return to Floor Board from the `Board` bottom sub-tab.

### Navigation Targets

- Back returns to Floor Board.
- Generate or refresh stays on Break Schedule and updates local active-shift schedule state.

### Empty State

- `Break not scheduled yet.`
- `Run assignment before scheduling breaks.`
- `Add nurses before scheduling breaks.`

### Validation and Error States

- Missing shift start time: `Enter a shift start time.`
- Invalid shift start time: `Use a valid time.`
- Missing assignment result: `Run assignment before scheduling breaks.`
- Missing nurse list: `Add nurses before scheduling breaks.`
- Unable to satisfy safety rule: show a warning row, not a crash.

## 3. Simulated Nurse Assignment

### Purpose

Show the selected simulated nurse's assignment and that nurse's own break time.

### Layout

- Existing sticky summary: `Viewing as [Nurse Name]`.
- Local simulation chip.
- Nurse profile chips.
- New break summary row.
- Existing room coverage summary.
- Existing assigned bed list grouped by room.
- Existing local request history for this nurse.
- Existing actions: `Flag issue`, `Request swap`, `Back to charge view`.

### Components

- Existing nurse assignment summary.
- New simulated nurse break summary.
- Existing room coverage chips.
- Existing nurse bed cards.
- Existing request history rows.
- Existing action buttons.

### User Actions

- Review own break time.
- Review assigned rooms and beds.
- Open Mock Issue Form.
- Open Mock Swap Form.
- Return to charge nurse Floor Board.

### Navigation Targets

- Existing Phase 3 navigation remains unchanged.

### Empty State

- If no break schedule exists, show `Break not scheduled yet.`
- If the selected nurse has no break entry, show `No break assigned for this nurse yet.`

### Validation and Error States

- If selected nurse no longer exists, use existing Phase 3 recovery behavior.
- If break entry references stale data, hide stale data and show a short local warning.
- Do not show other nurses' break entries.
- Do not show notification reminder, connected-device, invite, server, or sync states.

## Build Order Recommendation

1. Add Phase 4 planning and scope guardrails.
2. Add break schedule data model boundary.
3. Add Break Schedule screen route and empty states.
4. Add break input controls.
5. Add deterministic local break generation helper.
6. Show generated schedule and warnings.
7. Add Floor Board break badges and entry point.
8. Add simulated nurse break summary.
9. Add refresh behavior.
10. Run a full Phase 4 manual test pass.

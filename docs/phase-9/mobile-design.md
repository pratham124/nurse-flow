# Phase 9 Mobile Design

Phase 9 changes assignment calculation from the phone prototype to a backend
Python/OR-Tools optimizer service. The established NurseFlow workflow and visual
language remain in place. The service boundary is intentionally invisible to
ordinary navigation: users see one assignment action and clear status, not a
Python-specific workflow. This is design guidance only; no prototype or
implementation is part of this planning task.

## Design Direction

- Preserve the current assignment review, rerun confirmation, floor board,
  flags, and joined-nurse layouts.
- Keep the action user-centered: the charge nurse runs an assignment, while
  implementation words such as CP-SAT, objective weights, or solver variables
  stay out of the main UI.
- Make the server-required wait and failure states explicit without presenting
  speculative progress percentages.
- Keep previous assignment data visible until a successful rerun commits.
- Never imply a failed or stale run changed the floor.
- Reuse current cards, status surfaces, typography, spacing, safe areas, and
  compact/expanded responsive boundary.
- Keep interactive targets at least 44 points and primary actions about 52-56
  points high.
- Use labels and icons with color; never use color alone for optimizer status,
  acuity, or warnings.

## Assignment Review Experience

### Ready State

Keep the existing review content:

- floor and census summary;
- admitting doctor side;
- nurses, credentials, experience, and max loads;
- side-based load guidance;
- assignment validation blockers;
- active manual-move warning before rerun.

The primary action can remain `Run assignment` for the first result and `Rerun
assignment` afterward. The user does not need a second optimizer-specific
workflow.

### Calculating State

After confirmation:

- Change the primary action label to calm, direct copy such as `Calculating
  assignment…`.
- Disable duplicate submission and input-changing navigation that would imply
  the same request is still current.
- Show an indeterminate progress indicator with an accessible busy state.
- Explain that the current floor is being checked as a whole.
- Do not show a fake percentage, changing solver score, or technical log.
- On rerun, keep the previous board authoritative until the new baseline saves.

### Success State

- Route to the existing floor board after the refreshed server state is loaded.
- Announce that the assignment was updated.
- Let the established board and flags explain unassigned beds or workload risk.
- Do not add an optimizer report screen, confetti, or a success modal that must
  be dismissed before safety flags can be reviewed.

### Failure and Recovery States

Use concise inline surfaces near the primary action:

| State | User-facing direction |
| --- | --- |
| Disconnected | Explain that a connection is required to calculate or rerun. Keep cached views available under Phase 7 rules. |
| Stale input | Explain that shift details changed, refresh current data, and ask the charge nurse to review before trying again. |
| Timed out | Explain that no assignment was saved and offer a retry after current data reloads. |
| Service unavailable | Explain that the current assignment is unchanged and offer retry when connected. |
| Invalid setup | Reuse existing field or section blockers before the optimizer is invoked. |
| Unexpected failure | State that the current assignment was not changed; provide a focused retry path. |

Error copy must not claim the floor is safe merely because no new result was
saved.

## Rerun with Active Manual Moves

Preserve the Phase 8 confirmation pattern:

- State how many active manual moves will be cleared if the rerun succeeds.
- `Cancel` keeps the current baseline and moves.
- `Rerun and clear moves` starts calculation but does not clear anything yet.
- While calculating, the dialog closes or becomes a single busy surface; it
  must not allow a second confirmation.
- If calculation fails or becomes stale, the previous baseline and moves remain
  visible and the copy says so.

## Floor Board and Flags

No visual redesign is required after success.

- Generated teams, room coverage, bed assignments, loads, and flags use their
  existing hierarchy.
- Manual-move markers disappear after a successful rerun because active moves
  are superseded.
- Unassigned and eligibility flags remain prominent and use text in addition to
  severity color.
- The expanded tablet board keeps its selected-nurse behavior.
- No solver score, candidate list, objective chart, optimizer version, or run
  history appears on the board.

## Joined-Nurse Experience

- No new screen or action is added.
- A joined nurse receives the existing realtime refresh after a successful
  assignment update.
- The nurse sees only her scoped rooms, beds, patients, acuity, and current
  request tools.
- Optimizer status, run metadata, other nurses, and full-floor calculations are
  not exposed.
- If the nurse is offline, the existing stale-copy presentation remains the
  source of truth until reconnect.

## Responsive Behavior

### Compact

- Keep the one-column assignment review and full-width primary action.
- Keep error and busy text close to the action without pushing validation
  context off screen.
- Respect the top and bottom safe areas and keyboard behavior of existing forms.

### Expanded

- Keep the current readable maximum width for setup and review flows.
- Do not introduce a tablet-only optimizer dashboard.
- Existing two-pane floor-board behavior begins only after a result saves.

Resizing or rotating during calculation must preserve the visible busy state and
must not submit again.

## Accessibility Requirements

- Primary assignment and rerun actions have clear accessible names, roles, and
  disabled/busy states.
- The indeterminate progress state has concise spoken text and does not announce
  repeated updates.
- Focus moves to an error summary after failure and returns to a useful retry or
  review control.
- Stale, timeout, and failure messages explicitly say whether the current
  assignment changed.
- Dynamic type can wrap action and error copy without fixed-height clipping.
- Acuity, eligibility, and unassigned meaning remain available without color.
- Reduced-motion settings are respected by existing transitions.

## Manual Design Review Matrix

Review at minimum:

- small phone portrait;
- large phone portrait;
- tablet portrait and landscape;
- larger accessibility text;
- VoiceOver or TalkBack for ready, calculating, stale, failure, and success
  transitions;
- initial assignment and rerun with active manual moves;
- disconnected and reconnecting states;
- long floor, nurse, room, and validation text;
- rotation or resize during an in-flight request.

## Phase Boundary

The mobile design must not add solver configuration, AI recommendations,
diagnosis interpretation, analytics dashboards, EHR/EMR data, automated acuity,
multi-hospital tools, handoff notes, or an offline optimizer queue.

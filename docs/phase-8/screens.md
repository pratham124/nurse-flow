# Phase 8 Screens and Flows

This document maps Phase 8 changes onto the existing NurseFlow app. It describes screens and states only; it does not prescribe implementation code.

## Navigation Summary

```text
Charge Floor Board
  ├─ Swipe bed row → Move
  │    └─ Override confirmation / warning review
  ├─ Flags and Requests
  │    └─ Request Detail + Thread
  │         └─ Complete accepted swap with assignment move
  └─ Share Board
       └─ Board Snapshot Preview

Joined Nurse Assignment
  └─ Request history
       └─ Request Detail + Thread (nurse-scoped)
```

No global chat, board gallery, or new top-level tablet-only navigation is added.

## 1. Charge Nurse Floor Board

### Purpose

Show the current effective floor assignment, support deliberate manual moves, surface resulting warnings, and provide board sharing.

### Existing Content Preserved

- Floor and census summary.
- Live connection state.
- Admitting doctor side.
- Nurse credentials, generated team, coverage, load, and max load.
- Rooms, beds, patient display, acuity, and flags.
- Links to flags/requests, invites, and other existing active-shift actions.

### Phase 8 Additions

- Swipe-reveal `Move` action on eligible occupied assigned-bed rows.
- `Share board` action.
- Effective-assignment labels or subtle manual-move marker where useful.
- Tap-only eligible-nurse picker after the `Move` action.
- Eligible/ineligible nurse target states.
- Current override-related flags remain inline.
- Tablet selected-nurse pane.

### Compact Layout

- Existing vertical doctor-side and nurse-card flow.
- Bed rows remain readable during scrolling.
- Confirmation appears as a bottom sheet or full-screen modal.

### Expanded Layout

- Left pane: floor summary, doctor sides, compact nurse list.
- Right pane: selected nurse detail, rooms, beds, and flags.
- Keep the same tap-only picker in expanded layouts rather than adding a second gesture model.

### States

- No active shift.
- Active shift without assignment result.
- Loading current server state.
- Live/connected.
- Reconnecting or disconnected: board follows existing Phase 7 behavior; move and share actions requiring fresh data explain availability.
- Move action hidden or revealed.
- Choosing a nurse target.
- Confirming a valid move.
- Blocking eligibility error.
- Non-blocking warnings awaiting acknowledgement.
- Saving move.
- Stale move rejected and refreshed.
- Move saved.
- Share capture in progress or failed.

### Manual Checks

- Existing board remains usable while move actions stay tucked behind assigned-bed rows.
- Moving one bed updates affected loads, beds, and flags after server confirmation.
- Joined nurses do not gain full-board access.
- Tablet rotation preserves a sensible selected nurse.

## 2. Override Confirmation and Warning Review

### Purpose

Make the consequences of one proposed bed move clear before it becomes server state.

### Content

- Bed label, patient initials when already visible, and acuity.
- Current nurse and proposed nurse.
- Before/after loads and max loads.
- Blocking reasons, if any.
- New or worsened non-blocking warnings.
- Warning acknowledgement control.

The generic move dialog does not display swap requests. A request-specific
`Complete with assignment move` action will provide the link automatically in
Task 2.6.

### Actions

- Cancel.
- Acknowledge non-blocking warnings.
- Confirm move.
- Refresh after stale-state rejection.

### Rules

- Confirm is disabled for hard eligibility failures, missing acknowledgement, disconnection, or in-flight save.
- Closing without confirming makes no change.
- Successful confirmation returns to the board and announces the result.
- Failure keeps enough context to explain what happened but never pretends the move saved.

## 3. Flags and Requests

### Purpose

Continue to provide the charge nurse's combined review entry while making Phase 8 request lifecycle states clear.

### Existing Content Preserved

- Assignment-generated flags and severity filters.
- Issue and swap request list.
- Request type and existing swap decision filters.

### Phase 8 Additions

- Issue state labels: Open, Reviewed, Resolved.
- Swap completion label: Accepted — assignment change pending or Completed.
- Unread-message badges only if a read-state model is intentionally added later; Phase 8 does not require read receipts.
- Current request activity time can be derived from the latest message without creating a global inbox.

### Manual Checks

- Assignment flags remain separate from request lifecycle states.
- Existing request deep links or notification routes still open the correct request.
- Filters do not hide active assignment warnings accidentally.

## 4. Charge Request Detail and Thread

### Purpose

Let the charge nurse review one request, discuss it with the requesting nurse, and perform the correct lifecycle action.

### Layout

- Request header and state chips.
- Request metadata and original message.
- Type-specific lifecycle controls.
- Chronological request thread.
- Message composer.

### Issue Actions

- Mark reviewed.
- Resolve issue.
- Reopen issue.

These actions do not change assignments.

### Swap Actions

- Accept or decline while pending.
- For accepted swaps, `Complete with assignment move`.
- Completed swap displays linked move summary.
- A completed swap whose linked override was later superseded displays `Completed — assignment later changed` rather than implying the old move is still current.

### States

- Loading.
- Request missing or access denied.
- Empty thread.
- Sending message.
- Message send failed with draft retained.
- Disconnected; composer and lifecycle writes disabled.
- Issue open, reviewed, resolved.
- Swap pending, declined, accepted/pending change, completed.
- Swap completed/current move and completed/later-superseded move.
- Stale request state refreshed before action.

### Compact and Expanded Layout

- Compact: metadata, controls, thread, and composer in one vertical screen.
- Expanded: metadata/lifecycle pane beside the thread/composer pane.

## 5. Joined Nurse Assignment

### Purpose

Preserve the nurse-scoped live assignment while adding access to that nurse's own request threads and clear request outcomes.

### Existing Content Preserved

- Nurse-scoped assignment, patients, acuity, coverage, break, live status, and request submission.

### Phase 8 Additions

- Request history rows open nurse-scoped request detail.
- Issue state and swap completion state use the same labels as charge view.
- Effective assignment updates after a manual override appear through existing realtime refresh.
- Expanded layout gives assignment and request content readable regions without exposing the full board.

### Restrictions

- No charge-only lifecycle actions.
- No full-board share action.
- No override audit history.
- No access to another nurse's requests or thread messages.

### Manual Checks

- A moved bed disappears from the former nurse and appears for the new nurse after realtime refresh.
- Only the requester can open and post to the request thread.
- Accepted and completed swap states are visually distinct.

## 6. Joined Nurse Request Detail and Thread

### Purpose

Let the requesting nurse follow one request without exposing charge-only controls or other requests.

### Content

- Request type, state, original message, and bed context.
- Chronological messages from the requester and charge nurse.
- Message composer.
- Read-only lifecycle summary.

### States

- Loading current server state.
- Shift ended.
- Access removed.
- Request missing.
- Disconnected; thread readable according to existing data behavior, composer disabled.
- Sending or retryable send failure.

### Navigation

- Open from joined-nurse request history.
- Open from an eligible notification route after server authorization.
- Back returns to the joined nurse assignment.

## 7. Board Snapshot Preview

### Purpose

Let the charge nurse inspect the exact point-in-time board image before opening the native share sheet.

### Content

- Static preview generated from the current effective board.
- Floor name, census, captured time, doctor sides, nurse assignments, beds, acuity, and concise flags.
- Privacy reminder and point-in-time disclaimer.

### Actions

- Share snapshot.
- Retry capture.
- Back to board.

### States

- Generating.
- Ready.
- Capture failed.
- Native share sheet opened.
- Share cancelled without error.
- Share failed with retry.

### Restrictions

- No edit or annotation tools.
- No upload, server record, gallery, history, or request-thread attachment.
- No joined-nurse access to the full-board preview.

## 8. Assignment Rerun Confirmation Update

### Purpose

Prevent a new generated baseline from silently invalidating deliberate Phase 8 overrides.

### Phase 8 Change

If active overrides exist, the existing rerun action must explain that rerunning assignment will replace the generated baseline and clear or supersede manual moves.

### Actions

- Cancel and keep current effective assignment.
- Confirm rerun and replace the baseline.

### Manual Checks

- Cancel keeps all overrides effective.
- Confirm produces the normal deterministic result and removes old overrides from the effective assignment.
- Request threads and request lifecycle history remain intact.

## Cross-Screen Accessibility Checks

- Logical screen-reader heading order.
- Accessible labels for acuity, warnings, request states, and manual-move markers.
- Swipe-reveal move action and tap-only nurse selection.
- Predictable modal focus and return focus.
- Keyboard-safe thread composer.
- Dynamic type without fixed-height clipping.
- Minimum 44-point targets.

## Phase 8 Exclusions

- Production assignment optimizer UI or services.
- Global chat or a messaging inbox.
- Offline write queue.
- Board snapshot history or server upload.
- AI, EHR/EMR, automated acuity, multi-hospital tools, or handoff notes.

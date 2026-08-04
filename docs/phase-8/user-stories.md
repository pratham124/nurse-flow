# NurseFlow Phase 8 User Stories

Phase 8 adds advanced interaction, request follow-up, board sharing, and presentation improvements after the connected Phase 1-7 workflow is reliable.

Phase 8 preserves the existing floor setup, deterministic assignment, persistence and carry-over, authenticated server state, realtime nurse access, requests, notifications, and connection behavior. It does not replace the assignment algorithm planned for Phase 9.

## US1: Override a Bed Assignment from the Floor Board

As a charge nurse, I want to swipe an occupied bed row to reveal a move action and choose its new nurse so I can make a deliberate assignment adjustment without rerunning the whole assignment.

### Acceptance Criteria

- The move action is available only to the charge nurse on an active, connected shift with an assignment result.
- Swiping one occupied assigned bed row reveals a `Move` action without interfering with vertical board scrolling.
- Eligible choices are active nurses whose generated room coverage includes the bed's room.
- A red-acuity bed cannot be moved to an LPN.
- The move is confirmed before it is saved.
- A saved override updates the effective board assignment for connected charge and joined-nurse views.
- The generated assignment result remains available as the baseline; the manual move is stored as a server history record and exposed to routine board reads through a bed-keyed active-override dictionary.

### Manual Checks and Edge Cases

- Move an eligible green or yellow bed and confirm both affected nurse cards update.
- Try to move a red bed to an LPN and confirm the choice is disabled with a plain explanation.
- Cancel before choosing or confirming and confirm nothing changes.
- Lose the connection before confirmation and confirm no local-only move is shown as saved.
- Cancel the confirmation and confirm the original assignment remains effective.

## US2: Understand and Acknowledge Override Warnings

As a charge nurse, I want to see safety and workload warnings caused by a manual move so I can make an informed decision without the app silently hiding risk.

### Acceptance Criteria

- Before confirmation, the app previews new or worsened load, imbalance, eligibility, and coverage warnings caused by the proposed move.
- Hard eligibility failures block the move; workload and imbalance warnings are non-blocking.
- A non-blocking warning requires an explicit acknowledgement before confirmation.
- After saving, affected nurse cards and the Flags screen show current effective-assignment warnings.
- The saved acknowledgement records what was acknowledged without dismissing or removing the active flag.
- If the move fails server validation because data changed, the app reloads current state and asks the charge nurse to try again.

### Manual Checks and Edge Cases

- Move a bed over a nurse's max load, acknowledge the warning, and confirm the move remains possible.
- Confirm the overload flag stays visible after acknowledgement.
- Change the assignment from another session before confirming and verify the stale move is rejected safely.
- Confirm acknowledging one override warning does not acknowledge later unrelated warnings.

## US3: Follow Up Inside a Request Thread

As a charge nurse or requesting nurse, I want a conversation attached to one issue or swap request so follow-up stays with the request that caused it.

### Acceptance Criteria

- Each issue or swap request has its own chronological message thread.
- Only the shift's charge nurse and the linked nurse who created the request can read or add messages.
- A message has an author, role, body, and server timestamp.
- Blank messages and duplicate in-flight submissions are prevented.
- New messages appear through the existing connected realtime experience.
- Notification behavior may alert an eligible participant to a new message, but the thread always reloads current server data when opened.
- There is no global chat inbox, direct messaging, group chat, attachments, reactions, editing, or deletion.

### Manual Checks and Edge Cases

- Send one message from each role and confirm both sessions show the same order.
- Confirm a different joined nurse cannot read or post to the thread.
- Submit while disconnected and confirm the message is not queued silently.
- Reopen a request and confirm its thread does not contain messages from another request.

## US4: Review and Resolve an Issue Request

As a charge nurse, I want to mark an issue as reviewed or resolved so the requesting nurse can see that it was acknowledged without changing assignment data.

### Acceptance Criteria

- An issue has a clear `Open`, `Reviewed`, or `Resolved` state.
- Only the charge nurse can mark an issue reviewed or resolved.
- Marking an issue reviewed or resolved does not alter bed assignments, patients, acuity, or assignment flags.
- The requesting nurse sees state changes live and can still read the thread.
- A resolved issue remains in request history.
- A resolved issue can be reopened only through an explicit charge-nurse action.

### Manual Checks and Edge Cases

- Mark an open issue reviewed, then resolved, and confirm no assignment changes.
- Confirm the joined nurse sees each current state.
- Reopen a resolved issue and confirm its message history remains intact.
- Confirm a joined nurse cannot change the issue state.

## US5: Separate Swap Acceptance from Swap Completion

As a charge nurse and requesting nurse, I want a swap request to distinguish approval from the actual assignment change so nobody assumes an accepted request has already moved a patient.

### Acceptance Criteria

- Existing `Pending`, `Accepted`, and `Declined` swap decisions remain supported.
- An accepted swap with no linked manual override is labeled `Accepted — assignment change pending`.
- A swap becomes `Completed` only after a successful manual assignment override is explicitly linked to it.
- Completion records the linked override and server timestamp.
- If a later move supersedes the linked override, the request remains historically completed but clearly says the assignment was changed again later.
- Declining a swap does not change assignments.
- Accepting a swap does not change assignments automatically.
- The thread remains available in every decision or completion state.

### Manual Checks and Edge Cases

- Accept a swap and confirm the effective assignment does not change.
- Complete the accepted swap through a valid manual move and confirm the linked bed assignment changes.
- Confirm a declined swap cannot be marked completed.
- Confirm an unrelated manual move cannot silently complete the request.
- Reverse the same bed through a later request and confirm the earlier request says its completed move was later superseded.

## US6: Share a Readable Board Snapshot

As a charge nurse, I want to preview and share a current floor-board image so I can use the device share sheet for an intentional point-in-time handoff.

### Acceptance Criteria

- Sharing is available only from a loaded charge nurse floor board.
- A preview identifies the floor, census, capture time, doctor sides, nurse assignments, beds, acuity, and current flags in a readable static layout.
- The snapshot is generated locally and is not uploaded to NurseFlow or saved as shift state.
- The user sees a privacy reminder and must choose the native share action explicitly.
- Cancelling the native share sheet is not treated as an error.
- Capture or share failure leaves the active board unchanged and shows a retryable message.
- Joined nurses cannot share the full charge board.

### Manual Checks and Edge Cases

- Preview a small and a large floor and confirm no nurse or occupied bed is clipped.
- Cancel sharing and confirm no error banner appears.
- Force capture failure and confirm the board remains usable.
- Confirm the snapshot reflects the current effective assignment, including saved overrides.

## US7: Use the Active Shift on Phone and Tablet

As a charge nurse or joined nurse, I want the active-shift screens to adapt to phone and tablet widths so the same workflow remains clear on both form factors.

### Acceptance Criteria

- Phone remains the primary layout and keeps the established navigation and vertical card flow.
- Tablet layouts use available width to improve scanning without revealing additional data or adding tablet-only actions.
- The charge board can show a side list and focused nurse detail side by side on supported tablet widths.
- Request detail and joined-nurse assignment content use readable maximum widths or columns rather than stretching text edge to edge.
- Rotation and resizing preserve the current screen and selected context.
- Safe areas, keyboard avoidance, and minimum 44-point touch targets are respected.

### Manual Checks and Edge Cases

- Check the charge board, request detail, and joined-nurse assignment at representative phone and tablet widths.
- Rotate a tablet while a nurse is selected and confirm the selection remains understandable.
- Confirm long nurse names, room labels, diagnoses, and messages wrap without overlap.
- Confirm no tablet preference is saved in active shift or profile data.

## US8: Improve Accessibility, Polish, and Large-Floor Performance

As a user, I want the refined screens to remain readable, operable, and responsive so the new interactions do not reduce safety or usability.

### Acceptance Criteria

- Swipe-reveal move actions have an accessible action and a tap-only nurse picker.
- Acuity and warning meaning never rely on color alone.
- Interactive controls have accessible names, roles, states, and at least 44-point targets.
- Screen-reader focus moves predictably when a confirmation, warning, or error appears.
- Text remains usable with larger accessibility font sizes.
- Large board and thread lists use appropriate virtualization and stable item rendering where measurement shows it is needed.
- Polish reuses the existing visual language rather than redesigning established workflows.

### Manual Checks and Edge Cases

- Complete a manual move by revealing `Move` and tapping an eligible nurse.
- Check the main Phase 8 flow with VoiceOver or TalkBack.
- Check larger text settings for clipped controls and unreadable cards.
- Scroll a representative large floor and long request thread and confirm interaction remains responsive.

## US9: Preserve Previous and Later Phase Boundaries

As a learner building NurseFlow, I want Phase 8 to extend the connected app without replacing proven behavior or implementing later optimizers early.

### Acceptance Criteria

- Rerunning the current deterministic assignment remains an explicit charge-nurse action.
- Phase 8 does not change the Phase 1 assignment rules.
- Existing auth, server authorization, realtime scoping, invites, notification routing, and disconnected-action behavior remain intact.
- Manual overrides and request messages use server-fresh authorization and do not introduce an offline write queue.
- No AI, EHR/EMR integration, automated acuity, multi-hospital tools, handoff notes, or production assignment optimizer is added.

### Manual Checks and Edge Cases

- Run the previous-phase regression checks after Phase 8 work.
- Confirm a joined nurse still cannot read the full floor board.
- Confirm Phase 9 data or services do not appear in the Phase 8 implementation.

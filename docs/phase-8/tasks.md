# Phase 8 Implementation Tasks

This task list plans Phase 8 in small, ordered, independently testable steps. No implementation code is part of the planning task.

Phase 8 adds manual assignment overrides, request-scoped threads and lifecycle clarity, local board snapshot sharing, responsive tablet layouts, accessibility improvements, and measured large-floor performance cleanup. It does not add the Phase 9 production assignment optimizer.

Status legend:

- Done
- No marker means not done yet.

## Build Order Summary

1. Confirm scope, current touchpoints, and compatibility risks.
2. Define effective-assignment derivation and override validation.
3. Add the server-owned manual override write boundary.
4. Add accessible move selection, drag interaction, confirmation, and warnings.
5. Handle assignment reruns after overrides.
6. Add request-thread storage and authorization.
7. Add charge and nurse thread UI.
8. Add issue review/resolution and swap completion.
9. Add local board snapshot preview and native sharing.
10. Add responsive layout foundations and tablet active-shift layouts.
11. Complete accessibility, visual polish, and measured performance cleanup.
12. Run Phase 8 manual and regression passes.

## Planning and Guardrails

### Done Task 0.1: Create Phase 8 Planning Docs

Story coverage: US1-US9

Build:

- Add Phase 8 user stories, data model, mobile design, screens, and task documents.
- Treat `docs/phases.md` as the canonical current roadmap.
- Preserve the remaining Phase 1-7 behavior and document Phase 9 exclusions.
- Write no app implementation code.

Manual validation:

- Point to `docs/phase-8/` and explain the included features and later-phase boundaries.
- Confirm only planning documentation and the understanding checklist changed.

### Done Task 0.2: Confirm Existing App and Server Touchpoints

Story coverage: US1-US9

Build:

- Review the active shift model, effective board derivation, assignment flags, assignment rerun, request repositories, request detail routes, joined nurse scoped view, realtime refresh, notification routing, and connection-disabled actions.
- Identify the smallest files and server functions each Phase 8 feature will affect.
- Record compatibility risks before runtime changes.
- Added `docs/phase-8/app-touchpoints.md` with the current app/server boundaries, likely files, focused server operations, and compatibility risks.
- Confirmed that routine effective-assignment reads need one shared helper and a bed-keyed active projection, while override history stays in indexed server rows.
- Confirmed that request lifecycle data remains in the active-shift snapshot while request-thread messages use separate append-only server rows.
- Revalidated these boundaries on 2026-07-26 after break scheduling was removed;
  no Phase 8 runtime symbol, schema, dependency, or configuration was added.

Manual validation:

- Explain where generated assignment data ends and Phase 8 override data begins.
- Explain which request data is shift snapshot data and which thread data is append-only server data.
- Confirm no runtime behavior changed.

### Done Maintenance Task: Remove Break Scheduling

Build:

- Remove the route, screen, scheduler, data types, assignment hook, board and
  nurse-view presentation, notification event, and joined-nurse RPC field.
- Update the Supabase joined-nurse RPC, active-shift notification trigger, event
  constraint, and existing active-shift snapshots.
- Remove the retired phase from the roadmap while preserving Phase 9 production
  assignment optimization.

Validation:

- TypeScript and lint pass.
- Android production export and Hermes compilation pass.
- App and current Supabase setup definitions contain no stale route, type,
  payload, event, or function references.
- Deployed Supabase verification reports zero legacy shift snapshots, zero
  legacy notification events, and clean function and constraint definitions.

## Manual Assignment Override Foundation

### Task 1.1: Add Effective-Assignment Derivation

Story coverage: US1, US2, US5, US9

Build:

- Add the app-facing `activeAssignmentOverridesByBedId` dictionary type without changing existing generated assignment fields.
- Add one pure derivation boundary that uses a direct bed-key lookup and falls back to the generated assignment.
- Make a missing dictionary behave as an empty dictionary.
- Keep superseded history out of this routine board model.
- Add focused tests for zero, one, replaced same-bed, and removed-after-rerun active overrides.

Manual validation:

- Existing shifts with no overrides render the same assignments.
- Applying one override changes only the target bed's effective nurse.
- Replacing one bed's dictionary value changes only that bed and does not require scanning other override history.
- The generated baseline remains inspectable and unchanged.
- TypeScript, targeted tests, and lint pass.

### Task 1.2: Recalculate Loads and Flags from Effective Assignment

Story coverage: US2, US8, US9

Build:

- Route nurse loads and assignment-flag calculations through the effective assignment.
- Preserve existing flag types and messages where possible.
- Add a proposed-move preview that distinguishes blocking reasons from non-blocking warnings.
- Keep the Phase 1 assignment generator unchanged.

Manual validation:

- A proposed overload appears before save and after a confirmed move.
- A red-to-LPN proposal is blocking.
- Existing unassigned and imbalance flags still work with no overrides.
- TypeScript, targeted tests, and lint pass.

### Task 1.3: Add Server Manual-Override Transaction

Story coverage: US1, US2, US5, US9

Build:

- Add an indexed server override-history record with a partial unique constraint allowing at most one active row per shift and bed.
- Add one authenticated server action for confirming a bed move.
- Revalidate shift ownership, active status, baseline result ID, current effective owner, room coverage, bed occupancy, nurse eligibility, and warning acknowledgement.
- Supersede the current same-bed row and insert the replacement active row atomically, with server ordering and idempotency protection.
- Return current server state when validation fails because the proposal is stale.

Manual validation:

- Owning charge nurse can save one valid move.
- Joined nurse and unrelated charge account cannot save overrides.
- Stale baseline or source nurse is rejected without a partial move.
- A red bed cannot be moved to an LPN.
- Concurrent same-bed attempts cannot leave two active override rows.
- Routine board reads receive only the active bed-keyed projection, while authorized history queries retain superseded rows.
- TypeScript, server checks, and lint pass.

### Task 1.4: Add Accessible Move-Assignment Picker

Story coverage: US1, US2, US8

Build:

- Add `Adjust assignments` mode to the charge board.
- Add a named-props bed-row action that opens eligible nurse choices.
- Show why ineligible nurse targets cannot be chosen.
- Reuse the same preview and confirmation boundary planned for drag-and-drop.

Manual validation:

- Complete a move without a drag gesture.
- Screen reader identifies the bed, current nurse, target choices, and disabled reasons.
- Cancelling leaves the board unchanged.
- TypeScript and lint pass.

### Task 1.5: Add Bed Drag-and-Drop Interaction

Story coverage: US1, US8

Build:

- Make one occupied bed row draggable from a dedicated handle or intentional long press.
- Highlight eligible nurse targets and preserve normal board scrolling.
- Return invalid or cancelled drags to the origin.
- Send valid drops into the same confirmation used by the accessible picker.
- Use existing gesture dependencies where sufficient; justify any new dependency before adding it.

Manual validation:

- Drag a valid bed to an eligible nurse and reach confirmation.
- Scroll the board without accidental drags.
- Invalid target and cancelled drag make no saved change.
- Accessible picker still works when dragging is unavailable.
- TypeScript, lint, and device interaction checks pass.

### Task 1.6: Add Override Confirmation and Warning Acknowledgement

Story coverage: US1, US2, US5, US8

Build:

- Show before/after nurse loads, blocking reasons, and non-blocking warnings.
- Require explicit acknowledgement for non-blocking warnings.
- Allow an eligible accepted swap request to be linked deliberately.
- Add saving, success, stale-state, and retry states.

Manual validation:

- Hard-invalid move cannot be confirmed.
- Overload warning can be acknowledged and confirmed.
- Saved acknowledgement does not hide the active overload flag.
- In-flight duplicate confirmation is prevented.
- TypeScript and lint pass.

### Task 1.7: Refresh Charge and Joined-Nurse Views After a Move

Story coverage: US1, US2, US5, US9

Build:

- Reuse existing realtime refresh boundaries after a successful override.
- Refresh the charge board's `activeAssignmentOverridesByBedId` projection without loading superseded history.
- Return the affected bed in only the newly assigned nurse's scoped view.
- Refresh current charge-board flags and loads.
- Keep full override audit data out of joined-nurse responses.

Manual validation:

- Two connected sessions show the move without manual refresh.
- Former nurse loses the bed; new nurse gains it.
- Joined nurse still cannot read the full board or override history.
- TypeScript, lint, and two-session check pass.

### Task 1.8: Handle Assignment Rerun

Story coverage: US1, US2, US9

Build:

- Warn before rerunning assignment when active overrides exist.
- On confirmation, create the new generated baseline, supersede prior active server rows, and remove them from the active bed-keyed projection.
- Do not implement a new assignment algorithm.

Manual validation:

- Cancelling rerun keeps overrides effective.
- Confirming rerun restores the generated result as the new baseline.
- TypeScript, targeted tests, and lint pass.

## Request Threads and Lifecycle

### Task 2.1: Add Request-Message Server Model and Authorization

Story coverage: US3, US9

Build:

- Add append-only request message records with request, shift, author, role, body, server time, and optional idempotency key.
- Authorize only the shift owner and the request's linked nurse.
- Add server actions for listing and appending messages.
- Keep message bodies out of notification payloads.

Manual validation:

- Charge and requesting nurse can read the same thread.
- Another nurse, another charge account, and signed-out user are denied.
- Blank and duplicate messages are rejected safely.
- Server checks and lint pass.

### Task 2.2: Add Realtime Request-Thread Refresh

Story coverage: US3, US9

Build:

- Subscribe or refetch through the narrow request-thread boundary.
- Start and stop thread listeners with screen, session, shift, and access lifecycle.
- Keep full active-shift data out of joined-nurse thread reads.

Manual validation:

- A message appears in the other authorized session without manual refresh.
- Leaving the detail screen stops duplicate thread updates.
- Removed access and ended shift move the nurse to a safe state.
- TypeScript, lint, and two-session check pass.

### Task 2.3: Add Charge Request Thread UI

Story coverage: US3, US4, US5, US7, US8

Build:

- Extend charge request detail with chronological messages and a keyboard-safe composer.
- Keep request metadata and lifecycle actions visually separate from messages.
- Add empty, sending, disconnected, failed, and retry states.
- Use named component prop types for thread rows and composer boundaries.

Manual validation:

- Charge nurse can send a message and see server order.
- Blank and double-submit are prevented.
- Failed submit retains draft text for a connected retry but creates no offline queue.
- Larger text and keyboard do not hide the send action.
- TypeScript and lint pass.

### Task 2.4: Add Joined-Nurse Request Detail and Thread UI

Story coverage: US3, US5, US7, US8

Build:

- Let nurse-owned request history rows open a nurse-scoped detail route.
- Show the same thread with read-only lifecycle state and a composer.
- Preserve safe ended-shift, removed-access, missing-request, and disconnected states.

Manual validation:

- Requesting nurse can read and reply to their request.
- Nurse cannot open another nurse's request by changing route parameters.
- Back returns to the nurse-scoped assignment.
- TypeScript and lint pass.

### Task 2.5: Add Issue Reviewed, Resolved, and Reopened States

Story coverage: US4, US9

Build:

- Add optional issue lifecycle fields with existing issues defaulting to open.
- Add charge-only server actions for reviewed, resolved, and reopened transitions.
- Display the current state in charge and nurse views.
- Do not touch assignments, patients, acuity, or flags.

Manual validation:

- Move an issue through open → reviewed → resolved → open.
- Joined nurse sees each update but cannot change it.
- Existing issues without the new field display as open.
- Assignment data remains byte-for-byte unchanged by lifecycle actions where practical to verify.
- TypeScript, targeted tests, and lint pass.

### Task 2.6: Add Accepted-Swap Completion State

Story coverage: US5, US9

Build:

- Derive pending, declined, accepted/pending-change, and completed display states.
- Add `Complete with assignment move` only for accepted swaps.
- Link completion only after the related manual override succeeds.
- Derive `Completed — assignment later changed` when the linked override is now superseded by a later move.
- Keep accept and decline status-only behavior unchanged.

Manual validation:

- Accepting a swap does not move a bed.
- Completing it through a valid move records the linked override and completed time.
- Declined and unrelated requests cannot be marked completed.
- Charge and joined nurse see the same completion state.
- Reversing the same bed through a later completed request preserves both request histories while only the newest override remains active.
- TypeScript, targeted tests, and lint pass.

### Task 2.7: Add Safe Request-Activity Notifications

Story coverage: US3, US4, US5, US9

Build:

- Decide which thread message and lifecycle changes warrant a push event without excessive noise.
- Route eligible generic notifications to current request detail.
- Include only routing IDs and safe generic copy.
- Preserve foreground realtime when notifications are unavailable.

Manual validation:

- Eligible participant can open a notification into current authorized request state.
- Message body and patient details are absent from the payload.
- Ended shift, removed access, or resolved/missing target uses safe recovery.
- Notification failure does not break request writes.

## Board Snapshot Sharing

### Task 3.1: Confirm Capture Dependency and Static Snapshot Boundary

Story coverage: US6, US8, US9

Build:

- Review current official Expo and capture-library guidance.
- Confirm whether the product-spec `react-native-view-shot` approach is compatible with the current Expo version.
- Add only the minimal justified dependency during implementation.
- Define a purpose-built static board layout separate from interactive scroll chrome.

Manual validation:

- Explain why the chosen capture boundary can include the full board rather than only the visible viewport.
- Confirm no image upload, database record, share history, or request attachment is added.
- Dependency install, TypeScript, and lint pass when implementation begins.

### Task 3.2: Add Board Snapshot Preview

Story coverage: US6, US7, US8

Build:

- Render floor, census, captured time, sides, nurses, effective assignments, acuity labels, and concise flags into a static preview.
- Add privacy and point-in-time copy.
- Add generating, ready, failed, and retry states.
- Keep capture available only to the charge nurse with a loaded board.

Manual validation:

- Small and representative large floors render without clipped nurse or occupied-bed rows.
- Manual overrides appear in the snapshot.
- Joined nurse cannot open the full-board preview.
- TypeScript and lint pass.

### Task 3.3: Add Native Share Action and Temporary-File Cleanup

Story coverage: US6, US9

Build:

- Open the native share sheet only after explicit user action.
- Treat cancellation as a normal outcome.
- Show a retryable capture/share error without changing board state.
- Clean up temporary capture files when safe.

Manual validation:

- Share through at least one supported destination on iOS or Android.
- Cancel without an error banner.
- Force failure and confirm the floor board remains usable.
- Confirm NurseFlow stores no snapshot record.

## Responsive Layout and Polish

### Task 4.1: Add Shared Compact and Expanded Layout Boundary

Story coverage: US7, US8, US9

Build:

- Define one content-width breakpoint and reusable responsive container behavior.
- Keep compact phone behavior as the default.
- Preserve route and selected-screen state across resizing and rotation.
- Store no layout preference in domain data.

Manual validation:

- Representative phone and tablet widths choose the intended layout.
- Rotation does not reset active shift or request context.
- Existing setup screens remain readable at a centered maximum width.
- TypeScript and lint pass.

### Task 4.2: Add Expanded Charge Floor Board

Story coverage: US1, US2, US6, US7, US8

Build:

- Add doctor-side/nurse summary pane and selected-nurse detail pane.
- Keep board-level warnings visible.
- Support move mode and accessible move controls in expanded layout.
- Avoid rendering every nurse's full detail simultaneously.

Manual validation:

- Tablet portrait and landscape show readable panes without horizontal clipping.
- Selection remains clear after rotation.
- Phone board remains unchanged in structure.
- TypeScript, lint, and tablet interaction checks pass.

### Task 4.3: Add Expanded Request and Joined-Nurse Layouts

Story coverage: US3, US4, US5, US7, US8

Build:

- Use metadata/thread panes on request detail where width permits.
- Give joined-nurse assignment and request content readable maximum widths or columns.
- Preserve nurse-scoped authorization and compact layout.

Manual validation:

- Long thread and long assignment content are readable in tablet portrait and landscape.
- Keyboard does not cover the composer.
- Joined nurse never sees charge-only controls or full-board data.
- TypeScript and lint pass.

### Task 4.4: Complete Visual Consistency Pass

Story coverage: US7, US8

Build:

- Normalize hierarchy, spacing, chips, warnings, loading, pressed, focused, disabled, success, and error states on changed screens.
- Reuse current tokens and components before adding new primitives.
- Avoid unrelated redesign of earlier setup flows.

Manual validation:

- Changed screens feel consistent with established NurseFlow screens.
- Long text wraps without overlapping actions.
- Loading and error states do not cause unsafe layout jumps.
- TypeScript and lint pass.

## Accessibility and Performance

### Task 5.1: Run Phase 8 Accessibility Pass

Story coverage: US8

Build:

- Audit semantic roles, accessible names, states, focus order, modal focus return, dynamic type, reduced motion, color-independent meaning, and target sizes.
- Fix issues only on Phase 8 changed flows and shared primitives they directly use.
- Document remaining non-Phase-8 accessibility debt separately.

Manual validation:

- Complete a manual move without dragging using VoiceOver or TalkBack.
- Read and reply to a request thread with a screen reader.
- Use larger text without clipped lifecycle or share controls.
- Confirm key tap targets meet 44-point minimum.

### Task 5.2: Measure Representative Large-Floor Performance

Story coverage: US8, US9

Build:

- Define a representative large-floor fixture for development measurement only.
- Measure board render/scroll, drag responsiveness, thread scroll, and snapshot capture before optimizing.
- Record the actual bottleneck and baseline results.
- Do not change the assignment algorithm.

Manual validation:

- Reproduce the same large-floor scenario consistently.
- Explain which measured interaction needs cleanup and which does not.
- Confirm the fixture does not become production shift data.

### Task 5.3: Apply Focused Performance Cleanup

Story coverage: US8, US9

Build:

- Virtualize long lists only where measurement justifies it.
- Stabilize row props/callbacks and avoid repeated whole-board derivation where needed.
- Confirm routine effective-owner lookup uses the active bed-keyed dictionary and never scans server override history.
- Keep hierarchical labels and accessibility semantics intact.
- Avoid a new list library unless existing primitives cannot meet measured needs.

Manual validation:

- Repeat the large-floor measurements and record improvement or unchanged results.
- Confirm small floors and accessibility behavior do not regress.
- TypeScript, targeted tests, lint, and device scroll checks pass.

## Manual and Regression Passes

### Task 6.1: Manual Override Pass

Build:

- No new feature work.
- Validate eligible moves, blocked moves, warning acknowledgement, stale writes, realtime refresh, and rerun behavior.

Manual validation:

- Complete all US1 and US2 checks on at least one physical or representative native device.
- Verify both drag and non-drag move paths.

### Task 6.2: Request Thread and Lifecycle Pass

Build:

- No new feature work.
- Validate authorization, realtime messages, disconnected state, issue lifecycle, swap decision, and swap completion across two sessions.

Manual validation:

- Complete all US3-US5 checks.
- Verify no thread leaks between requests or nurses.

### Task 6.3: Sharing Pass

Build:

- No new feature work.
- Validate small/large snapshot capture, privacy copy, share success, cancellation, failure, and lack of server persistence.

Manual validation:

- Complete all US6 checks on supported iOS and Android environments where available.

### Task 6.4: Responsive, Accessibility, and Performance Pass

Build:

- No new feature work.
- Validate compact/expanded layouts, rotation, dynamic type, screen reader paths, target sizes, and large-floor measurements.

Manual validation:

- Complete the design review matrix in `mobile-design.md`.
- Record any environment-specific limitations rather than marking unchecked behavior done.

### Task 6.5: Previous-Phase Regression Pass

Build:

- No new feature work.
- Recheck floor setup, shift setup, assignment, carry-over, auth, server persistence, realtime, invites, joined-nurse scoping, requests, notifications, and connection-disabled actions.

Manual validation:

- Core Phase 1-7 workflows still work.
- Manual overrides do not mutate floor templates or previous-shift snapshots unexpectedly.
- Notification or share failure does not break connected writes.

### Task 6.6: Scope and Beginner-Readability Pass

Build:

- Review for scope leaks and simplify only confusing Phase 8 boundaries.
- Update relevant task markers and explanatory docs.
- Run the repository teaching checkpoint.

Manual validation:

- No Phase 9 optimizer, AI, EHR/EMR, automated acuity, multi-hospital, handoff-note, global-chat, offline-write-queue, or snapshot-history code exists.
- A beginner can explain generated versus effective assignment, active bed-keyed lookup versus server override history, accepted versus completed swap, request-scoped authorization, and why snapshots are local and temporary.

## Later, Not Phase 8

- Production backend assignment optimizer, solver objectives, and complex optimizer suite (Phase 9).
- AI staffing or acuity recommendations.
- EHR/EMR integration or automated acuity from vitals.
- Multi-hospital administration.
- Shift handoff notes.
- Global chat, direct messaging, attachments, reactions, or read receipts.
- Offline write queues or conflict merging.
- Persisted board snapshot gallery or share history.

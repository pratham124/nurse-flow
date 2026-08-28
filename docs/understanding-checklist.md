# Understanding Checklist

Use this file as the running teaching checklist after each completed task. Keep entries short, concrete, and tied to the actual work completed.

## How To Use This Checklist

For each task, add a dated section with:

- Task: what changed.
- Problem understanding: what the human should be able to explain about the problem and why it existed.
- Solution understanding: what the human should be able to explain about the implementation, design decisions, and edge cases.
- Broader context: what the human should understand about why the change matters and what it affects.
- Verification: how understanding was checked, such as restatement, open-ended question, multiple-choice quiz, code walkthrough, debugger walkthrough, or manual test explanation.
- Status: `pending`, `in progress`, or `verified`.

## Template

### YYYY-MM-DD - Task Name

- Task:
- Problem understanding:
  - [ ] What problem existed?
  - [ ] Why did it exist?
  - [ ] What branches or alternatives were considered?
- Solution understanding:
  - [ ] What changed?
  - [ ] Why was this solution chosen?
  - [ ] What design decisions matter?
  - [ ] What edge cases matter?
- Broader context:
  - [ ] Why does this matter to NurseFlow?
  - [ ] What current behavior does it impact?
  - [ ] What future work could it influence?
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

## Running Items

### 2026-07-18 - Review Phase 7 Connection and Cache Tasks

- Task: Review Phase 7 Tasks 3.1, 3.2, and 3.3 and avoid adding redundant connection UI or unvalidated offline caching.
- Problem understanding:
  - [x] Phase 6 already shows connecting, live, reconnecting, disconnected, and error states on both affected screens.
  - [x] Persistent board and assignment caches would add privacy, lifecycle, and testing responsibilities.
  - [x] There is not yet product evidence that offline cached clinical views are necessary for this prototype.
- Solution understanding:
  - [x] The existing `LiveStatusChip` remains unchanged and continues to provide connection feedback and manual refresh.
  - [x] Tasks 3.2 and 3.3 are deferred until real hospital testing demonstrates a need.
  - [x] No patient, board, or assignment snapshot is written to device storage.
- Broader context:
  - [x] Reusing the Phase 6 status boundary keeps NurseFlow smaller and easier to test.
  - [x] Offline caching can be reconsidered later without changing the current server model.
  - [x] No offline writes, pending sync, queued actions, or other future feature was introduced.
- Verification:
  - [x] Human challenged the need for offline caching before accepting the implementation.
  - [x] Gaps were explained: this would have been read-only resilience, not full offline use.
  - [x] Code-specific check completed: human recognized the existing connection-status component.
  - [x] Product decision completed: keep Phase 6 status UI and defer both cache tasks.
- Status: verified

### 2026-07-10 - Add Notification Permission State

- Task: Complete Phase 7 Task 1.1 by reading the signed-in device's notification permission and showing its status on Home.
- Problem understanding:
  - [ ] NurseFlow needs to know the device permission state before later token registration work can be safe and understandable.
  - [ ] Notification permission belongs to device/session infrastructure, not active shift data.
  - [ ] Denied or unavailable notifications must not block the connected app workflow.
- Solution understanding:
  - [ ] `src/store/NotificationPermissionContext.tsx` reads the current Expo permission after sign-in and normalizes platform results into beginner-readable app states.
  - [ ] `src/components/NotificationPermissionCard.tsx` maps each state to a short label and helper message in a notification status dialog without exposing technical details.
  - [ ] `src/app/_layout.tsx` provides notification permission state to signed-in screens, and `src/screens/HomeScreen.tsx` opens that dialog from the header bell.
  - [ ] This task reads existing permission only; it does not prompt, create a push token, or register anything with the server.
- Broader context:
  - [ ] Task 1.1 establishes the device-permission boundary that Task 1.2 can build on for push token registration.
  - [ ] The app remains usable when permission is denied, unavailable, or not yet decided.
- Verification:
  - [ ] Human restated understanding first.
  - [x] Gaps around server-authoritative input, abandoned-run recovery, atomic
    finalization, and success-only downstream signals were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-07-08 - Plan Phase 7 Push Notifications and Lightweight Connection Resilience

- Task: Create and revise Phase 7 planning docs for push notifications, read-only cached views during brief disconnects, reconnect states, and disabled-action copy.
- Problem understanding:
  - [ ] The first Phase 7 plan included an offline write queue, but that is probably overbuilt for a hospital-first MVP.
  - [ ] Phase 7 should add background awareness and temporary-disconnection readability without pretending offline edits are safely saved.
  - [ ] Offline write queues, drag-and-drop override, board snapshot sharing, tablet layout, request threads, global chat, AI, production assignment optimization, and advanced break optimization remain later-phase work.
- Solution understanding:
  - [ ] `docs/phase-7/user-stories.md` defines the Phase 7 user stories and acceptance criteria.
  - [ ] `docs/phase-7/data-model.md` documents push token records, notification events, cached shift views, and connection display state.
  - [ ] `docs/phase-7/mobile-design.md` documents phone-first notification, cached-view, reconnect, and disabled-action UI behavior.
  - [ ] `docs/phase-7/screens.md` maps the affected screens and recovery states.
  - [ ] `docs/phase-7/tasks.md` orders small implementation tasks and marks only planning Task 0.1 done.
  - [ ] `docs/phases.md` now describes Phase 7 as lightweight connection resilience rather than full offline sync.
- Broader context:
  - [ ] Phase 7 builds on Phase 6 realtime/invite behavior instead of replacing it.
  - [ ] Push notifications are background awareness, not source-of-truth app state.
  - [ ] Cached views are readable saved copies, not permission to edit disconnected shift data.
  - [ ] Requiring a connection for writes keeps the MVP simpler and easier to explain.
- Verification:
  - [x] Human restated the request fields, duplicate-request guard, phased rerun
    scope, and failure behavior before the remaining gaps were explained.
  - [x] Gaps around authoritative server input, revision versus baseline
    preconditions, ambiguous retry identity, and safe failure behavior were
    explained.
  - [ ] Documentation-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-07-09 - Confirm Phase 7 Touchpoints and Expo Notification Requirements

- Task: Complete Phase 7 Tasks 0.2 and 0.3.
- Problem understanding:
  - [x] Phase 7 needs mapped ownership boundaries before notification or cache code is added.
  - [x] Push notifications need OS permission, a device token, server registration, and a current-data reload after a tap.
  - [x] A development build and platform credentials are required to test remote push; Expo Go is not enough.
- Solution understanding:
  - [x] `docs/phase-7/app-touchpoints.md` records the existing route, state, service, save, realtime, invite, request, and persistence touchpoints.
  - [x] `docs/phase-7/expo-notifications-setup.md` records current Expo SDK 55 permission, token, iOS, Android, and development-build requirements.
  - [x] No runtime app code, package, app config, schema, cache, or token was added.
- Broader context:
  - [x] Keeping notification, cache, connection, draft, and active-shift responsibilities separate prevents scope leaks such as offline write queues.
  - [x] The next task can add permission state with clear device/build requirements instead of relying on Expo Go behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific walkthrough: `ServerWorkspaceContext` owns connection state because it affects server-backed workspace features; `WorkflowDraftContext` is only unsaved form-like input.
  - [x] Quiz or walkthrough completed: remote push needs a native build with the app's notification capability and platform credentials; an Android Studio emulator with Google Play services is a supported later test option.
- Status: verified

### 2026-07-08 - Phase 6 Manual Pass Prep

- Task: Prepare Phase 6 Tasks 7.1 through 7.6 by capturing automated validation evidence, adding a manual two-session checklist, completing the scope review, and clarifying the Phase 6 service boundaries.
- Problem understanding:
  - [ ] Tasks 7.1 through 7.4 are manual validation tasks, not feature-build tasks.
  - [ ] Two-session realtime and invite behavior should not be marked done from TypeScript, lint, or export alone.
  - [ ] The Phase 6 scope test must avoid adding push, offline queues, conflict systems, drag-and-drop override, board sharing, tablet layout, or AI.
- Solution understanding:
  - [ ] `docs/phase-6/manual-test-pass.md` records automated validation and the remaining manual checklist for 7.1 through 7.4.
  - [ ] `docs/phase-6/tasks.md` marks only Tasks 7.5 and 7.6 done because those were actually completed in this pass.
  - [ ] `src/services/README.md` explains that invite code work belongs in `shiftInviteRepository` and realtime events should trigger refetches through `ServerWorkspaceContext`.
  - [ ] No runtime feature code was added.
- Broader context:
  - [ ] This keeps Phase 6 honest by separating automated build confidence from real multi-session manual validation.
  - [ ] The manual checklist gives the next test pass a clear route without jumping into Phase 7.
  - [ ] The service notes help a beginner explain where invite and realtime responsibilities live.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-07-08 - Expire Invites And Clean Up Realtime

- Task: Complete Phase 6 Tasks 6.1 and 6.2 by expiring active nurse invites during shift end and making realtime listener setup resilient to sign-out, navigation, and Fast Refresh.
- Problem understanding:
  - [ ] Active invite codes should not remain usable after the active shift is closed.
  - [ ] Realtime listeners are foreground subscriptions and should stop when the subscribed shift or nurse access context goes away.
  - [ ] Supabase can reuse a same-named channel, so development remounts can accidentally attach duplicate handlers if stale channels are not cleaned up.
- Solution understanding:
  - [ ] `src/services/shiftInviteRepository.ts` adds `expireActiveShiftNurseInvites`, which changes active invite rows for the shift to `expired`.
  - [ ] `src/services/serverWorkspaceRepository.ts` calls invite expiration before closing the active shift, while Home still saves the carry-over snapshot first.
  - [ ] `src/services/realtimeWorkspaceRepository.ts` removes stale channels with the same purpose and creates a unique channel name for each new listener.
  - [ ] Existing joined nurse refresh behavior still turns an ended shift into the safe `Shift ended` screen state.
- Broader context:
  - [ ] This closes the Phase 6 shift-end lifecycle without adding push notifications, offline queues, conflict resolution, drag-and-drop, board sharing, tablet layout, or AI.
  - [ ] Charge nurse and joined nurse realtime state stays separate from saved shift data.
  - [ ] Future cleanup or access-removal work can build on the same service boundaries.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-07-08 - Rework Home Header

- Task: Rework the home header so the brand sits in a burgundy diagonal panel and account actions sit on the neutral side.
- Problem understanding:
  - [ ] The previous header repeated role text that did not help the user.
  - [ ] The `NF` logo mark added visual weight without adding useful information.
- Solution understanding:
  - [ ] `src/screens/HomeScreen.tsx` now shows `Nurse Flow` as white text inside the burgundy brand panel.
  - [ ] The user's display name and `Sign out` action remain on the neutral side.
  - [ ] The sign-out behavior did not change.
- Broader context:
  - [ ] This is a visual polish change, not an auth or navigation change.
  - [ ] The header still separates product identity from session controls.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-07-08 - Plan Future Request Threads

- Task: Update `docs/phases.md` so future request follow-up is documented as request threads rather than a global chat feature.
- Problem understanding:
  - [ ] Phase 6 supports live request cards and swap status decisions, but does not support request conversations or issue resolution.
  - [ ] A global chat inbox could make charge nurse work harder to triage than request-attached follow-up.
- Solution understanding:
  - [ ] Phase 8 now includes threaded conversations attached to issue and swap requests.
  - [ ] Phase 8 now includes issue acknowledgement/resolution and a clearer swap completion flow.
  - [ ] No runtime code, data model, or server behavior changed.
- Broader context:
  - [ ] Request threads preserve the charge nurse request queue while allowing future back-and-forth.
  - [ ] Swap acceptance remains separate from actually changing assignments until a later assignment override workflow exists.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-07-08 - Plan Later Assignment Optimizer Phase

- Task: Update `docs/phases.md` so the Phase 1 deferred production assignment optimizer is represented as a committed later phase.
- Problem understanding:
  - [ ] Phase 1's local assignment algorithm proves the workflow but is not a clinical-grade optimizer.
  - [ ] Phase 5 adds backend/auth/server persistence, but should not silently expand into optimization work.
- Solution understanding:
  - [ ] `docs/phases.md` now excludes a production assignment optimizer from Phase 5.
  - [ ] `docs/phases.md` now defines Phase 9 as the production assignment optimizer phase.
  - [ ] No runtime code, data model, or server behavior changed.
- Broader context:
  - [ ] The app can keep using the understandable local/server snapshot assignment flow until optimizer work is explicitly promoted.
  - [ ] A future optimizer should be planned separately with its own constraints, tests, and safety checks.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-07-08 - Plan Later Break Scheduling Optimizer Phase

- Task: Update `docs/phases.md` so the Phase 4 deferred advanced break scheduling logic is represented as a committed later phase.
- Problem understanding:
  - [ ] Phase 4's local break scheduler proves the workflow but intentionally avoids complex multi-break scheduling and AI-generated schedules.
  - [ ] Advanced break scheduling should use assignment results, room coverage, nurse experience, acuity, and activity level after those workflows are stable.
- Solution understanding:
  - [ ] `docs/phases.md` now excludes complex multi-break scheduling from Phase 4.
  - [ ] `docs/phases.md` now defines Phase 10 as the advanced break scheduling optimizer phase.
  - [ ] Phase 10 requires deterministic safety constraints before optional AI-assisted suggestions.
  - [ ] No runtime code, data model, or server behavior changed.
- Broader context:
  - [ ] The app can keep the beginner-readable Phase 4 local scheduler until advanced break logic is explicitly implemented.
  - [ ] A future break optimizer should be planned separately with safety constraints, charge nurse review, and complex scenario tests.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-07-08 - Make Joined Nurse Requests Live

- Task: Complete Phase 6 Tasks 5.1, 5.2, and 5.3 by letting joined nurses submit issue and swap requests through server RPCs, and letting charge nurses resolve pending swap requests through a focused server action.
- Problem understanding:
  - [ ] Joined nurse request writes could not safely use the full charge nurse active-shift save path.
  - [ ] Realtime should treat server updates as signals to refetch, not as a second local sync system.
  - [ ] Swap requests need source-bed validation so a nurse cannot request a swap for a bed outside her current assignment.
- Solution understanding:
  - [ ] `src/services/serverWorkspaceRepository.ts` now exposes request submit and resolve RPC boundaries.
  - [ ] `src/store/ServerWorkspaceContext.tsx` wraps those RPCs in beginner-readable app actions and refreshes the relevant server view afterward.
  - [ ] `src/screens/RegularNurseWorkspaceScreen.tsx` adds issue and swap request forms for the real joined nurse workspace.
  - [ ] The joined nurse request UI now uses plain nurse-facing copy and two simple action cards instead of technical helper text.
  - [ ] The joined nurse assignment summary groups beds by room, puts break info in a separate `Breaks` section, and keeps longer room/request lists in contained scroll areas.
  - [ ] `src/screens/ChargeNurseRequestDetailScreen.tsx` resolves only pending swap requests through the focused charge action.
  - [ ] `src/screens/ChargeNurseRequestDetailScreen.tsx` shows issue requests as review-only charge items and request timestamps no longer include seconds.
  - [ ] `docs/phase-6/supabase-request-setup.md` documents the required server functions and validation rules.
- Broader context:
  - [ ] This makes Phase 6 nurse requests live while keeping request records on the active shift snapshot.
  - [ ] Assignment changes still stay out of accepted swap decisions; only request status changes.
  - [ ] Push notifications, offline queues, conflict resolution, drag-and-drop, board sharing, tablet layout, and AI remain out of scope.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-30 - Link Nurse Code To Shift Access

- Task: Complete Phase 6 Task 3.3 by accepting a valid nurse code, linking the signed-in profile to one shift nurse access record, consuming the invite, and opening the joined nurse workspace.
- Problem understanding:
  - [x] Validation only proved the code was usable; it did not yet give the account nurse-scoped shift access.
  - [x] The invite accept step must update access and invite status together so a code cannot half-join or stay reusable by accident.
  - [x] Joined nurse access must remain scoped to one nurse in one active shift, not the full charge nurse board.
- Solution understanding:
  - [x] `src/services/shiftInviteRepository.ts` now exposes `acceptShiftNurseInviteCode`, which calls the server accept RPC and maps joined or blocked results.
  - [x] `src/screens/JoinActiveSessionScreen.tsx` uses the validated state to show `Join shift`, accepts the code, refreshes joined nurse access, and routes to `/regular-nurse-workspace`.
  - [ ] `docs/phase-6/supabase-invite-setup.md` documents `accept_shift_nurse_invite_code`, which creates or updates `shift_nurse_access` and marks the invite `used`.
  - [x] `src/screens/RegularNurseWorkspaceScreen.tsx` now describes the real nurse-code path in its empty state.
  - [x] `src/screens/RegularNurseWorkspaceScreen.tsx` sends `Back to home` to `/` without calling `signOut()`.
  - [x] `src/screens/HomeScreen.tsx` shows a joined-shift return card and changes the bottom action to `View joined shift` when access is already linked.
- Broader context:
  - [x] This completes the real invite join link before joined nurse realtime subscriptions are added in later tasks.
  - [x] The joined nurse assignment still loads through the reduced `get_joined_nurse_assignment_view` boundary.
  - [x] Push notifications, offline queues, conflict resolution, drag-and-drop, tablet layout, and AI remain out of scope.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-27 - Validate Nurse Join Codes

- Task: Complete Phase 6 Tasks 3.1 and 3.2 by enabling nurse code entry, preserving a pending code through sign-in, validating the code with the server, and showing a safe join confirmation.
- Problem understanding:
  - [ ] The old join screen was a disabled placeholder, so a nurse could not type or validate a real invite code.
  - [ ] A typed code must be checked by the server before the app shows any shift participation details.
  - [ ] Code validation must avoid exposing patient data, full board data, or raw stored invite codes.
- Solution understanding:
  - [ ] `src/screens/JoinActiveSessionScreen.tsx` stores the nurse code in screen state, validates the 6-character format, prompts signed-out users, and shows a nurse/floor confirmation after server validation.
  - [ ] `src/services/shiftInviteRepository.ts` owns invite-code normalization, hashing, format messages, and the `validateShiftNurseInviteCode` server boundary.
  - [ ] `src/screens/AuthFormScreen.tsx` preserves the pending join code through login/signup return params.
  - [ ] `docs/phase-6/supabase-invite-setup.md` documents the validation RPC that returns only safe preview data and blocked reasons.
- Broader context:
  - [ ] This prepares Task 3.3, which will link the signed-in user to shift nurse access.
  - [ ] The join confirmation intentionally does not navigate to the nurse assignment or create access yet.
  - [ ] Push notifications, offline queues, conflict resolution, drag-and-drop, tablet layout, and AI remain out of scope.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-26 - Add Nurse Invite Codes Screen

- Task: Complete Phase 6 Tasks 2.2, 2.3, and 2.4 by generating per-nurse invite codes, adding the Nurse Invites screen, and regenerating codes by revoking old active invites.
- Problem understanding:
  - [ ] Nurse invite codes need a server-created invite record before the raw code is returned to the app.
  - [ ] The app should not persist raw invite codes because the server stores only hashed code validation data.
  - [ ] Regeneration must invalidate the old active invite without removing already linked nurse access.
- Solution understanding:
  - [ ] `src/services/shiftInviteRepository.ts` generates a 6-character nurse code, stores only its hash, loads invite/access status, and revokes active invites before regeneration.
  - [ ] `src/screens/NurseInvitesScreen.tsx` lists active-shift nurses, shows joined/invite status, and supports generate, copy, share, and regenerate actions.
  - [ ] `src/screens/FloorBoardScreen.tsx` adds the Floor Board entry point without changing assignment behavior.
  - [ ] `expo-clipboard` and `expo-crypto` are used because copy and secure code generation are direct task requirements.
- Broader context:
  - [ ] This prepares the later nurse-code join flow while intentionally not implementing invite validation or joining yet.
  - [ ] Existing Phase 1-5 shift setup, assignment, requests, breaks, auth, and realtime charge-board behavior should remain unchanged.
  - [ ] Push notifications, offline queues, drag-and-drop, tablet layout, AI, and access-removal behavior remain out of scope.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-26 - Add Shift Nurse Invite Server Model

- Task: Complete Phase 6 Task 2.1 by adding the server invite record model, app-side repository boundary, and Supabase setup note for nurse invite records.
- Problem understanding:
  - [x] Nurse invite links need a server record before the app can safely generate or validate links.
  - [x] The server should store safe token validation data, not raw invite links or raw invite tokens.
  - [x] Invite management must be limited to the charge nurse who owns the active shift.
- Solution understanding:
  - [x] `src/types/models.ts` defines `ShiftNurseInviteStatus` and `ShiftNurseInviteRecord`.
  - [x] `src/services/shiftInviteRepository.ts` checks charge ownership, active shift status, nurse membership, expiration, token hash shape, and duplicate active invites.
  - [x] `docs/phase-6/supabase-invite-setup.md` documents the `shift_nurse_invites` table, RLS policies, and one-active-invite partial unique index.
  - [x] Raw invite link generation, deep links, copy/share UI, and nurse join behavior remain future tasks.
- Broader context:
  - [x] Task 2.1 prepares Task 2.2 to generate a real per-nurse link after the server record exists.
  - [x] Existing active-shift, realtime, assignment, request, break, and joined nurse behavior stays unchanged.
  - [x] Push notifications, offline queues, conflict handling, drag-and-drop, board sharing, tablet layout, and AI remain out of scope.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-26 - Add Live Status UI to Charge Screens

- Task: Complete Phase 6 Task 1.3 by showing the charge active-shift realtime connection state on the charge workspace and floor board.
- Problem understanding:
  - [x] Charge nurses need visible feedback that active-shift updates are live, reconnecting, disconnected, or in error.
  - [x] Realtime connection health is foreground UI state, not saved active-shift data.
  - [x] The recovery action should refresh server truth without adding offline queues, push notifications, or conflict handling.
- Solution understanding:
  - [x] `src/components/workflow/Chips.tsx` exports `LiveStatusChip` with labels for connecting, live, reconnecting, disconnected, and error.
  - [x] `src/screens/HomeScreen.tsx` renders the chip in the active-shift card.
  - [x] `src/screens/FloorBoardScreen.tsx` renders the chip above the board summary.
  - [x] The chip uses `retryLoadWorkspace` only for disconnected or error states.
- Broader context:
  - [x] Task 1.3 makes Task 1.2's temporary realtime state visible to users.
  - [x] Existing request-then-refresh writes and assignment behavior stay unchanged.
  - [x] Joined nurse live status and invite behavior remain future Phase 6 tasks.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-26 - Add Charge Active Shift Realtime Subscription Boundary

- Task: Implement Phase 6 Task 1.2 by starting a charge active-shift realtime listener and refetching the active shift after server change signals.
- Problem understanding:
  - [ ] A realtime event should be treated as a signal that server data changed, not as trusted app state.
  - [ ] The listener must start only for a signed-in charge nurse with an active shift.
  - [ ] The listener must stop when the active shift disappears or the signed-in charge context is gone.
- Solution understanding:
  - [ ] `src/services/realtimeWorkspaceRepository.ts` owns the Supabase channel setup and status mapping.
  - [ ] `src/store/ServerWorkspaceContext.tsx` owns temporary foreground realtime connection state and listener lifecycle.
  - [ ] `src/services/serverWorkspaceRepository.ts` exposes `loadServerActiveShift` so realtime refreshes can refetch only the active shift.
  - [ ] Existing write flows still use request-then-refresh.
- Broader context:
  - [ ] Task 1.3 can render the temporary connection state in UI.
  - [ ] Joined-nurse subscriptions, invite links, push notifications, offline queues, and conflict handling remain out of scope.
  - [ ] Supabase must have `public.active_shifts` enabled in the `supabase_realtime` publication before backend update events can arrive.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-25 - Fix Home Template Cards on Small Screens

- Task: Reflow the Home floor-template card so its action no longer overlaps metadata on narrow phone screens.
- Problem understanding:
  - [ ] The template identity, two metadata chips, Start Shift action, and chevron were competing for one horizontal row.
  - [ ] Flexible shrinking could not preserve readable metadata and a usable action at narrow content widths.
  - [ ] This is a responsive presentation issue, not a shift or server-data issue.
- Solution understanding:
  - [ ] `FloorTemplateRow` compares the current window width with the module-level `COMPACT_TEMPLATE_CARD_MAX_WIDTH` constant.
  - [ ] Compact cards keep template identity and the chevron on the first row, then place Start Shift on its own aligned row.
  - [ ] The compact Start Shift action has a 44-point minimum touch target.
- Broader context:
  - [ ] Template editing, shift creation, deletion, navigation, and saved data behavior are unchanged.
  - [ ] Wider screens retain the existing single-row card layout.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-25 - Add Realtime Connection State Types

- Task: Complete Phase 6 Task 1.1 by defining the foreground realtime connection states without adding subscription behavior.
- Problem understanding:
  - [x] Realtime connection health needs a shared vocabulary before listeners and live-status UI are implemented.
  - [x] Connection health is temporary foreground app state, not saved active-shift or database data.
  - [x] Offline queues and conflict state are outside this task and Phase 6 scope.
- Solution understanding:
  - [x] `src/types/models.ts` exports `RealtimeConnectionState` with `connecting`, `live`, `reconnecting`, `disconnected`, and `error`.
  - [x] A string union rejects unsupported connection-state values during TypeScript compilation.
  - [x] `Shift`, `ActiveShiftRecord`, and `ServerWorkspace` remain unchanged, so connection state is not persisted.
- Broader context:
  - [x] Task 1.2 can use this type when it adds the charge active-shift subscription boundary.
  - [x] Task 1.3 can use the same vocabulary when it adds live-status UI.
  - [x] Existing auth, workspace, assignment, request, and break behavior is unaffected.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-21 - Confirm Phase 6 Existing App Touchpoints

- Task: Complete Phase 6 Tasks 0.1 and 0.2 by verifying the Phase 6 planning docs and documenting the current app touchpoints before runtime feature work starts.
- Problem understanding:
  - [ ] Phase 6 needs a clear boundary before adding realtime subscriptions or invite links.
  - [ ] Task 0.2 is documentation and review, not runtime implementation.
  - [ ] Existing Phase 1-5 behavior should stay unchanged while touchpoints are mapped.
- Solution understanding:
  - [ ] `docs/phase-6/app-touchpoints.md` documents current routes, providers, services, joined nurse access, request flow, active shift saves, likely future files, and compatibility risks.
  - [ ] `docs/phase-6/tasks.md` now marks only Task 0.2 done in addition to the already done Task 0.1.
  - [ ] No app runtime code was changed for this setup step.
  - [ ] Realtime connection state is planned as foreground UI/provider state, not saved active-shift data.
- Broader context:
  - [ ] The touchpoint map protects later Phase 6 tasks from spreading Supabase calls across screens.
  - [ ] Invite work can build on the existing join shell and joined nurse workspace without exposing the full charge board.
  - [ ] Push notifications, offline queues, conflict handling, drag-and-drop, board sharing, tablet layout, and AI remain out of scope.
- Verification:
  - [x] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-20 - Plan Phase 6 Realtime Collaboration and Nurse Invites

- Task: Create Phase 6 planning docs for realtime collaboration, nurse invite links, deep link joining, and live nurse-scoped shift participation.
- Problem understanding:
  - [ ] Phase 6 should follow `docs/phases.md`, where Phase 6 is Realtime Collaboration and Nurse Invites.
  - [ ] The AGENTS summary has an older-looking Phase 6 note for push/offline, but push notifications and offline resilience belong to Phase 7 in `docs/phases.md`.
  - [ ] Realtime should make server-backed active shifts update across devices without adding push notifications or offline write queues.
- Solution understanding:
  - [ ] `docs/phase-6/user-stories.md` defines realtime, invite, join, live nurse view, live request, regeneration, and compatibility stories.
  - [ ] `docs/phase-6/data-model.md` documents invite records, shift nurse access updates, realtime subscription scopes, and connection state.
  - [ ] `docs/phase-6/mobile-design.md` documents phone-first live status, invite management, join gate, joined nurse, and live request UI.
  - [ ] `docs/phase-6/screens.md` maps the Phase 6 screens and safe recovery states.
  - [ ] `docs/phase-6/tasks.md` orders small implementation tasks and marks only planning Task 0.1 done.
- Broader context:
  - [ ] Phase 6 connects the Phase 5 server-backed app to live multi-device use.
  - [ ] Joined nurse access stays nurse-scoped and does not expose the full charge nurse board.
  - [ ] Push notifications, offline queues, drag-and-drop, board sharing, tablet layout, and AI remain deferred.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Complete Phase 5 Manual Test Pass

- Task: Complete Phase 5 Tasks 6.1 through 6.7 by validating the auth, server template, active shift, role boundary, previous-phase compatibility, scope, and readability pass without adding new feature behavior.
- Problem understanding:
  - [ ] Task 6.x is a validation and readability pass, not a new feature build.
  - [ ] Manual-test tasks should verify the Phase 5 flow while preserving previous Phase 1-4 behavior.
  - [ ] Future-phase features such as realtime, invite links, push notifications, offline queues, drag-and-drop, tablet layout, and AI must stay out of this pass.
- Solution understanding:
  - [ ] `docs/phase-5/tasks.md` now marks only Tasks 6.1 through 6.7 done.
  - [ ] `src/services/README.md` now describes the current Phase 5 service boundaries for auth, profiles, Supabase client setup, and server workspace persistence.
  - [ ] No runtime feature code changed.
  - [ ] Validation covered TypeScript, lint, web export, server-backed code paths, and scope searches.
- Broader context:
  - [ ] This closes the Phase 5 task list without jumping into Phase 6 collaboration or invite behavior.
  - [ ] The service boundary docs make it easier to explain where backend code belongs.
  - [ ] The app remains account-backed through normal request/response server persistence.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Enable Floor Template Deletion

- Task: Make Home floor-template swipe delete available and actually remove the saved server template after confirmation.
- Problem understanding:
  - [ ] Home was passing `canDelete={false}`, so templates were never wrapped in the swipe-delete component.
  - [ ] The confirm handler only closed the dialog and did not delete anything.
  - [ ] Supabase also needs an explicit delete RLS policy for template deletion.
- Solution understanding:
  - [ ] `serverWorkspaceRepository` deletes an owned `floor_templates` row by template id and owner id.
  - [ ] `ServerWorkspaceContext` exposes `deleteFloorTemplate` and refreshes the workspace after delete.
  - [ ] `HomeScreen` enables swipe delete only when no active shift is running.
- Broader context:
  - [ ] Deleting templates stays server-backed and account-scoped.
  - [ ] Active shifts are protected from losing the template they were started from.
  - [ ] Old carry-over snapshots for that template are cleaned up by the schema cascade.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-20 - Align Floor Template Meta Chips

- Task: Keep the room and bed chips aligned on one row in Home floor-template cards when there is enough width.
- Problem understanding:
  - [ ] The template title area was allowed to size differently per row.
  - [ ] Longer names could leave the room and bed chips with less measured space.
  - [ ] The result looked uneven because one card showed chips side by side and another stacked them.
- Solution understanding:
  - [ ] `HomeScreen` now lets the left text area shrink predictably with `minWidth: 0`.
  - [ ] The right action area stays fixed with `flexShrink: 0`.
  - [ ] The meta chip row no longer wraps in normal card width.
- Broader context:
  - [ ] This is a presentation-only fix.
  - [ ] Saved templates, shift start, and navigation behavior are unchanged.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Preserve Pending Carry-Over On Resume

- Task: Fix Home resume so an active setup shift returns to carry-over review until that review has been completed.
- Problem understanding:
  - [ ] A setup shift can exist before carry-over review is finished.
  - [ ] Home previously resumed every setup shift to Start Shift.
  - [ ] Always showing carry-over would repeat the review even after the user completed it.
- Solution understanding:
  - [ ] `Shift` now has optional `carryOverReviewedAt`.
  - [ ] `CarryOverReviewScreen` sets `carryOverReviewedAt` when Continue is pressed.
  - [ ] `HomeScreen` routes Resume to carry-over when a matching previous snapshot exists and `carryOverReviewedAt` is still missing.
- Broader context:
  - [ ] Carry-over review becomes a resumable setup step.
  - [ ] Completed carry-over review does not keep interrupting normal setup resume.
  - [ ] This stays inside server-backed active-shift persistence.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Fix Carry-Over Patient Bed Matching

- Task: Fix carry-over patient suggestions so they can still apply when the new active shift has a matching bed label but not the exact previous bed id.
- Problem understanding:
  - [ ] Carry-over snapshots store `previousBedId` and `previousBedLabel`.
  - [ ] Exact bed-id matching can fail after server-backed template/save cycles.
  - [ ] Matching across the same floor template should still be safe when the bed label exists.
- Solution understanding:
  - [ ] `src/screens/CarryOverReviewScreen.tsx` now finds the target bed by id first.
  - [ ] If the id no longer exists, it falls back to `previousBedLabel`.
  - [ ] Patient suggestions without a matching id or label stay filtered out.
- Broader context:
  - [ ] Nurse carry-over is unaffected because nurse suggestions create new nurse rows.
  - [ ] Patient carry-over remains tied to beds on the current active shift.
  - [ ] This preserves Phase 5 scope and does not add sync/realtime behavior.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Refactor Workspace Reads Out Of Local State

- Task: Refactor Phase 5 workspace screens so server-backed templates, active shifts, previous-shift snapshots, flags, requests, and breaks are read from `ServerWorkspaceContext` instead of a copied `LocalStateContext`.
- Problem understanding:
  - [ ] Copying server workspace snapshots into global local state made the source of truth harder to explain.
  - [ ] Saved server data and unsaved UI drafts need different homes.
  - [ ] Some screens still need temporary edits before submit, but those edits do not need global app state.
- Solution understanding:
  - [ ] `src/store/ServerWorkspaceContext.tsx` now exposes `floorTemplates`, `activeShift`, and `previousShiftSnapshots` directly.
  - [ ] `src/store/WorkflowDraftContext.tsx` owns only `draftFloorTemplate` and simulated nurse testing state.
  - [ ] `src/hooks/useActiveShiftDraft.ts` gives setup screens a screen-local active-shift draft before they call `saveActiveShift`.
  - [ ] `src/store/LocalStateContext.tsx` and the old local storage service files are removed.
  - [ ] Screens no longer import `useLocalState`.
- Broader context:
  - [ ] Server workspace data is clearer as the saved truth.
  - [ ] Unsaved form edits stay local to the screen or draft-only context.
  - [ ] This remains Phase 5 server persistence cleanup and does not add future collaboration features.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Remove Local App-State Persistence

- Task: Complete Phase 5 Tasks 5.1 and 5.2 by removing the old durable local app-state path and reviewing previous workflow compatibility against server-backed state.
- Problem understanding:
  - [x] Phase 5 server persistence should not restore templates, active shifts, carry-over snapshots, requests, or breaks from old device-local app data.
  - [x] `LocalStateContext` was still loading and saving the old `nurseflow.localAppState.v1` data path.
  - [x] Previous Phase 1-4 screens still need an in-memory working copy so their forms and setup flow remain usable.
- Solution understanding:
  - [x] `src/store/ServerWorkspaceContext.tsx` exposes server-backed workspace snapshots directly.
  - [x] `src/store/WorkflowDraftContext.tsx` keeps only unsaved floor-template draft state and simulated nurse testing state.
  - [x] `src/services/storageRepository.ts` and `src/services/localStorageAdapters.ts` were removed from the runtime path.
  - [x] `src/screens/HomeScreen.tsx` no longer writes a previous-shift snapshot to local storage after saving carry-over to the server.
  - [x] `package.json` no longer lists `expo-file-system` as a direct dependency for app-state persistence.
- Broader context:
  - [x] Account data now restores from Supabase session plus server workspace records, not from old Phase 1-4 local test data.
  - [x] Temporary form state can still be local before submit, but saved truth belongs to the server.
  - [x] This stays inside Phase 5 and does not add realtime, invite links, deep links, push notifications, offline queues, drag-and-drop, tablet layout, or AI.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-19 - Add Join Active Session Screen Shell

- Task: Add a Home entry and placeholder screen for the future nurse-code join flow without implementing code verification.
- Problem understanding:
  - [ ] Users need to see where joining an active shift will happen.
  - [ ] The app should not imply join codes already work.
  - [ ] Existing active participation guardrails should still prevent conflicting shift contexts.
- Solution understanding:
  - [ ] `src/app/join-active-session.tsx` adds the route.
  - [ ] `src/screens/JoinActiveSessionScreen.tsx` shows disabled code entry and disabled join action.
  - [ ] `src/screens/HomeScreen.tsx` links to the shell and blocks navigation when the account is already in an active shift context.
- Broader context:
  - [ ] A later task can wire this screen to real code verification and `shift_nurse_access` creation.
  - [ ] The shell keeps the next workflow visible without adding invite links, deep links, realtime, push notifications, or full join behavior.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-19 - Treat Nurse Access As Shift Participation

- Task: Update Phase 5 role/access direction so every signed-in profile is charge-capable, while regular nurse behavior comes from joined shift access.
- Problem understanding:
  - [ ] Permanent `regular_nurse` profile roles made manual testing and linking harder to understand.
  - [ ] A nurse joining a shift should not change the account's global identity.
  - [ ] One account should not start or join multiple active shift contexts at the same time.
- Solution understanding:
  - [ ] `UserRole` is now only `charge_nurse` for Phase 5 profiles.
  - [ ] `SessionGate` sends signed-in users to Home rather than routing by regular-nurse profile role.
  - [ ] `ServerWorkspaceContext` owns joined nurse assignment loading, retry, and active participation state.
  - [ ] `ServerWorkspaceContext` blocks joined nurse access when the account already owns an active charge shift.
  - [ ] `ServerWorkspaceContext` blocks starting a charge shift when the account is already joined to another shift as a nurse.
  - [ ] Joined nurse assignment loading uses `shift_nurse_access` and `get_joined_nurse_assignment_view()`.
  - [ ] Phase 5 docs describe future `Join active session` code entry without implementing it yet.
- Broader context:
  - [ ] Join-code behavior can later create `shift_nurse_access` records.
  - [ ] Joined nurse access remains nurse-scoped and does not expose the full charge nurse board.
  - [ ] The one-active-participation rule prevents one account from being in conflicting active shift contexts.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-19 - Add Role Boundaries And Authorization Checks

- Task: Complete Phase 5 Tasks 4.1, 4.2, 4.3, and 4.4 by keeping accounts charge-capable, adding joined nurse empty/linked states, documenting shift nurse access records, and adding nurse-scoped server reads.
- Problem understanding:
  - [x] Regular nurse accounts needed a real boundary so they could not open charge nurse workspace screens.
  - [x] A signed-in profile alone should not expose nurse-scoped shift data; it needs a linked access record.
  - [x] UI routing is not enough protection, so server ownership and nurse-scoped reads also matter.
- Solution understanding:
  - [x] `src/components/SessionGate.tsx` routes signed-in users to Home rather than treating nurse access as a permanent profile role.
  - [x] `src/screens/RegularNurseWorkspaceScreen.tsx` shows loading, `No shift access yet`, linked assignment, and error states for joined nurse access.
  - [x] `src/services/serverWorkspaceRepository.ts` keeps charge nurse workspace reads owner-scoped and loads joined nurse assignment data through a reduced server RPC.
  - [x] `docs/phase-5/supabase-auth-setup.md` documents the `shift_nurse_access` table and `get_joined_nurse_assignment_view()` RPC for manual testing.
  - [x] No invite links, deep links, realtime, push notifications, offline queues, drag-and-drop, tablet layout, or AI were added.
- Broader context:
  - [x] Shift access boundaries prepare NurseFlow for later collaboration without exposing the full charge nurse board to joined nurses.
  - [x] Charge nurse templates, shifts, and snapshots remain owned by the signed-in charge nurse profile.
  - [x] Later invite/join behavior can create access records, but this task only proves the authorization shape.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-19 - Save Previous-Shift Snapshot to Server

- Task: Complete Phase 5 Task 3.4 by saving carry-over nurse and patient suggestions to Supabase when a shift ends.
- Problem understanding:
  - [ ] Ending a server shift no longer restored the active shift, but carry-over suggestions were still only local.
  - [ ] Reloading from the server could lose nurse and patient suggestions for the next shift.
  - [ ] Request history and break schedules should not become carry-over data.
- Solution understanding:
  - [ ] `src/services/serverWorkspaceRepository.ts` now saves one previous-shift snapshot per floor template by replacing the older server snapshot.
  - [ ] `src/store/ServerWorkspaceContext.tsx` exposes a server previous-shift snapshot save function.
  - [ ] `src/screens/HomeScreen.tsx` saves the server carry-over snapshot before ending the active shift.
  - [ ] Empty snapshots remove the older server snapshot instead of keeping stale suggestions.
  - [ ] `docs/phase-5/supabase-auth-setup.md` documents the previous-snapshot insert and delete policies.
- Broader context:
  - [ ] Carry-over suggestions now follow the signed-in account instead of depending only on device-local state.
  - [ ] The change stays within Phase 5 server persistence and does not add realtime, invites, push notifications, offline queues, drag-and-drop, tablet layout, or AI.
  - [ ] Later role and authorization work can keep using the repository/provider boundary.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-19 - Add Server Active Shift Persistence

- Task: Complete Phase 5 Tasks 3.1, 3.2, 3.2a, and 3.3 by starting active shifts from server templates, saving active-shift changes to Supabase, refreshing after saves, and restoring the server active shift after session restore.
- Problem understanding:
  - [ ] Active shifts were still mostly local after server floor templates were added.
  - [ ] Screens could move forward using in-memory nurses, patients, assignments, requests, or breaks even if the server had not saved them.
  - [ ] App startup could load old device state near the same time as server workspace state, so the restore order needed to be explicit.
- Solution understanding:
  - [ ] `src/services/serverWorkspaceRepository.ts` now creates and updates `active_shifts` rows with the full active-shift snapshot.
  - [ ] `src/store/ServerWorkspaceContext.tsx` owns the save-then-refresh pattern for starting and saving active shifts.
  - [ ] Setup, nurse, patient, assignment, carry-over, request, and break screens call the server save before relying on the next screen or restored data.
  - [ ] `src/store/LocalStateContext.tsx` exposes local-load completion so the server workspace can hydrate after device state loads.
  - [ ] The Supabase setup docs now include active-shift insert and update RLS policies.
- Broader context:
  - [ ] The active shift is now the server-backed source for Phase 1-4 workflow data during Phase 5.
  - [ ] This keeps the implementation request/response based and does not add realtime, invite links, push notifications, offline queues, drag-and-drop, tablet layout, or AI.
  - [ ] Later previous-shift and role/authorization tasks can build on the same repository/provider boundary.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-17 - Replace Deprecated Supabase Returns Helper

- Task: Replace deprecated Supabase `.returns<T>()` list query typing in the server workspace repository.
- Problem understanding:
  - [x] Supabase marked `.returns<T>()` deprecated, so the IDE showed a deprecation warning.
  - [x] The warning was about TypeScript result typing, not a runtime database behavior problem.
  - [x] The list queries still need typed rows so mapper functions receive the expected shape.
- Solution understanding:
  - [x] `src/services/serverWorkspaceRepository.ts` now uses `.overrideTypes<T>()` for list query result types.
  - [x] The fetched columns, table names, filters, and mapper functions stayed the same.
  - [x] Single-row calls were left alone because the warning was from `.returns<T>()`.
- Broader context:
  - [x] Keeping SDK usage current prevents warning noise while preserving the beginner-readable repository boundary.
  - [x] This is a type cleanup only and does not change floor template or workspace loading behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-17 - Add Shared Retryable Error State Component

- Task: Create one reusable retryable error component and replace Home's server workspace error block with it.
- Problem understanding:
  - [x] Home had a one-off retryable error layout that would likely be repeated by later server screens.
  - [x] Repeated error blocks can drift in spacing, retry button style, and accessibility behavior.
  - [x] The generic component should own the layout, while each screen still provides the specific title, message, and retry action.
- Solution understanding:
  - [x] `src/components/ErrorState.tsx` owns the shared title, message, optional retry button, and error styling.
  - [x] `src/screens/HomeScreen.tsx` now renders `ErrorState` for server load failures.
  - [x] The component is generic and does not know about Supabase, templates, or workspaces.
- Broader context:
  - [x] Future Phase 5 server screens can reuse the same retryable error pattern.
  - [x] This is a UI refactor only and does not change server loading, saving, or retry behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-17 - Add Shared Loading State Component

- Task: Create one reusable loading component and replace the direct loading spinners in session routing, auth submit, and Home's server load state.
- Problem understanding:
  - [x] Multiple screens were hand-rendering loading UI, which makes copy, spacing, color, and accessibility easier to drift.
  - [x] A shared loading component should stay generic and not know about auth, templates, or workspace data.
  - [x] Button loading and card loading need slightly different layout while sharing the same primitive.
- Solution understanding:
  - [x] `src/components/LoadingState.tsx` owns the shared spinner/message UI.
  - [x] `variant="card"` is used for full or section loading states.
  - [x] `variant="inline"` with `showMessage={false}` is used inside the auth submit button.
  - [x] `src/screens/HomeScreen.tsx`, `src/screens/SessionGateScreens.tsx`, and `src/screens/AuthFormScreen.tsx` no longer import `ActivityIndicator` directly.
- Broader context:
  - [x] Future Phase 5 loading states can reuse this component instead of inventing new spinner layouts.
  - [x] The refactor changes presentation only and does not change auth, server loading, or template save behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-17 - Add Server Workspace Loader And Template Save

- Task: Complete Phase 5 Tasks 2.1, 2.2, and 2.3 by loading the charge nurse server workspace, saving reusable floor templates to Supabase, and showing the server template list/empty/error states.
- Problem understanding:
  - [x] The charge nurse workspace still showed local-only templates and did not load account-owned server templates.
  - [x] Template save needed to move from device storage to the server without storing patients, nurses, assignments, requests, or breaks on the reusable template.
  - [x] Regular nurse accounts should not load or manage charge nurse templates.
- Solution understanding:
  - [x] `src/services/serverWorkspaceRepository.ts` owns Supabase reads and writes for workspace data and floor templates.
  - [x] `src/store/ServerWorkspaceContext.tsx` provides one server workspace boundary with loading, empty, error, retry, save, and save-error state.
  - [x] `src/screens/HomeScreen.tsx` shows server workspace loading, retry, template list, and empty states while keeping active-shift helpers local for now.
  - [x] `src/screens/TemplateReviewScreen.tsx` saves reusable template structure to the server and updates in-memory state with the fetched backend record.
  - [x] `docs/phase-5/supabase-auth-setup.md` documents the minimal workspace tables and RLS policies for manual testing.
- Broader context:
  - [x] This starts server persistence for reusable floor templates without adding active-shift save, realtime, invite links, push notifications, offline queues, drag-and-drop, tablet layout, or AI.
  - [x] Future active-shift persistence can reuse the same request-then-refresh pattern.
  - [x] Existing local-only helpers are preserved until the specific later tasks replace those save paths.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-16 - Add Signup Login Session Restore And Sign Out

- Task: Add Phase 5 auth actions for charge nurse signup, email/password login, session restore, and local-session sign out.
- Problem understanding:
  - [ ] The session gate existed, but users could not yet create an account, sign in, or sign out.
  - [ ] Supabase Auth users need a matching NurseFlow `profiles` row before the app can route by role.
  - [ ] The app should restore saved sessions without storing raw passwords or secret keys.
- Solution understanding:
  - [ ] `src/services/authRepository.ts` owns signup, login, profile creation, and local sign out calls.
  - [ ] `src/services/profileRepository.ts` can create or load a `profiles` row.
  - [ ] `src/screens/AuthFormScreen.tsx` provides beginner-friendly signup and login forms with validation, loading, and error states.
  - [ ] `src/store/AuthSessionContext.tsx` exposes `signOut()` and still restores sessions through SecureStore-backed Supabase auth.
  - [ ] Charge and regular nurse workspace screens now include sign-out actions.
  - [ ] `docs/phase-5/supabase-auth-setup.md` documents the minimal profile table and RLS policies needed for manual testing.
- Broader context:
  - [ ] This completes the first account loop before server floor templates, active shifts, previous-shift snapshots, realtime, invite links, push notifications, offline queues, or AI.
  - [ ] Future server persistence tasks can rely on the signed-in profile and role.
  - [ ] Signup defaults to `charge_nurse`; regular-nurse linking and invite behavior remain later work.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-16 - Add Phase 5 Auth Types And Session Gate

- Task: Add auth/profile/save-status types, Supabase secure session setup, and a root session gate for signed-out, charge nurse, regular nurse, setup-error, and recovery states.
- Problem understanding:
  - [ ] Phase 5 needs real account/session state before adding signup, login, or server persistence.
  - [ ] Auth/session state should not be mixed into local active-shift state.
  - [ ] Native auth tokens need secure storage instead of plain local app storage.
- Solution understanding:
  - [ ] `src/types/models.ts` now defines `AuthStatus`, `UserRole`, `ServerSaveStatus`, `UserProfile`, and `AuthSessionState`.
  - [ ] `src/services/supabaseClient.ts` creates the Supabase client only when public config exists and uses Expo SecureStore on native platforms.
  - [ ] `src/store/AuthSessionContext.tsx` checks the saved session, loads the user profile, and returns safe setup or recovery states when needed.
  - [ ] `src/components/SessionGate.tsx` routes signed-out users to Login, charge nurses to `/`, and regular nurses to `/regular-nurse-workspace`.
  - [ ] Login and regular nurse screens are intentionally minimal because signup, password login, and nurse access linking are later tasks.
- Broader context:
  - [ ] This creates the front door for Phase 5 account work without changing Phase 1-4 floor setup, assignment, requests, or break scheduling.
  - [ ] Future signup/login tasks can plug into the session provider instead of inventing their own account state.
  - [ ] Future server persistence tasks can rely on `UserProfile.role` for workspace boundaries.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-13 - Confirm Phase 5 App Touchpoints

- Task: Map the existing routes, screens, state, storage, and helper files before writing Phase 5 feature code.
- Problem understanding:
  - [ ] Phase 5 should not add backend code before identifying the current app boundaries.
  - [ ] Real auth/session state must stay separate from local app state and simulated nurse role state.
  - [ ] Existing local persistence should be removed from Phase 5 runtime flows once server-backed replacements exist.
- Solution understanding:
  - [ ] `docs/phase-5/app-touchpoints.md` documents current routes, state, storage, helpers, and future Phase 5 touchpoints.
  - [ ] Auth/session state should likely live in a new provider near `src/app/_layout.tsx`, not inside individual screens.
  - [ ] Server repository helpers should likely live in `src/services` so screens do not call Supabase directly.
  - [ ] Current local persistence paths are `saveFloorTemplates`, active-shift saving, and `savePreviousShiftSnapshot`.
  - [ ] The old `nurseflow.localAppState.v1` testing data does not need to be imported.
- Broader context:
  - [ ] This protects Phase 1-4 behavior while preparing for server-backed accounts.
  - [ ] It makes the likely implementation files explainable before auth code starts.
  - [ ] Task 0.3 is documentation-only and does not add backend, auth, realtime, invite, deep link, push, offline, drag-and-drop, tablet, or AI behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] File-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-13 - Choose Phase 5 Backend Approach

- Task: Choose and document the Phase 5 backend approach without adding app implementation code.
- Problem understanding:
  - [ ] Phase 5 needs a backend choice before auth, profile, template, or shift persistence code is written.
  - [ ] The backend must cover email/password auth and server persistence without pulling in later realtime or invite behavior.
  - [ ] Provider features should be selected by phase scope, not enabled just because they exist.
- Solution understanding:
  - [ ] `docs/phase-5/backend-decision.md` chooses Supabase Auth and Supabase Postgres.
  - [ ] The decision uses only client-safe Expo environment variables: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  - [ ] The task list now carries secure session storage into Task 1.2 and Task 1.5 so the auth implementation cannot skip it.
  - [ ] Supabase Realtime, Broadcast, Presence, nurse invite links, deep links, push notifications, and offline queues are deferred.
  - [ ] Normal backend records use one `id` field, and old local storage data should not remain as a second source of truth.
  - [ ] `docs/phase-5/tasks.md` marks only Task 0.2 done.
- Broader context:
  - [ ] This sets the provider boundary for upcoming auth/session and server persistence tasks.
  - [ ] Row Level Security will matter later for charge nurse ownership and regular nurse scoped access.
  - [ ] No current Phase 1-4 app behavior changes because this task is documentation-only.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [ ] File-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-13 - Plan Phase 5 Backend Auth And Server Persistence

- Task: Create Phase 5 planning docs for backend, auth, and server-side persistence.
- Problem understanding:
  - [ ] Phase 5 should follow `docs/phases.md`, where Phase 5 is Backend, Auth, and Server Persistence.
  - [ ] The older phase summary in `AGENTS.md` differs from `docs/phases.md`, so `docs/phases.md` is the source used for this phase plan.
  - [ ] Realtime collaboration, nurse invite links, deep links, push notifications, offline sync, drag-and-drop, tablet layout, and AI belong to later phases.
- Solution understanding:
  - [ ] `docs/phase-5/user-stories.md` defines account, server persistence, role, authorization, and compatibility stories.
  - [ ] `docs/phase-5/data-model.md` documents backend-owned `id` fields for profiles, templates, active shifts, snapshots, and nurse access records, and says old local storage state should be removed from Phase 5 runtime flows.
  - [ ] `docs/phase-5/mobile-design.md` documents account-backed UI direction without realtime or invite-link language.
  - [ ] `docs/phase-5/screens.md` maps the auth, workspace, existing workflow, regular nurse, and recovery screens.
  - [ ] `docs/phase-5/tasks.md` orders small future implementation tasks with manual validation checks and marks only planning Task 0.1 done.
- Broader context:
  - [ ] Phase 5 is the bridge from local workflows to server-backed accounts.
  - [ ] The active shift remains the main source of truth for assignment, requests, and break scheduling.
  - [ ] Role boundaries prepare the app for Phase 6 collaboration without implementing Phase 6 early.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] File-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Show Floor Name in Breaks and Flags Screen Headers

- Task: Update the headers on the Breaks and Flags and requests screens to display the active floor name instead of static screen titles.
- Problem understanding:
  - [ ] Navigating between the Floor Board, Breaks, and Flags screens caused the header to switch between the active floor name (on Floor Board) and generic titles ("Breaks", "Flags and requests").
  - [ ] The header should consistently reference the active floor name across all three board sub-views to keep the context stable.
  - [ ] If no active floor name exists (e.g. shift not started or template not selected), it should fall back to generic page names.
- Solution understanding:
  - [ ] `src/screens/BreakScheduleScreen.tsx` sets `title={activeShift?.floorName ?? "Breaks"}` with `subtitle=""` on `WorkflowScreen`.
  - [ ] `src/screens/FlagsScreen.tsx` sets `title={localState.activeShift?.floorName ?? "Flags and requests"}` with `subtitle=""` on `WorkflowListScreen`.
- Broader context:
  - [ ] This maintains visual consistency across the Floor Board sub-views (Board, Breaks, Flags).
  - [ ] It aligns with the user's preference of displaying only the floor name in the title, without a subtitle, when the sub-tab bar already clarifies the current view.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Polish Board Workload And Flags UI

- Task: Restyle the nurse workload cards and Flags filter/header area.
- Problem understanding:
  - [ ] Nurse workload cards had too many pill-like badges and felt cramped.
  - [ ] Flags used three separate filter cards, which made the page feel heavier than the content.
  - [ ] The UI needed clearer grouping without changing filter behavior or board data.
- Solution understanding:
  - [ ] `src/screens/FloorBoardScreen.tsx` now shows workload coverage and break status with quieter text and inset rows.
  - [ ] `src/screens/FlagsScreen.tsx` renders a dynamic summary card: when 'Flags' is selected, it shows the assignment flag count and critical/warning/info breakdown; when 'Requests' is selected, it shows the nurse request count and pending/accepted/declined breakdown.
  - [ ] A top-level Segmented Control toggles the view between `Flags` (assignment flags) and `Requests` (nurse requests) to prevent stacking.
  - [ ] Selecting a tab displays only the list items and the filter controls (using the new full-width iOS-style `SegmentedControl` component) relevant to that selection, reducing the stacked filter rows to a single row (for Flags) or two rows (for Requests).
  - [ ] Summary card badges display their own respective totals (e.g., total flags count on the Flags summary card and total requests count on the Requests summary card) rather than cross-referencing the other tab's count, preventing label confusion.
- Broader context:
  - [ ] Board sub-tabs now feel more consistent with each other.
  - [ ] The change is visual only and preserves assignment flags, local requests, and filters.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Polish Break Entries And Warnings

- Task: Restyle Breaks tab entry rows and warning rows so they are easier to scan.
- Problem understanding:
  - [ ] Break entry cards looked like raw data boxes instead of a schedule list.
  - [ ] Warning cards used too much amber fill and felt more alarming than necessary.
  - [ ] The UI needed visual hierarchy without changing local scheduling behavior.
- Solution understanding:
  - [ ] `src/screens/BreakScheduleScreen.tsx` keeps the same break entry and warning data.
  - [ ] Break entry rows now show nurse/time first, compact nurse metadata, coverage, and a subtle review note.
  - [ ] Warning rows now use a lighter surface with an amber left accent and context chips.
- Broader context:
  - [ ] This keeps the Breaks tab useful as a board sub-view rather than a noisy report screen.
  - [ ] The change is presentation-only and does not alter generated break times or warning rules.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Add Board Bottom Sub-Tabs

- Task: Add a board-context bottom tab bar for `Board`, `Breaks`, and `Flags`.
- Problem understanding:
  - [ ] Breaks and flags felt disconnected when they lived behind separate action buttons.
  - [ ] A bottom sub-tab pattern makes these views feel like sibling parts of the active board.
  - [ ] A full nested navigation refactor would be larger than needed for this UI pass.
- Solution understanding:
  - [ ] `src/components/workflow/BoardSubTabBar.tsx` defines the reusable bottom tab bar and its three routes.
  - [ ] `WorkflowScreen` and `WorkflowListScreen` accept an optional `bottomAccessory`.
  - [ ] Floor Board, Break Schedule, and Flags each render the same tab bar with their own active tab.
  - [ ] Board and Flags no longer need duplicate primary buttons for moving between each other.
- Broader context:
  - [ ] This keeps the charge nurse's board context stable while preserving existing routes and screen code.
  - [ ] Future board-adjacent views can reuse the same pattern if they belong in this local board context.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Refine Breaks Tab UI

- Task: Replace the Breaks summary tile grid and bottom `Refresh breaks` CTA with a cleaner summary card.
- Problem understanding:
  - [ ] The old Break summary repeated the same raised-tile pattern that made the Board summary hard to scan.
  - [ ] A large bottom `Refresh breaks` button competed with the Board/Breaks/Flags sub-tab bar.
  - [ ] Refresh should be available only when it is useful, not always shown as the main screen action.
- Solution understanding:
  - [ ] `src/screens/BreakScheduleScreen.tsx` now renders `BreakSummaryCard` instead of `SummaryTileGrid`.
  - [ ] Refresh moved into a compact inline pill that appears only when the schedule needs refresh and can be refreshed.
  - [ ] The redundant local schedule/back card was removed because the bottom Board tab handles navigation back.
- Broader context:
  - [ ] The Breaks tab now behaves like a board sub-view instead of a separate workflow screen with its own big CTA.
  - [ ] The underlying local refresh logic still replaces only `activeShift.breakSchedule`.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Refine Floor Board Summary UI

- Task: Make the Floor Board summary easier to scan and remove the confusing `Break scheduled` pill from the summary area.
- Problem understanding:
  - [ ] The old summary looked busy because every fact was shown as an equal raised tile.
  - [ ] `Break scheduled` did not help as a board-summary metric because Breaks now has its own board sub-tab.
  - [ ] Break warnings still need visibility because they represent something the charge nurse may need to review.
- Solution understanding:
  - [ ] `src/screens/FloorBoardScreen.tsx` now uses `BoardSummaryCard` for census, flags, admitting side, activity, and shift start.
  - [ ] The redundant Break schedule card was removed from the Board tab.
  - [ ] Break warning count stays visible as a warning strip or warning badge when warnings exist.
- Broader context:
  - [ ] This keeps the Floor Board focused on charge nurse scanning instead of treating every status as a KPI.
  - [ ] The change is visual and local-only; it does not regenerate breaks or change assignment logic.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-11 - Run Phase 4 Manual Test Pass

- Task: Work through Phase 4 `7.x` validation tasks without adding feature code.
- Problem understanding:
  - [ ] The `7.x` tasks are validation tasks, not new behavior tasks.
  - [ ] Some checks require hands-on app interaction with realistic shift data.
  - [ ] Task 7.1 no longer matches the current automatic-start/derived-activity implementation.
- Solution understanding:
  - [ ] `docs/phase-4/manual-test-pass.md` records what passed automatically, what needs manual click-through, and why.
  - [ ] `docs/phase-4/tasks.md` marks only 7.7 and 7.8 done because those were completed by code review.
  - [ ] TypeScript, lint, Expo export, and local-only scope scans provide non-interactive evidence, not full manual acceptance.
- Broader context:
  - [ ] This protects Phase 4 from accidental backend/auth/realtime/push/offline/AI scope creep.
  - [ ] The remaining manual checks should be completed in the running app before claiming all 7.x tasks are done.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-11 - Show Nurse's Own Break

- Task: Complete Phase 4 Tasks 6.1 and 6.2 only.
- Problem understanding:
  - [ ] The simulated nurse view should show only the selected nurse's break, not the full charge nurse schedule.
  - [ ] A nurse-specific warning should appear only when that selected nurse has break warning context.
  - [ ] Missing schedules and stale nurse entries need safe local display states.
- Solution understanding:
  - [ ] `src/screens/SimulatedNurseAssignmentScreen.tsx` uses `getNurseBreakView` with the selected nurse id.
  - [ ] The Break summary section shows `Break HH:MM`, `Break not scheduled yet.`, or `No break assigned for this nurse yet.`
  - [ ] The warning message comes from the selected nurse's filtered break warnings, not all schedule warnings.
  - [ ] Existing assigned beds, room coverage, issue history, and swap history stay unchanged.
- Broader context:
  - [ ] This completes the Phase 4 nurse-facing local break visibility without adding real accounts, invites, push notifications, realtime sync, or backend behavior.
  - [ ] Later manual testing can verify that Nurse A and Nurse B each see only their own break information.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-11 - Add Floor Board Break Integration

- Task: Complete Phase 4 Tasks 5.1, 5.2, and 5.3 only.
- Problem understanding:
  - [ ] The Floor Board needs a clear way to open Break Schedule after assignment is ready.
  - [ ] Nurse workload cards should show break timing without hiding load, room coverage, or flags.
  - [ ] Board summary should show whether breaks are scheduled, stale, or not scheduled.
- Solution understanding:
  - [ ] `src/screens/BreakScheduleScreen.tsx` owns break status, entries, warnings, and inline refresh behavior.
  - [ ] The Board tab links to Breaks through the board bottom sub-tab instead of a repeated card.
  - [ ] Nurse workload cards use saved break entries to show `Break HH:MM`, `Break not scheduled`, and `Break warning`.
  - [ ] Break schedule status is communicated in the Breaks sub-tab, while the Board summary stays focused on board facts and warning counts.
- Broader context:
  - [ ] The Floor Board now summarizes break state without regenerating schedules itself.
  - [ ] Existing assignment flags, acuity, load, max load, room coverage, and local nurse simulation behavior are preserved.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-11 - Review Generated Break Schedule

- Task: Complete Phase 4 Tasks 4.1, 4.2, and 4.3 only.
- Problem understanding:
  - [ ] Charge nurses need to review generated break entries after assignment creates them.
  - [ ] Break warnings should stay separate from assignment flags and local nurse requests.
  - [ ] A generated schedule can become stale after nurse or assignment changes, so refresh should be explicit.
- Solution understanding:
  - [ ] `src/screens/BreakScheduleScreen.tsx` sorts generated entries by `startTime`.
  - [ ] Break entry rows resolve current nurse, doctor side, and room labels safely while falling back for stale nurse references.
  - [ ] Break warning rows show affected nurses, doctor sides, and rooms without changing the Flags flow.
  - [ ] `Refresh breaks` replaces only `activeShift.breakSchedule` by using the latest active shift and assignment result.
- Broader context:
  - [ ] This keeps Phase 4 local-only and avoids backend, auth, realtime, notifications, drag-and-drop, tablet, or AI work.
  - [ ] Later Floor Board and simulated nurse tasks can link to or summarize the same saved schedule without changing generation.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-10 - Generate Local Break Schedule

- Task: Complete Phase 4 Tasks 3.1, 3.2, 3.3, and 3.4 only.
- Problem understanding:
  - [x] Break generation should happen from the local assignment snapshot, not from a separate backend or AI service.
  - [ ] The first version needs deterministic break slots and simple safety warnings, not a complex scheduler.
  - [ ] The generated schedule should not change beds, patients, assignment results, local nurse requests, templates, or previous-shift snapshots.
- Solution understanding:
  - [ ] `src/utils/breakSchedule.ts` derives staggered slots from shift start time, nurse count, and floor activity.
  - [ ] The helper creates one local break entry per nurse with covered rooms, doctor sides, and warning links.
  - [ ] The helper adds local warnings for fully overlapping room coverage and limited experienced-nurse coverage.
  - [ ] `src/screens/AssignmentReviewScreen.tsx` saves the generated break schedule when local assignment runs.
- Broader context:
  - [ ] Later tasks can display the saved entries and warnings without changing the generation rule.
  - [ ] The schedule remains local, serializable, and tied to the active shift.
- Verification:
  - [x] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-10 - Add Automatic Break Context on Floor Board

- Task: Revise and complete Phase 4 Tasks 2.1, 2.2, and 2.3 only.
- Problem understanding:
  - [x] Shift start time should come from when the local shift starts, not from an extra manual screen.
  - [x] Floor activity can be derived from existing bed-level acuity for Phase 4.
  - [x] AI-assisted floor acuity belongs to a later phase, not this local-only task.
- Solution understanding:
  - [x] `Shift.startedAt` is optional for old restored shifts and is set for newly started shifts.
  - [x] `src/utils/breakSchedule.ts` derives floor activity from acuity counts and formats the shift start time.
  - [x] `src/screens/FloorBoardScreen.tsx` shows shift start and floor activity in the board summary.
  - [x] The standalone Break Schedule route and manual input screen were removed.
- Broader context:
  - [x] Deterministic break generation can use this local context later without adding a separate input step.
  - [x] The change stays local-only and preserves existing assignment, persistence, flags, and simulated nurse behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-09 - Add Phase 4 Break Schedule Model and Refresh Marker

- Task: Complete Phase 4 Tasks 1.1, 1.2, and 1.3 only.
- Problem understanding:
  - [ ] Phase 4 needs break schedule state on the active shift without changing saved floor templates or previous-shift snapshots.
  - [ ] Restored shifts from earlier phases may not have `breakSchedule`, so displays need safe defaults.
  - [ ] Generated break times become stale when the local assignment is rerun, because break scheduling depends on the assignment snapshot.
- Solution understanding:
  - [ ] `src/types/models.ts` defines break schedule types and optional `Shift.breakSchedule`.
  - [ ] `src/utils/breakSchedule.ts` centralizes safe break schedule views, nurse entry lookup, nurse warning lookup, and the missing-break label.
  - [ ] `markBreakScheduleNeedsRefresh` only changes a generated schedule's status to `needs_refresh`; it preserves entries, inputs, and warnings.
  - [ ] Local assignment reruns use the helper to mark existing generated schedules stale without changing break times yet.
- Broader context:
  - [ ] These helpers prepare the Break Schedule screen, floor board badges, and simulated nurse break display without implementing those future tasks early.
  - [ ] The change stays local-only and does not add backend, auth, realtime, notification, sync, drag-and-drop, tablet, or AI behavior.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-08 - Confirm Phase 4 App Compatibility

- Task: Complete Phase 4 setup Task 0.2 without writing feature code.
- Problem understanding:
  - [ ] Phase 4 break scheduling needs to build on the existing local active-shift workflow.
  - [ ] Setup work should identify touchpoints before adding model, route, screen, or generation code.
  - [ ] Break scheduling must stay local-only and avoid future-phase backend, auth, realtime, notification, sync, drag-and-drop, tablet, and AI work.
- Solution understanding:
  - [ ] `docs/phase-4/setup-notes.md` records the current compatibility review.
  - [ ] Break schedule state should attach to optional `activeShift.breakSchedule`, not saved floor templates or previous-shift snapshots.
  - [ ] Existing active-shift persistence can carry a plain JSON optional field without a storage version change.
  - [ ] `docs/phase-4/tasks.md` marks only setup Task 0.2 done.
- Broader context:
  - [ ] This protects Phase 1 assignment, Phase 2 persistence, and Phase 3 nurse simulation behavior before Phase 4 feature code starts.
  - [ ] The next task can add types with a clear source-of-truth decision.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Remove Carry-Over Review Subheader and Button Bar

- Task: Remove the "Previous-shift suggestions" subheader and the workflow step chips (button bar) from the Carry-Over Review screen.
- Problem understanding:
  - [x] The subtitle text was redundant.
  - [x] The carry-over button bar looked squished and took up vertical space unnecessarily, especially since this is a read-only review screen right now.
- Solution understanding:
  - [x] `src/screens/CarryOverReviewScreen.tsx` no longer passes the `subtitle` prop to `<WorkflowScreen>`.
  - [x] `src/screens/CarryOverReviewScreen.tsx` no longer passes the `flow` prop to `<WorkflowScreen>`, which removes the step chips.
  - [x] The unused `carryOverReviewFlow` import was removed.
- Broader context:
  - [x] This improves the visual layout of the Carry-Over Review screen.
  - [x] It reduces clutter before adding interactive suggestion review features later.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Accept and Dismiss Nurse Suggestions (Task 6.2)

- Task: Make nurse carry-over suggestions interactive with accept, dismiss, and undo actions.
- Problem understanding:
  - [x] The Carry-Over Review screen showed nurse suggestions as static "Pending review" badges with no way to act on them.
  - [x] Accepted nurses need to join the active shift's nurse list so they appear on the Nurses screen.
  - [x] Max patient load should NOT carry over because staffing limits change between shifts.
- Solution understanding:
  - [x] `src/screens/CarryOverReviewScreen.tsx` tracks review decisions in local `useState` as a `Record<suggestionId, NurseReviewEntry>`.
  - [x] Accept, dismiss, and undo only change local component state — no shift mutation happens until Continue.
  - [x] `handleContinue` collects all accepted suggestions and adds them to `activeShift.nurses` in one `setLocalState` call, with `maxPatientLoad` defaulting to `sideLoadLimits.admitting.max`.
  - [x] Duplicate prevention checks name + licenseType + experienceLevel before adding.
  - [x] `SuggestionStatusBadge` now takes a `variant` prop for accepted (green), dismissed (gray), and pending (amber) styles.
- Broader context:
  - [x] This fulfills US6 acceptance criteria for nurse carry-over.
  - [x] Patient carry-over (Task 6.3) follows the same pattern but modifies `bedStates` instead of `nurses`.
  - [x] The manual add flow on NursesScreen remains unchanged.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Plan Phase 2 Local Persistence

- Task: Create Phase 2 planning docs for local persistence, saved template reuse, active shift restore, and previous-shift carry-over suggestions.
- Problem understanding:
  - [ ] Phase 1 proved the local charge nurse workflow, but its work needs to become reusable across app launches and shifts.
  - [ ] Phase 2 should add persistence without introducing backend, auth, realtime sync, invite links, offline queues, or other later-phase infrastructure.
  - [ ] Carry-over suggestions should speed setup while still requiring the charge nurse to review nurses and patients from the most recent shift that used the same floor template.
- Solution understanding:
  - [ ] `docs/phase-2/user-stories.md` defines the Phase 2 charge nurse stories and acceptance criteria.
  - [ ] `docs/phase-2/data-model.md` documents persisted local app state, previous-shift snapshots keyed by floor template, and carry-over suggestion records.
  - [ ] `docs/phase-2/mobile-design.md` documents the local-only UI direction and carry-over review design.
  - [ ] `docs/phase-2/screens.md` maps the Phase 2 screen changes and new Carry-Over Review screen.
  - [ ] `docs/phase-2/tasks.md` orders small implementation tasks with manual validation checks.
  - [ ] The plan preserves Phase 1 assignment behavior and keeps future-phase features out of Phase 2.
- Broader context:
  - [ ] Phase 2 creates the bridge between a one-session prototype and a reusable local workflow.
  - [ ] The storage boundary should make persistence understandable before server persistence arrives in a later phase.
  - [ ] Previous-shift snapshots support next-shift setup for the same floor template without becoming full shift history or analytics.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Complete Phase 2 Setup Tasks

- Task: Complete Phase 2 setup tasks 0.1 and 0.2 by documenting local-persistence scope guardrails and Phase 1 compatibility.
- Problem understanding:
  - [ ] Phase 2 needs a clear boundary before feature code starts.
  - [ ] Persistence should save durable product data, not temporary setup/edit UI state.
  - [ ] Phase 1 assignment behavior should remain unchanged while persistence is added around it.
- Solution understanding:
  - [ ] `docs/phase-2/setup-notes.md` records Phase 2 included and excluded scope.
  - [ ] The setup note identifies current persisted candidates: floor templates, active shift, assignment result, flags, and future previous-shift snapshots.
  - [ ] The setup note identifies temporary state: draft floor template and active-shift-template edit mode.
  - [ ] `docs/phase-2/tasks.md` marks setup tasks 0.1 and 0.2 done.
- Broader context:
  - [ ] These setup tasks reduce the chance of accidentally adding backend, auth, sync, or future nurse flows during persistence work.
  - [ ] Separating persisted state from temporary UI state will make the storage boundary easier to implement and explain.
  - [ ] Preserving assignment behavior keeps Phase 2 focused on reuse, not algorithm changes.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Add Phase 2 Persisted State Types

- Task: Add the Phase 2 TypeScript types for persisted local app state and carry-over snapshots.
- Problem understanding:
  - [ ] `LocalAppState` is live app state and can include temporary UI workflow data.
  - [ ] Phase 2 needs a separate saved-state shape for durable local storage data.
  - [ ] Carry-over suggestions need a previous-shift snapshot without adding backend, auth, sync, or invite concepts.
- Solution understanding:
  - [ ] `src/types/models.ts` now defines `LocalStorageVersion`.
  - [ ] `src/types/models.ts` now defines nurse and patient carry-over suggestion types.
  - [ ] `src/types/models.ts` now defines `PreviousShiftSnapshot`.
  - [ ] `src/types/models.ts` now defines `PersistedLocalAppState`.
  - [ ] `LocalAppState` was left unchanged so Task 1.1 does not implement storage behavior early.
  - [ ] `docs/phase-2/tasks.md` marks Task 1.1 done.
- Broader context:
  - [ ] These types create the contract Task 1.2 can use for a local storage repository.
  - [ ] Separating persisted state from live UI state helps prevent unfinished drafts from being restored as saved data.
  - [ ] The change keeps Phase 2 local-only and does not change assignment behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Add Local Storage Repository

- Task: Add the Phase 2 local storage repository boundary for persisted app state.
- Problem understanding:
  - [ ] Screens should not each handle storage keys, JSON strings, or empty-storage defaults.
  - [ ] Task 1.2 needs a storage boundary, not full app startup restore or template persistence yet.
  - [ ] The repository should save `PersistedLocalAppState`, not temporary `LocalAppState` draft fields.
- Solution understanding:
  - [ ] `src/services/storageRepository.ts` defines a `StorageAdapter` interface.
  - [ ] `src/services/storageRepository.ts` defines a `StorageRepository` with load, save, and clear methods.
  - [ ] The repository serializes with `JSON.stringify` and parses with `JSON.parse`.
  - [ ] Missing saved data returns an empty persisted state with storage version, empty templates, and empty previous-shift snapshots.
  - [ ] A memory adapter exists for simple manual/debug validation without adding a storage library yet.
  - [ ] `docs/phase-2/tasks.md` marks Task 1.2 done.
- Broader context:
  - [ ] Later tasks can plug this boundary into app startup and saved template behavior.
  - [ ] Keeping storage behind one service makes persistence easier to explain and change.
  - [ ] The change remains local-only and does not add backend, auth, sync, or invite behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Handle Invalid Saved Data Safely

- Task: Update the local storage repository so invalid or unreadable saved app state does not crash the app.
- Problem understanding:
  - [ ] Saved local data can be missing, malformed JSON, the wrong version, or the wrong top-level shape.
  - [ ] The app should recover locally instead of crashing during load.
  - [ ] Task 1.3 should not add backend, account, sync, conflict-resolution, or full recovery-screen behavior.
- Solution understanding:
  - [ ] `src/services/storageRepository.ts` now has a small persisted-state type guard.
  - [ ] `src/services/storageRepository.ts` now parses saved JSON through `parsePersistedLocalAppState`.
  - [ ] Invalid JSON, wrong top-level shape, wrong storage version, or storage read errors return an empty persisted state.
  - [ ] The repository keeps a local, beginner-readable recovery message constant for future UI use.
  - [ ] `docs/phase-2/tasks.md` marks Task 1.3 done.
- Broader context:
  - [ ] This makes the storage boundary safer before the app starts using it on launch.
  - [ ] Returning an empty persisted state keeps Phase 2 local-first and understandable.
  - [ ] Deeper validation can be added later when specific persisted entities are wired into screens.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-06 - Save Completed Floor Templates

- Task: Persist completed floor templates after the existing Template Review save validation passes.
- Problem understanding:
  - [ ] Completed templates were added to React state, but React state alone disappears when the app closes.
  - [ ] Task 2.1 should save reusable floor structure without adding startup restore, active-shift persistence, backend, auth, sync, or future-phase behavior.
  - [ ] The main branch considered was where to save: inside the screen versus through the existing local storage boundary.
- Solution understanding:
  - [ ] `src/services/localStorageAdapters.ts` provides a small adapter for browser localStorage on web and Expo FileSystem document storage on native.
  - [ ] `src/store/LocalStateContext.tsx` exposes `saveFloorTemplates`, which writes only the template list into `PersistedLocalAppState`.
  - [ ] `src/screens/TemplateReviewScreen.tsx` now saves the completed template list before updating the in-memory workspace and returning home.
  - [ ] The saved templates contain floor name, doctor sides, rooms, and beds, not patients, nurses, acuity, assignments, or flags.
  - [ ] `docs/phase-2/tasks.md` marks Task 2.1 done.
- Broader context:
  - [ ] This is the write side of template persistence; loading saved templates on app start stays reserved for Task 2.2.
  - [ ] Keeping persistence behind the repository makes later active-shift and carry-over storage easier to explain.
  - [ ] The change stays local-only and does not alter Phase 1 validation or assignment rules.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-06 - Load Saved Templates on App Start

- Task: Load saved floor templates into Local Workspace when the app starts.
- Problem understanding:
  - [ ] Task 2.1 saved templates to persisted storage, but the app still started from empty React state.
  - [ ] Task 2.2 should restore templates only, not active shifts, carry-over snapshots, backend data, auth, sync, or future-phase behavior.
  - [ ] A fresh install or cleared local data should still produce the normal empty template list.
- Solution understanding:
  - [ ] `src/store/LocalStateContext.tsx` now loads persisted app state once when `LocalStateProvider` mounts.
  - [ ] The provider copies `savedState.floorTemplates` into `localState.floorTemplates`.
  - [ ] Draft template state, active-shift state, and previous-shift snapshots are left alone for later tasks.
  - [ ] The effect avoids updating state after the provider unmounts.
  - [ ] `docs/phase-2/tasks.md` marks Task 2.2 done.
- Broader context:
  - [ ] Tasks 2.1 and 2.2 together complete the first save-and-restore loop for floor templates.
  - [ ] Loading through the provider keeps screens focused on UI instead of storage details.
  - [ ] Active shift restore remains a later Phase 2 task with its own acceptance criteria.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-06 - Prevent Duplicate Saved Template Names

- Task: Validate new floor names against saved floor template names.
- Problem understanding:
  - [ ] Once saved templates load on app start, new floor creation must not allow a duplicate saved template name.
  - [ ] The duplicate check should compare the typed name after trimming extra spaces.
  - [ ] Task 2.3 should not add edit flows, backend validation, auth, sync, or future-phase behavior.
- Solution understanding:
  - [ ] `src/screens/FloorDetailsScreen.tsx` now uses `hasSavedFloorTemplateWithName` for duplicate template-name validation.
  - [ ] The helper compares the trimmed typed name to each saved template name after trimming.
  - [ ] The current draft id is ignored so continuing through the same draft does not block itself.
  - [ ] `docs/phase-2/tasks.md` marks Task 2.3 done.
- Broader context:
  - [ ] Saved templates are now treated like the real local workspace list for new floor validation.
  - [ ] Preventing duplicates keeps later template reuse and editing easier to reason about.
  - [ ] This completes the small Phase 2 floor-template persistence group before template reuse tasks begin.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Start Shift From a Saved Template

- Task: Start a new active shift from a saved floor template without changing the saved template.
- Problem understanding:
  - [ ] A saved floor template is reusable structure, while an active shift is today's working copy.
  - [ ] Task 3.1 should reuse saved templates without adding template editing, active-shift persistence, carry-over review, backend, auth, sync, or future-phase behavior.
  - [ ] The main branch considered was whether to keep the selected template in `draftFloorTemplate` or keep the copied shift structure only on `activeShift`.
- Solution understanding:
  - [ ] `src/screens/HomeScreen.tsx` still creates a fresh `Shift` from the selected saved `FloorTemplate`.
  - [ ] The helper copies doctor sides, rooms, and beds into the active shift and creates one empty `BedState` for each saved bed.
  - [ ] Starting the shift now clears `draftFloorTemplate` and `isEditingActiveShiftTemplate` so the saved template is not treated as an editable draft for this task.
  - [ ] Patient, acuity, nurse, load limit, assignment, and flag changes stay on `activeShift`, not on the saved template.
  - [ ] `docs/phase-2/tasks.md` marks Task 3.1 done.
- Broader context:
  - [ ] This starts the Phase 2 template reuse group while preserving the existing Phase 1 setup flow.
  - [ ] The saved template remains the blueprint, and each shift gets its own editable local state.
  - [ ] Later tasks can add saved-template editing and active-shift persistence separately.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Add Template Edit Entry Point

- Task: Use saved template row selection as the edit entry point and block template editing while an active shift exists.
- Problem understanding:
  - [ ] Saved templates need a clear edit doorway, but editing should not be available during an active shift.
  - [ ] Task 3.2 should add the entry point only, not the saved-edit persistence from Task 3.3.
  - [ ] The main branch considered was whether to add a separate `Edit` button or reuse the existing row tap plus Template Review step navigation.
- Solution understanding:
  - [ ] `src/screens/HomeScreen.tsx` uses the existing saved template row tap as the edit entry point.
  - [ ] Pressing a saved template row with no active shift copies the saved template into `draftFloorTemplate` and opens Template Review, whose step chips can route back to the setup screens.
  - [ ] Pressing a saved template row while an active shift exists shows `End the active shift before editing templates.`
  - [ ] Template Review uses the same `Save template` path for new templates and saved-template edits.
  - [ ] `docs/phase-2/tasks.md` marks Task 3.2 done.
- Broader context:
  - [ ] This keeps saved template editing separate from active shift work.
  - [ ] Copying the saved template into draft state protects the saved template from accidental mutation.
  - [ ] Later Task 3.3 can add local persistence for saved template edits without changing the entry point again.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Compact Active Shift Actions

- Task: Make the active shift card actions smaller and place `Resume` and `End shift` in one row.
- Problem understanding:
  - [ ] The two full-width buttons made the active shift card taller than necessary.
  - [ ] The buttons should still communicate primary action versus destructive action.
  - [ ] The main branch considered was whether to keep full labels or shorten the primary label so both buttons fit cleanly.
- Solution understanding:
  - [ ] `src/screens/HomeScreen.tsx` wraps the active shift actions in one horizontal row.
  - [ ] `Resume Active Shift` became `Resume` with an accessibility label that still says `Resume active shift`.
  - [ ] Both buttons keep a 44px minimum touch target while using less vertical space.
- Broader context:
  - [ ] This improves scanability of the Local Workspace without changing shift behavior.
  - [ ] The destructive `End shift` action remains visually separate through the red outline.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Save Template Edits Locally

- Task: Save edited saved floor templates back to local storage.
- Problem understanding:
  - [x] Task 3.2 opened a saved template as a draft, but Task 3.3 needs `Save template` to persist the edited draft.
  - [x] Cancel/back should not change the saved template because edits live in `draftFloorTemplate` until save.
  - [x] The main branch considered was whether to treat new templates and edited templates as separate save paths or one replace-by-id path.
- Solution understanding:
  - [x] `src/screens/TemplateReviewScreen.tsx` uses one `Save template` path for new templates and edits.
  - [x] `getFloorTemplatesWithSavedTemplate` replaces an existing template with the same id or appends a brand-new template.
  - [x] `saveFloorTemplates` persists the updated template list locally.
  - [x] Existing Phase 1 validation still blocks incomplete templates before save.
  - [x] `docs/phase-2/tasks.md` marks Task 3.3 done.
- Broader context:
  - [x] Saved templates remain reusable local structure, not shift-specific patient or nurse data.
  - [x] Editing by matching template id keeps the local workspace list stable and beginner-readable.
  - [x] Later active-shift persistence and carry-over tasks can build on the same local storage boundary.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Validate Edited Templates Before Shift Start

- Task: Block shift start from incomplete saved templates and route the user to review/fix when possible.
- Problem understanding:
  - [ ] A saved template can become invalid after editing, such as having no rooms or missing room-to-side assignments.
  - [ ] Starting a shift from invalid structure would create broken shift state with missing beds or doctor-side mappings.
  - [ ] The main branch considered was whether to silently block, show only a message, or open the existing Template Review/edit path.
- Solution understanding:
  - [ ] `src/screens/HomeScreen.tsx` keeps the existing valid-template start-shift path unchanged.
  - [ ] `handleStartShift` blocks starting any saved template while another active shift exists.
  - [ ] If `isCompletedFloorTemplate` fails and no shift is active, `handleStartShift` copies the saved template into `draftFloorTemplate` and routes to Template Review.
  - [ ] If an active shift exists, it shows `End the active shift before starting another shift.`
  - [ ] Template Review already shows the existing incomplete-template validation message and step chips for fixing the template.
  - [ ] `docs/phase-2/tasks.md` marks Task 3.4 done.
- Broader context:
  - [ ] This protects active shift creation from bad saved template structure.
  - [ ] The fix path reuses Phase 1 template setup screens instead of adding recovery screens or future-phase infrastructure.
  - [ ] Later tasks can rely on started shifts having valid room, bed, and doctor-side structure.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Save Active Shift Changes

- Task: Save active shift changes into local persisted state.
- Problem understanding:
  - [x] React state keeps the active shift usable during the current app session, but it is not durable storage.
  - [x] Task 4.1 should write active shift changes only; restoring them on app start belongs to Task 4.2.
  - [x] The main branch considered was whether each screen should save manually or the provider should observe `activeShift` changes in one place.
- Solution understanding:
  - [x] `src/store/LocalStateContext.tsx` keeps `saveActiveShift` private to the provider.
  - [x] The provider watches `localState.activeShift` and saves it when it changes.
  - [x] The saved `Shift` includes status, admitting side, side load limits, nurses, bed states, assignment result, and flags because those fields already live on `activeShift`.
  - [x] The provider avoids clearing persisted active shift on initial app load before Task 4.2 restore exists.
  - [x] `docs/phase-2/tasks.md` marks Task 4.1 done.
- Broader context:
  - [x] This is the write side of active shift persistence.
  - [x] Keeping the save in the provider avoids spreading storage code across setup and board screens.
  - [x] Later restore and recovery tasks can read from the same local storage boundary.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Restore Active Shift on App Start

- Task: Restore the saved active shift into local app state when NurseFlow opens.
- Problem understanding:
  - [x] Task 4.1 saved active shift data, but React state still started empty after a reload.
  - [x] Task 4.2 should restore the one saved local active shift, not add history, backend sync, or recovery flows.
  - [x] The main branch considered was whether Home should load storage itself or the provider should keep startup restore in one place.
- Solution understanding:
  - [x] `src/store/LocalStateContext.tsx` now loads `savedState.activeShift` with saved floor templates.
  - [x] The existing Home active shift card appears because `localState.activeShift` is restored.
  - [x] The existing resume button routes setup shifts to `/start-shift` and assigned shifts to `/floor-board`.
  - [x] `draftFloorTemplate` and edit-mode state are still temporary and are not restored.
  - [x] `docs/phase-2/tasks.md` marks Task 4.2 done.
- Broader context:
  - [x] Active shift persistence now has both halves: save on change and restore on app start.
  - [x] Later missing-template recovery remains separate in Task 4.3.
  - [x] Later end-shift behavior remains separate in Task 4.4.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Handle Missing Template for Restored Shift

- Task: Show a local recovery message when a restored active shift references a missing floor template.
- Problem understanding:
  - [x] Saved local data can become inconsistent if an active shift points to a template id that is no longer saved.
  - [x] Task 4.3 should show a local recovery path, not add backend sync, conflict handling, or shift history.
  - [x] Normal template deletion already clears matching active shift state, so this handles unusual restored-data mismatch.
- Solution understanding:
  - [x] `src/screens/HomeScreen.tsx` detects `activeShiftMissingTemplate` from `localState.activeShift` and `localState.floorTemplates`.
  - [x] Home shows a warning on the active shift card when the saved template is missing.
  - [x] The existing `Resume` and `End shift` actions remain the recovery choices.
  - [x] Existing valid active shift and saved template behavior is unchanged.
  - [x] `docs/phase-2/tasks.md` marks Task 4.3 done.
- Broader context:
  - [x] This keeps restored local data from feeling broken or mysterious.
  - [x] Missing-template recovery is separate from Task 4.4 end-shift cleanup.
  - [x] The app remains local-only and does not add future-phase sync concepts.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Keep End Shift Local While Preserving Templates

- Task: Confirm ending a shift clears the active shift locally while saved templates remain available.
- Problem understanding:
  - [x] Active shift data and saved floor templates are different pieces of local state.
  - [x] Task 4.4 should clear the current shift only, not create previous-shift snapshots or carry-over suggestions.
  - [x] Ending a shift must stay local and should not introduce backend, sync, history, or archive concepts.
- Solution understanding:
  - [x] `src/screens/HomeScreen.tsx` already clears `activeShift`, `draftFloorTemplate`, and `isEditingActiveShiftTemplate` in `handleConfirmEndActiveShift`.
  - [x] `src/store/LocalStateContext.tsx` persists the cleared `activeShift` as `undefined`.
  - [x] Saved `floorTemplates` are preserved because the active-shift save path spreads the existing persisted state and only changes `activeShift`.
  - [x] No app code change was needed for this task because the existing Phase 1 end-shift action plus Tasks 4.1 and 4.2 already met the behavior.
  - [x] `docs/phase-2/tasks.md` marks Task 4.4 done.
- Broader context:
  - [x] This completes the active-shift persistence group.
  - [x] Previous-shift snapshots begin in Task 5.1, not Task 4.4.
  - [x] The app remains local-only and preserves saved reusable floor templates.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Store Previous-Shift Snapshots

- Task: Create a local previous-shift snapshot when ending a shift, keep one snapshot per template, and allow empty snapshots.
- Problem understanding:
  - [x] Carry-over suggestions need a small record of the ended shift before `activeShift` is cleared.
  - [x] Phase 2 should store only the latest snapshot per floor template, not a shift history list.
  - [x] Empty ended shifts should still produce a valid empty snapshot instead of crashing or inventing fake suggestions.
- Solution understanding:
  - [x] `src/screens/HomeScreen.tsx` builds a `PreviousShiftSnapshot` from the active shift before clearing it.
  - [x] Nurse suggestions store stable nurse profile fields, not max load or assignment teams.
  - [x] Patient suggestions store occupied patients with previous bed id, previous bed label, and acuity.
  - [x] `src/store/LocalStateContext.tsx` saves the snapshot through the local storage boundary.
  - [x] Saving a snapshot replaces any existing snapshot with the same `floorTemplateId`.
  - [x] Tasks 5.1, 5.2, and 5.3 are marked done in `docs/phase-2/tasks.md`.
- Broader context:
  - [x] This stores data for later carry-over review tasks without showing suggestion UI yet.
  - [x] The app remains local-only and does not add backend, sync, history, or analytics.
  - [x] Later tasks can read these snapshots when starting a new shift from the same template.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Add Carry-Over Review Screen

- Task: Route new shifts with a same-template previous snapshot to a read-only Carry-Over Review screen.
- Problem understanding:
  - [x] Starting a new shift needs a place to show previous-shift suggestions before normal setup.
  - [x] Suggestions must only come from the same floor template.
  - [x] Task 6.1 should not accept, dismiss, or convert suggestions yet.
- Solution understanding:
  - [x] `src/store/LocalStateContext.tsx` now restores `previousShiftSnapshots` into live local state.
  - [x] `src/screens/HomeScreen.tsx` checks for a same-template snapshot before deciding whether to route to Carry-Over Review or Start Shift.
  - [x] `src/screens/CarryOverReviewScreen.tsx` shows nurse and patient suggestions in separate read-only sections.
  - [x] Suggestions display as `Pending review` without storing review decisions yet.
  - [x] `docs/phase-2/tasks.md` marks Task 6.1 done.
- Broader context:
  - [x] This connects stored snapshots to visible setup workflow while staying local-only.
  - [x] It prepares the UI for Tasks 6.2 and 6.3 without implementing their behavior early.
  - [x] Templates with no snapshot still use the existing Start Shift flow.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Add Room Delete Swipe Cue

- Task: Make hidden room deletion more discoverable on the Rooms and Beds screen.
- Problem understanding:
  - [x] Room deletion already existed behind a swipe gesture.
  - [x] The UI did not clearly hint that the room row could be swiped to reveal delete.
  - [x] Hidden gestures are easy to miss, especially in a beginner-tested mobile prototype.
- Solution understanding:
  - [x] Each room row now shows a small visual cue with a chevron and trash icon.
  - [x] The cue points toward the existing right-swipe gesture that reveals the left-side remove action.
  - [x] The existing `SwipeRevealAction` behavior stayed unchanged.
  - [x] No new library or future-phase interaction pattern was added.
- Broader context:
  - [x] This improves discoverability without making delete the main room action.
  - [x] It keeps destructive behavior guarded by the existing swipe reveal pattern.
  - [x] It supports Phase 1 manual testing because testers can notice how room removal works.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Add Local End Shift Action

- Task: Add a confirmed local-only way to end the active shift.
- Problem understanding:
  - [x] Phase 1 had a way to start and resume an active shift, but no deliberate way to clear it.
  - [x] Restarting the app should not be the only way to leave an active-shift state.
  - [x] Ending a shift in Phase 1 should not imply history, archiving, backend persistence, or sync.
- Solution understanding:
  - [x] Local Workspace now shows an `End shift` action when an active shift exists.
  - [x] The action opens a confirmation dialog before clearing shift data.
  - [x] Confirming clears `activeShift`, `draftFloorTemplate`, and `isEditingActiveShiftTemplate`.
  - [x] Saved `floorTemplates` are preserved so the user can start another shift from the same template.
  - [x] `docs/phase-1/tasks.md` now includes completed Task 4.5.
- Broader context:
  - [x] This closes a basic lifecycle gap in the local prototype.
  - [x] It keeps the behavior Phase 1-sized: local cleanup, not shift history.
  - [x] The active shift is temporary working state; the floor template is reusable setup data.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Complete Phase 1 Task 9.x Manual Pass

- Task: Verify and mark Phase 1 tasks 9.1 through 9.5 complete.
- Problem understanding:
  - [x] The 9.x tasks are not new feature tasks; they prove the existing Phase 1 workflow works end to end.
  - [x] A passing typecheck alone would not prove the app can be manually used from empty state to floor board.
  - [x] Scope leaks can exist in config or dependencies even when screen code looks local-only.
- Solution understanding:
  - [x] The happy path was tested through the exported web app in the browser.
  - [x] Validation cases were checked for blank floor name, duplicate floor name, duplicate room, missing doctor side, invalid nurse max load, invalid patient age, and missing acuity.
  - [x] Assignment edge cases were checked against the real assignment utilities with crafted local shifts.
  - [x] Unused `expo-linking`, `expo-web-browser`, app scheme config, and a dead `hasPatientInfo` variable were removed.
  - [x] `docs/phase-1/tasks.md` now marks tasks 9.1 through 9.5 done.
- Broader context:
  - [x] Phase 1 is now validated as a local charge nurse prototype rather than only a collection of implemented screens.
  - [x] Removing scope leaks keeps future-phase concepts from silently entering Phase 1.
  - [x] The readability cleanup makes the patient/acuity screen easier for a beginner to explain.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Add Understanding Checkpoint Skill And Workflow

- Task: Add a required post-task teaching checkpoint to the repo instructions and create a reusable `$teaching-checkpoint` Codex skill.
- Problem understanding:
  - [x] The previous workflow ended at refactor and did not explicitly require teaching verification.
  - [x] The done criteria required explanations, but did not define how to confirm the human could explain the work herself.
  - [x] A repo-only rule makes the checkpoint required for NurseFlow, but does not make the method reusable across projects.
  - [x] A skill-only solution would be reusable, but future NurseFlow sessions might not reliably trigger it unless `AGENTS.md` anchors the requirement.
  - [x] The checklist template and process can be reusable, but the actual running checklist should stay with the project.
- Solution understanding:
  - [x] `AGENTS.md` now includes `Understanding checkpoint` as workflow step 11.
  - [x] `AGENTS.md` tells Codex to use `$teaching-checkpoint` when that skill is available.
  - [x] `C:\Users\psito\.codex\skills\teaching-checkpoint\SKILL.md` defines the reusable teaching workflow and checklist template.
  - [x] The new checkpoint asks for problem, solution, and broader-context understanding.
  - [x] The checklist file creates a durable place to track what was taught and verified.
  - [x] If `AskUserQuestion` is unavailable, direct chat questions are the fallback.
  - [x] The official skill validator could not run because the available Python runtimes do not have PyYAML; the frontmatter and TODO checks were inspected manually.
- Broader context:
  - [x] Future coding tasks should close only after implementation, validation, task tracking, and understanding verification.
  - [x] This supports the project goal of learning without over-automating.
  - [x] The skill makes the teaching checkpoint portable to other projects, while `AGENTS.md` keeps it mandatory here.
  - [x] The project checklist preserves task-specific learning history in the repo instead of hiding it inside a global skill.
  - [x] The checklist should stay concise so it helps learning instead of becoming busywork.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Handle Carry-Over Patient Missing Previous Bed

- Task: Handle carry-over patient suggestions whose previous beds no longer exist.
- Problem understanding:
  - [x] If a floor template is edited to remove a bed, patient suggestions from the previous shift using that bed cannot map to any existing `BedState`.
  - [x] Presenting them in the carry-over list would create complex resolution flows or risk data inconsistency.
  - [x] Simply omitting suggestions whose previous beds no longer exist keeps the shift setup workflow clean and lightweight.
- Solution understanding:
  - [x] `src/screens/CarryOverReviewScreen.tsx` filters `patientSuggestions` by checking if the suggestion's `previousBedId` still exists in the active shift's beds (`activeShift.beds`).
  - [x] Suggestions for deleted beds are discarded automatically by being filtered out of the Carry-Over Review list.
  - [x] No new unassigned patient models, custom sections, or complex validation blocks were added to `src/types/models.ts` or `src/screens/PatientsAndAcuityScreen.tsx`.
  - [x] `docs/phase-2/tasks.md` marks Task 6.4 done.
- Broader context:
  - [x] This maintains a simplified local-only design system without over-automating carry-over recovery.
  - [x] It supports charge nurse template updates without creating technical debt or complex corner-case UX handling.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Preserve Manual Add Flows

- Task: Verify that manual nurse and patient additions still function correctly alongside accepted carry-over suggestions.
- Problem understanding:
  - [x] Carrying over data must not lock the lists or prevent the charge nurse from entering new/temporary shift info manually.
  - [x] Carried-over suggestions and manually added items must blend into the same data model so the assignment resolver treats them uniformly.
- Solution understanding:
  - [x] Accepted suggestions are committed directly into `activeShift.nurses` and `activeShift.bedStates`.
  - [x] Since `NursesScreen.tsx` and `PatientsAndAcuityScreen.tsx` observe and mutate the same local state fields, they automatically support manual adds and edits on top of carried-over suggestions.
  - [x] No new components or changes were needed because the clean Phase 1 and Phase 2 data model integration already preserved these flows natively.
  - [x] `docs/phase-2/tasks.md` marks Task 6.5 done.
- Broader context:
  - [x] Keeping data representation uniform allows simple local-first screens to remain highly reusable and easy to understand.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Complete Phase 2 Manual Pass

- Task: Verify Phase 2 templates, shifts, carry-over, edge cases, scope, and readability end-to-end.
- Problem understanding:
  - [x] A manual pass is required to verify that local persistence, template reuse, and carry-over work correctly under realistic usage scenarios.
  - [x] We must ensure no scope leaks from future phases (such as backend connectivity, authentication, deep links, push notifications, etc.) have entered the local-only phase.
- Solution understanding:
  - [x] Verified template persistence (Task 7.1): Creating, reloading, editing, and starting shifts from saved templates.
  - [x] Verified active shift restore (Task 7.2): Resuming shifts from setup or board views after app restart.
  - [x] Verified carry-over happy path (Task 7.3): Ending a shift and starting a new one from the same template successfully carries over accepted nurses and patients.
  - [x] Verified carry-over edge cases (Task 7.4): Deleting previous beds correctly filters out suggestions, and empty shifts carry over without crashing.
  - [x] Verified local-only scope (Task 7.5): Confirmed no dependencies or UI elements for auth, backend sync, WebSocket, push notifications, etc.
  - [x] Verified beginner readability (Task 7.6): Code structure and data persistence remain local-first and easy to explain.
- Broader context:
  - [x] Establishing a thorough manual test pass ensures that the local prototype is robust and stable before any networked features are introduced in future phases.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Create Phase 3 Planning Docs

- Task: Create Phase 3 planning docs for local nurse view simulation.
- Problem understanding:
  - [x] Phase 3 needs to plan the regular nurse experience without adding real accounts, invite links, backend, realtime, push notifications, or multi-device behavior.
  - [x] The plan must preserve Phase 1 assignment behavior and Phase 2 local persistence/carry-over behavior.
  - [x] The implementation tasks need to stay small enough for one focused session each.
- Solution understanding:
  - [x] `docs/phase-3/user-stories.md` defines local role switching, nurse assignment visibility, mock issue flags, mock swap requests, charge nurse review, local decisions, and compatibility.
  - [x] `docs/phase-3/data-model.md` documents simulated role state, optional active-shift `nurseRequests`, request statuses, and derived nurse assignment view data.
  - [x] `docs/phase-3/mobile-design.md` and `docs/phase-3/screens.md` describe the phone-first UI changes without future-phase infrastructure.
  - [x] `docs/phase-3/tasks.md` orders the work into small, independently testable tasks with manual validation checks.
- Broader context:
  - [x] Planning the simulated nurse flow locally helps prove the product behavior before real auth, invite links, and realtime collaboration are introduced later.
  - [x] Keeping nurse assignment display derived from existing active-shift assignment data avoids duplicating patient or acuity state.
  - [x] Mock request status updates teach the future communication flow without overbuilding infrastructure.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Confirm Phase 3 Current App Compatibility

- Task: Complete Phase 3 Task 0.2 by reviewing current app compatibility before implementation.
- Problem understanding:
  - [x] Phase 3 needs a compatibility review before adding simulated nurse screens.
  - [x] The review should identify connection points without changing assignment behavior.
  - [x] The task should stay documentation-only and avoid jumping into role switching or request features.
- Solution understanding:
  - [x] `docs/phase-3/setup-notes.md` documents current routes, state, storage, flags, assignment compatibility, and likely future files.
  - [x] `docs/phase-3/tasks.md` marks only Task 0.2 done.
  - [x] Mock issue and swap requests are planned for optional `activeShift.nurseRequests` later, while simulated role selection remains temporary UI state.
  - [x] No implementation code was changed for this task.
- Broader context:
  - [x] This review gives the next Phase 3 implementation task a clear boundary.
  - [x] Deriving nurse assignment views from existing active shift data preserves one source of truth.
  - [x] Keeping request records on the active shift avoids introducing server-like state too early.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Phase 3 Local Role Simulation State

- Task: Complete Phase 3 Tasks 1.1, 1.2, and 1.3.
- Problem understanding:
  - [ ] Phase 3 needs a local way to switch between charge view and regular nurse simulation before nurse screens exist.
  - [ ] Simulated role state must not become auth, accounts, invite links, backend state, or persisted user state.
  - [ ] The Floor Board should expose the simulation entry only when the current local shift can support it.
- Solution understanding:
  - [ ] `src/types/models.ts` defines `SimulatedRole` and `SimulatedSessionState`.
  - [ ] `src/store/LocalStateContext.tsx` stores temporary simulation state beside local app state, but does not persist it.
  - [ ] `LocalStateProvider` clears invalid regular-nurse simulation state when the active shift is missing, has no nurses, or the selected nurse no longer exists.
  - [ ] `src/screens/FloorBoardScreen.tsx` adds the local role simulation card with `View as nurse` and `Back to charge view`.
  - [ ] `docs/phase-3/tasks.md` marks only Tasks 1.1, 1.2, and 1.3 done.
- Broader context:
  - [ ] This sets up the next Phase 3 task, the simulated nurse picker, without building it early.
  - [ ] Keeping role simulation temporary protects the app from looking like it has real nurse accounts.
  - [ ] The existing assignment result remains the future source of truth for nurse-facing data.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-08 - Add Phase 3 Simulated Nurse Picker

- Task: Complete Phase 3 Tasks 2.1 and 2.2.
- Problem understanding:
  - [ ] Phase 3 needs a picker so the tester can choose one active-shift nurse for local simulation.
  - [ ] The picker should not build the nurse assignment detail screen yet.
  - [ ] The picker needs clear local empty states when the app is not ready for nurse simulation.
- Solution understanding:
  - [ ] `src/app/simulated-nurse-picker.tsx` adds the Expo Router route.
  - [ ] `src/screens/SimulatedNursePickerScreen.tsx` lists active-shift nurses with license, experience, assigned-bed count, and room coverage.
  - [ ] Selecting a nurse updates temporary `simulatedSessionState.selectedNurseId`.
  - [ ] `src/screens/FloorBoardScreen.tsx` now routes `View as nurse` to the picker.
  - [ ] `docs/phase-3/tasks.md` marks only Tasks 2.1 and 2.2 done.
- Broader context:
  - [ ] This prepares Task 3 by choosing the nurse whose assignment will later be derived from active shift data.
  - [ ] Keeping assignment details out of this task prevents jumping ahead.
  - [ ] The picker still uses local-only language and does not introduce accounts or invite links.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-08 - Separate Template Editing From Active Shift Setup

- Task: Remove active-shift template editing behavior and make Carry Over part of shift setup headers.
- Problem understanding:
  - [ ] Saved floor templates should be edited from the floor template flow only.
  - [ ] Active shifts should use their own copied floor structure and should not be silently synced when a saved template changes.
  - [ ] The active shift setup header should not show the floor-template `Review` step.
- Solution understanding:
  - [ ] `src/screens/TemplateReviewScreen.tsx` now saves only `draftFloorTemplate` to saved templates.
  - [ ] Active shift template sync helpers were removed.
  - [ ] `isEditingActiveShiftTemplate` was removed from live local state.
  - [ ] `shiftSetupFlow` no longer includes `Review`.
  - [ ] `carryOverReviewFlow` shows `Carry Over`, then `Shift`, `Nurses`, and `Patients`.
- Broader context:
  - [ ] This keeps reusable template edits separate from per-shift setup and patient assignment work.
  - [ ] It reduces accidental state coupling before future nurse-facing Phase 3 screens build on active shift data.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-08 - Add Phase 3 Simulated Nurse Assignment View

- Task: Complete Phase 3 Tasks 3.1, 3.2, and 3.3.
- Problem understanding:
  - [x] The simulated nurse assignment view should show one nurse's assignment without duplicating active shift data.
  - [x] The screen should handle missing shift, missing assignment, missing nurse, and invalid assignment references safely.
  - [x] Mock issue and swap forms should not be implemented yet.
- Solution understanding:
  - [x] `src/utils/nurseAssignmentView.ts` derives the selected nurse's assignment from active shift data.
  - [x] `src/screens/SimulatedNurseAssignmentScreen.tsx` displays the selected nurse summary, room coverage, assigned beds, patient info, and acuity.
  - [x] `src/app/simulated-nurse-assignment.tsx` adds the route.
  - [x] `src/screens/SimulatedNursePickerScreen.tsx` now opens the assignment view after nurse selection.
  - [x] `docs/phase-3/tasks.md` marks only Tasks 3.1, 3.2, and 3.3 done.
- Broader context:
  - [x] Deriving the nurse view from `activeShift.assignmentResult` keeps the charge board and nurse simulation consistent.
  - [x] Disabled issue/swap buttons preserve the planned workflow without jumping ahead to request forms.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Phase 3 Local Nurse Request Model

- Task: Complete Phase 3 Tasks 4.1 and 4.2.
- Problem understanding:
  - [x] Phase 3 needs a local data shape for mock issue flags and swap requests before request forms exist.
  - [x] Request records should live on the active shift as the single source of truth for today's local request state.
  - [x] Old Phase 2 active shifts may not have a `nurseRequests` field, so missing arrays must be handled safely.
- Solution understanding:
  - [x] `src/types/models.ts` defines local request status, request type, and `NurseRequest`.
  - [x] `Shift` now has optional `nurseRequests?: NurseRequest[]`.
  - [x] `src/helpers/shiftHelpers.ts` initializes new active shifts with `nurseRequests: []`.
  - [x] `src/utils/nurseRequests.ts` returns `[]` for shifts that do not have request data yet.
  - [x] No auth, invite, push, server, sync, or offline queue fields were added.
- Broader context:
  - [x] Future mock issue and swap forms can save records to one active-shift location.
  - [x] Active shift persistence can save and restore these records through the existing local JSON path.
  - [x] Previous-shift snapshots and saved floor templates remain separate from nurse request history.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Phase 3 Mock Issue Submission

- Task: Complete Phase 3 Tasks 5.1, 5.2, and 5.3.
- Problem understanding:
  - [x] The simulated nurse needed a local way to flag an issue without adding real messaging, notifications, backend, or charge-nurse review actions yet.
  - [x] Blank issue messages should not create request records.
  - [x] Optional bed context must come only from the selected nurse's assigned beds.
- Solution understanding:
  - [x] `src/screens/SimulatedNurseIssueScreen.tsx` adds the local mock issue form.
  - [x] The form saves a `NurseRequest` with `type: "issue"` and `status: "pending"` onto `activeShift.nurseRequests`.
  - [x] `src/screens/SimulatedNurseAssignmentScreen.tsx` opens the issue form and shows the selected nurse's local issue history.
  - [x] The issue screen uses `getSelectedNurseAssignmentView` so bed options come from the same derived nurse assignment data as the nurse view.
  - [x] Swap requests, charge-nurse review, accept/decline, notifications, and backend behavior were not added.
- Broader context:
  - [x] This proves the local nurse-to-charge request write path before adding swap requests or charge review.
  - [x] Keeping request records on `activeShift` preserves one source of truth for local request state.
  - [x] The active shift persistence path can restore submitted issues because they are part of the active shift.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Phase 3 Mock Swap Submission

- Task: Complete Phase 3 Tasks 6.1, 6.2, and 6.3.
- Problem understanding:
  - [ ] The simulated nurse needed a local way to request a swap without moving assignments or adding real messaging infrastructure.
  - [ ] A swap request must have a source bed, unlike an issue request where bed context can be optional.
  - [ ] The source bed must come from the selected nurse's assigned beds.
- Solution understanding:
  - [ ] `src/screens/SimulatedNurseSwapScreen.tsx` adds the local mock swap form.
  - [ ] The form saves a `NurseRequest` with `type: "swap"` and `status: "pending"` onto `activeShift.nurseRequests`.
  - [ ] `src/screens/SimulatedNurseAssignmentScreen.tsx` opens the swap form and shows issue and swap records in local request history.
  - [ ] The swap screen validates missing source bed, blank reason, and stale or invalid source-bed IDs before saving.
  - [ ] Charge-nurse review, accept/decline, reassignment, notifications, and backend behavior were not added.
- Broader context:
  - [ ] This completes the nurse-side local request creation path for Phase 3.
  - [ ] Keeping swaps as request records preserves assignment results until a later explicit decision task.
  - [ ] The same `activeShift.nurseRequests` list can support the upcoming charge-nurse request review tasks.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Fix Duplicate Nurse Request IDs

- Task: Fix the duplicate `nurse-request-1` key error after submitting local nurse requests.
- Problem understanding:
  - [ ] React list keys must be unique so rows keep stable identity across renders.
  - [ ] The in-memory `createLocalId` counter can reset after reload or Fast Refresh while saved requests remain on the active shift.
  - [ ] Saved request IDs should be checked against existing active-shift requests before creating another one.
- Solution understanding:
  - [ ] `src/utils/nurseRequests.ts` now creates the next unused nurse request ID from `activeShift.nurseRequests`.
  - [ ] Existing duplicate request IDs are repaired when request lists are read for display or saving.
  - [ ] `src/screens/SimulatedNurseIssueScreen.tsx` and `src/screens/SimulatedNurseSwapScreen.tsx` create request IDs inside the state update using the freshest active shift.
  - [ ] Request history can keep using `request.id` as the React key because the saved IDs are now unique.
- Broader context:
  - [ ] This preserves local persistence behavior without adding server IDs or future-phase infrastructure.
  - [ ] The same helper protects both issue and swap request creation.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Show Local Requests on Flags Screen

- Task: Complete Phase 3 Tasks 7.1 and 7.2.
- Problem understanding:
  - [ ] Charge nurse review needs to show both assignment-generated flags and local nurse requests.
  - [ ] Mock nurse requests should not replace imbalance, unassigned-bed, or other assignment flags.
  - [ ] This task should stay read-only and not add accept, decline, detail screens, reassignment, or future infrastructure.
- Solution understanding:
  - [ ] `src/screens/FlagsScreen.tsx` now builds list items for assignment flags, section headers, local request rows, and empty rows.
  - [ ] Assignment flags and local nurse requests appear in separate sections.
  - [ ] Local request filters show all requests, only mock issues, or only mock swaps without changing assignment flag filtering.
  - [ ] Local request rows show mock type, status, requester, bed context, timestamp, message, and `Local only`.
  - [ ] The combined empty state says `No flags or local requests yet` only when both assignment flags and local requests are empty.
- Broader context:
  - [ ] This lets the charge nurse see mock issue and swap requests before decision actions exist.
  - [ ] Keeping requests read-only preserves the Phase 3 build order for later accept/decline tasks.
  - [ ] The screen still uses the active shift as the local source of truth.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Local Request Detail View

- Task: Complete Phase 3 Task 7.3.
- Problem understanding:
  - [ ] Local request rows can get dense once they show requester, bed context, message, timestamp, type, and status.
  - [ ] The charge nurse needs more room to read one request without changing request status yet.
  - [ ] Accept, decline, reassignment, backend, notification, and sync behavior must stay out of this task.
- Solution understanding:
  - [ ] `src/screens/ChargeNurseRequestDetailScreen.tsx` shows a read-only detail view for one local request.
  - [ ] `src/screens/FlagsScreen.tsx` makes local request rows tappable and routes by request ID.
  - [ ] `src/utils/nurseRequestDisplay.ts` centralizes request labels, timestamps, and bed context so list rows and detail view stay consistent.
  - [ ] Missing or stale request IDs show a safe recovery state.
  - [ ] No active decision controls are shown for resolved requests or pending swaps in this task.
- Broader context:
  - [ ] This improves charge nurse review before local accept/decline actions are added later.
  - [ ] Keeping the detail view read-only preserves the Phase 3 build order.
  - [ ] The active shift remains the local source of truth for request data.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Resolve Mock Swap Requests Locally

- Task: Complete Phase 3 Tasks 8.1, 8.2, and 8.3.
- Problem understanding:
  - [ ] Pending mock swap requests need a local outcome so the simulated nurse can see whether charge accepted or declined the request.
  - [ ] Accepting a swap request in this phase should not move patients, beds, or assignment rows.
  - [ ] Already accepted or declined requests should not show active decision controls again.
- Solution understanding:
  - [ ] `src/utils/nurseRequests.ts` updates only pending swap requests to `accepted` or `declined`.
  - [ ] `src/screens/ChargeNurseRequestDetailScreen.tsx` shows Accept and Decline only for pending mock swaps.
  - [ ] Resolving a swap stores `resolvedAt` and a short local `resolutionNote`.
  - [ ] `src/screens/SimulatedNurseAssignmentScreen.tsx` already reads request status from the active shift, so the selected nurse sees accepted, declined, and pending statuses from the same request list.
  - [ ] Bed assignments stay unchanged.
- Broader context:
  - [ ] This completes the local request outcome loop before the manual Phase 3 test pass.
  - [ ] The feature remains local-first and avoids backend, sync, notification, invite, and drag-and-drop behavior.
  - [ ] Future reassignment behavior can be considered separately without hiding today's status-only decision.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Local Request Status Filters

- Task: Add pending, accepted, and declined filters for local nurse requests on the Flags screen.
- Problem understanding:
  - [ ] Once swap requests can be accepted or declined, charge review needs a quick way to find requests by status.
  - [ ] Request status filters should not affect assignment-generated flags.
  - [ ] Status filtering should stay local-only and should not add new decision behavior.
- Solution understanding:
  - [ ] `src/screens/FlagsScreen.tsx` adds `All`, `Pending`, `Accepted`, and `Declined` request status filters.
  - [ ] Request type filters and request status filters combine, so the user can filter to examples like pending swaps.
  - [ ] Assignment severity filters still apply only to assignment flags.
- Broader context:
  - [ ] This makes the charge nurse review screen easier to scan after local swap decisions exist.
  - [ ] The filter reads request state but does not mutate request or assignment data.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Complete Phase 3 Manual Pass

- Task: Complete Phase 3 Tasks 9.1 through 9.7.
- Problem understanding:
  - [x] The final Phase 3 task block is a validation pass, not another feature build.
  - [x] The pass needs to prove local nurse simulation works while preserving Phase 1 and Phase 2 behavior.
  - [x] Any missing real-world swap constraints belong in later phases, not Phase 3.
- Solution understanding:
  - [x] `docs/phase-3/tasks.md` now marks Tasks 9.1 through 9.7 done.
  - [x] No feature code was added for Task 9 because the acceptance criteria are about manual validation, scope review, and readability.
  - [x] The reviewed code keeps role simulation local, derives nurse assignment visibility from the active assignment result, stores mock requests on the active shift, and updates swap request status without moving beds.
  - [x] Validation checks confirmed the app compiles, lints, exports for web, and starts without build errors.
- Broader context:
  - [x] This closes the local Phase 3 simulation before future backend, real roles, realtime, notification, or reassignment work.
  - [x] Keeping this pass small makes it easier to explain what Phase 3 proves and what it intentionally leaves for later.
- Verification:
  - [x] Human approved marking the checkpoint done.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Plan Phase 4 Local Break Scheduling

- Task: Create Phase 4 planning docs for local break scheduling.
- Problem understanding:
  - [ ] Phase 4 should follow `docs/phases.md`, where Phase 4 is Break Scheduling.
  - [ ] The older `AGENTS.md` future-phase summary names backend/auth as Phase 4, but backend/auth belongs to Phase 5 in `docs/phases.md`.
  - [ ] Break scheduling should build on assigned local shift data without adding backend, auth, realtime, deep links, push notifications, offline sync, drag-and-drop, tablet layout, or AI.
- Solution understanding:
  - [ ] `docs/phase-4/user-stories.md` defines local break scheduling stories and acceptance criteria.
  - [ ] `docs/phase-4/data-model.md` documents optional active-shift break schedule state, entries, warnings, and derived views.
  - [ ] `docs/phase-4/mobile-design.md` documents the phone-first UI direction for break inputs, schedule review, warnings, floor board badges, and simulated nurse break display.
  - [ ] `docs/phase-4/screens.md` maps the Floor Board, Break Schedule, and Simulated Nurse Assignment changes.
  - [ ] `docs/phase-4/tasks.md` orders small implementation tasks with manual validation checks and marks only planning Task 0.1 done.
- Broader context:
  - [ ] Phase 4 connects staffing assignments to practical break planning while staying local-first.
  - [ ] Break schedule state belongs to the active shift, not saved floor templates.
  - [ ] Phase 4 should preserve Phase 1 assignment, Phase 2 persistence, and Phase 3 simulated nurse request behavior.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-07-01 - Add Joined Nurse Live Assignment Updates

- Task: Complete Phase 6 Tasks 4.1, 4.2, and 4.3.
- Problem understanding:
  - [ ] Joined nurses needed live assignment refreshes after charge nurse changes without receiving the full active shift.
  - [ ] Joined nurses needed a visible connection state and safe recovery states for ended shifts or removed access.
  - [ ] The normal charge nurse flow still pointed to the old local simulation entry even though the real invite path now exists.
- Solution understanding:
  - [ ] `src/services/realtimeWorkspaceRepository.ts` adds `subscribeToJoinedNurseAssignmentView` for nurse-scoped change signals.
  - [ ] `src/store/ServerWorkspaceContext.tsx` keeps joined nurse realtime state separate from charge realtime state.
  - [ ] Joined nurse refreshes call `loadJoinedNurseAssignmentView`, not a full active-shift load.
  - [ ] `src/screens/RegularNurseWorkspaceScreen.tsx` shows the live status chip plus `Shift ended` and `Access removed` states.
  - [ ] `src/screens/FloorBoardScreen.tsx` removes the normal `View as nurse` simulation card from the charge board flow.
  - [ ] `src/app/simulated-nurse-*` route files were removed so simulation screens are no longer reachable as app routes.
  - [ ] `src/screens/SimulatedNurse*` screen files remain temporarily as reference code for real joined nurse request tasks.
- Broader context:
  - [ ] This keeps Phase 6 focused on foreground realtime and invite-based joined nurse access.
  - [ ] It preserves existing charge board, invite, join, assignment, request, and break display behavior.
  - [ ] It does not add push notifications, offline queues, conflict resolution, drag-and-drop, board sharing, tablet layout, or AI.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-07-13 - Register and Disable Device Push Tokens

- Task: Complete Phase 7 Tasks 1.2 and 1.3 only.
- Problem understanding:
  - [ ] A push token must be tied to a signed-in profile and one local device without becoming part of an active-shift snapshot.
  - [ ] A token that stays active after sign out could expose protected shift notifications to a signed-out device.
  - [ ] Token registration can fail independently, so it must not break the connected app workflow.
- Solution understanding:
  - [ ] `src/services/devicePushTokenRepository.ts` obtains an Expo push token, registers it through an authenticated Supabase function, and disables the same profile/device record before sign out.
  - [ ] `src/store/NotificationPermissionContext.tsx` starts registration only for signed-in profiles with granted or provisional permission and keeps readable registration state separate from shift data.
  - [ ] `src/store/AuthSessionContext.tsx` waits for any in-flight registration and disables the device record before ending the local auth session.
  - [ ] `docs/phase-7/supabase-device-token-setup.md` defines the token-only table and authenticated functions without giving the mobile client raw-token read access.
  - [ ] No notification sending, tap routing, settings/retry screen, cached view, or offline write behavior was added.
- Broader context:
  - [ ] Later notification events can target only active device records while server-fresh shift data remains the source of truth.
  - [ ] Signing back in refreshes the same profile/device record to active, including a changed Expo token and `last_seen_at` value.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Native development-build registration/sign-out check completed.
- Status: pending

### 2026-07-13 - Add Notification Settings UI

- Task: Complete Phase 7 Task 1.4 only.
- Problem understanding:
  - [ ] Notification permission and server device registration are separate states that can succeed or fail independently.
  - [ ] A user needs to understand whether notifications are on, off, or blocked without seeing a raw push token.
  - [ ] A failed token sync needs an explicit retry that does not affect connected app behavior.
- Solution understanding:
  - [ ] `src/components/NotificationPermissionCard.tsx` shows permission, device registration, and the supported Phase 7 notification categories.
  - [ ] `src/store/NotificationPermissionContext.tsx` uses the same `registerCurrentDevice` function for automatic setup and an explicit retry, without storing an attempt count.
  - [ ] The retry action appears only after registration fails and never displays the Expo push token.
  - [ ] No notification sending, tap routing, caching, or offline write behavior was added.
- Broader context:
  - [ ] Clear separate states help users distinguish an operating-system permission problem from a server registration problem.
  - [ ] Later Phase 7 notification events can reuse the registered device boundary without changing this settings UI.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Native registration-error retry check completed.
- Status: pending

### 2026-07-14 - Add Server Notification Event Model

- Task: Complete Phase 7 Task 2.1 only.
- Problem understanding:
  - [x] Important background alerts need a server-owned event record without copying active-shift or patient data into notification payloads.
  - [x] A notification event records delivery intent; it is not proof that the underlying shift changed or that a push was delivered.
  - [x] Ended shifts, removed nurse access, wrong charge recipients, and recipients without active device tokens must not produce deliverable events.
- Solution understanding:
  - [ ] `src/types/models.ts` defines the supported event types, route targets, lifecycle statuses, and `NotificationEventRecord` shape.
  - [ ] `docs/phase-7/supabase-notification-event-setup.md` defines the protected outbox table and server-only enqueue function.
  - [ ] Eligible events start as `pending`; ineligible events are recorded as `skipped` with a safe reason.
  - [ ] No workflow creates or sends notifications yet; Tasks 2.2 through 2.6 remain untouched.
- Broader context:
  - [ ] Later server workflow functions can enqueue small alerts while the app still reloads current server data after a notification tap.
  - [ ] Mobile clients cannot list raw outbox records or manufacture notification events directly.
- Verification:
  - [x] Human restated understanding first: notification events are recipient-specific and are not part of shared shift data.
  - [x] Gaps were explained: the event is delivery intent while the active shift remains server truth.
  - [x] Code-specific question completed: correctly predicted `pending` for an eligible event and `skipped` for ended, removed-access, and disabled-token cases.
  - [ ] Supabase SQL manual check completed.
- Status: in progress

### 2026-07-14 - Connect Shift Events to Notification Outbox

- Task: Complete Phase 7 Tasks 2.2 through 2.6 by enqueueing request,
  assignment, break, census, and safety-flag events after successful shift
  snapshot updates.
- Problem understanding:
  - [ ] Notification intent must be created from the successful server write so
    failed or screen-local changes cannot create false alerts.
  - [ ] Assignment and break notifications must be scoped to linked nurses,
    while request, census, and safety notifications target the shift's charge
    nurse.
  - [ ] Re-saving unchanged assignments, breaks, or flags must not create
    repeated notifications.
- Solution understanding:
  - [ ] `docs/phase-7/supabase-notification-event-setup.md` adds one
    `active_shifts` snapshot-diff trigger that calls the Task 2.1 outbox helper.
  - [ ] New linked-nurse issue and swap requests route to `request_detail`
    using only the request ID and generic copy.
  - [ ] Sorted per-nurse bed IDs and each nurse's break time/duration determine
    which linked nurses are affected.
  - [ ] Patient presence, stable bed IDs, and stable flag content detect floor
    events without putting patient details or the full board in an event.
  - [ ] Task 2.7 tap handling, cached views, offline writes, and later features
    remain unimplemented.
- Broader context:
  - [ ] Phase 6 foreground realtime remains unchanged because the same
    `active_shifts` write is still the source of truth.
  - [ ] Pending outbox events provide background awareness; they do not prove a
    push was delivered or replace loading current server state.
- Verification:
  - [x] Human restated understanding first: the trigger compares the shift
    snapshots for changes that can produce new notification events.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Supabase SQL manual checks completed.
- Status: in progress

### 2026-07-14 - Add Notification Tap Routing and Recovery

- Task: Implement Phase 7 Task 2.7 only by routing notification taps through
  current server state and safe recovery states.
- Problem understanding:
  - [ ] A notification payload can be stale, malformed, or opened by a user who
    is signed out or no longer has access.
  - [ ] Notification text and payload data are pointers, not authorization or
    the source of current shift truth.
  - [ ] Request, charge-board, and joined-nurse targets require different
    server checks before navigation.
- Solution understanding:
  - [ ] `src/utils/notificationTap.ts` accepts only supported route keys and
    the identifiers required by each target.
  - [ ] `src/store/NotificationTapContext.tsx` listens for warm and cold taps,
    refreshes server state, checks the target, and then navigates.
  - [ ] `src/services/serverWorkspaceRepository.ts` distinguishes a current
    joined assignment from ended-shift and removed-access recovery.
  - [ ] `src/screens/NotificationRecoveryScreen.tsx` shows safe sign-in,
    ended-shift, removed-access, missing-request, malformed-payload, and retry
    states without showing protected shift details.
- Broader context:
  - [ ] Background notifications now lead back to current Phase 5/6 server
    state without changing foreground realtime behavior.
  - [ ] The change adds no cache, offline write queue, deep link, assignment
    override, board sharing, tablet layout, or other future feature.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Native development-build notification tap check completed.
- Status: pending

### 2026-07-18 - Plan Phase 8 Advanced Interaction and Polish

- Task: Create the five Phase 8 planning documents without writing implementation code.
- Problem understanding:
  - [x] `docs/phases.md` defines Phase 8 as manual assignment overrides, request-scoped follow-up, responsive/tablet polish, accessibility, and large-floor performance cleanup.
  - [x] Phase 8 must extend the connected Phase 1-7 workflow without replacing the current assignment or break algorithms.
  - [x] Phase 9 production assignment optimization and Phase 10 advanced break optimization remain later work.
- Solution understanding:
  - [x] `docs/phase-8/user-stories.md` defines eight scoped stories with acceptance criteria and manual checks.
  - [x] `docs/phase-8/data-model.md` keeps the generated assignment as a baseline, stores immutable override history as server rows, and exposes current overrides through `activeAssignmentOverridesByBedId` for efficient effective-assignment reads.
  - [x] Request messages belong to one authorized request thread; issue review state stays separate from swap acceptance and completion.
  - [x] Human identified that issue requests use a follow-up thread and that swap completion connects to a manual assignment override.
  - [x] Clarified that both request types have threads, while accepting a swap remains separate from completing its assignment change through a linked override.
  - [x] Board sharing was removed from Phase 8 because an operating-system screenshot is sufficient for the current product scope; tablet layout remains presentation state rather than shift data.
  - [x] `docs/phase-8/mobile-design.md` and `docs/phase-8/screens.md` document phone-first, accessible, responsive flows.
  - [x] `docs/phase-8/tasks.md` orders small implementation tasks and gives every task a manual validation block; only planning Task 0.1 is marked done.
  - [x] Workload-limit and imbalance results are non-blocking warnings: the charge nurse may confirm after acknowledgement, and the resulting flag remains visible.
- Broader context:
  - [x] The override overlay lets a future assignment engine change without erasing the distinction between generated and manual decisions.
  - [x] Accepted and completed swaps are intentionally different so approval cannot be mistaken for a changed assignment.
  - [x] Server-fresh authorization, realtime scoping, and disconnected-write rules from previous phases remain in force.
- Verification:
  - [x] Human correctly predicted the non-blocking workload-warning behavior.
  - [x] Request-thread and swap-completion gap was explained.
  - [x] Document-specific data-flow question completed: human chose warning and a new generated baseline that supersedes old overrides.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-07-18 - Refine Phase 8 Override Storage Boundary

- Task: Update the Phase 8 plan to separate scalable active-override reads from server-side override history.
- Problem understanding:
  - [x] A flat override-history array would require routine board reads to scan or ship superseded records that do not affect the current assignment.
  - [x] Keeping only one override per bed would be fast but would destroy the history referenced by completed swap requests.
  - [x] Concurrent same-bed changes must not create two active overrides.
- Solution understanding:
  - [x] Durable override history is stored as indexed server rows with at most one active row per shift and bed.
  - [x] `activeAssignmentOverridesByBedId` exposes only current active overrides to routine app reads.
  - [x] Effective assignment uses a direct bed-key lookup and falls back to the generated assignment when the dictionary has no entry.
  - [x] A later same-bed move atomically supersedes the previous server row and replaces that bed's active dictionary value.
  - [x] A completed swap whose override is later superseded remains historical and displays `Completed — assignment later changed`.
- Broader context:
  - [x] The board and realtime payload stay small while authorized request or audit views can still query history.
  - [x] The generated assignment remains the baseline, and Phase 9 can later replace its generator without changing this boundary.
  - [x] No runtime code, database migration, or dependency was added during this planning update.
- Verification:
  - [x] Human restated that history rows preserve past data while the floor-board dictionary exists for performance.
  - [x] Gaps were explained.
  - [x] Document-specific data-flow question completed: human correctly identified the generated assignment as the fallback when no active dictionary entry exists.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-07-18 - Confirm Phase 8 App and Server Touchpoints

- Task: Complete Phase 8 Task 0.2 by documenting current code/server boundaries and compatibility risks without changing runtime behavior.
- Problem understanding:
  - [x] Current board, workload, joined-nurse RPC, swap-source validation, and Phase 7 assignment notifications read generated bed assignments directly.
  - [x] Current requests live in `shift_snapshot.nurseRequests`, while Phase 8 thread messages need a separate append-only server boundary.
  - [x] Broad `saveActiveShift` writes must not overwrite focused override-history or thread-message records.
- Solution understanding:
  - [x] `docs/phase-8/app-touchpoints.md` maps the current models, utilities, screens, routes, context, repositories, RPCs, realtime listeners, notification trigger, responsive primitives, and performance risks.
  - [x] One future pure effective-assignment helper must serve every current ownership consumer while leaving `generateLocalAssignmentResult` unchanged.
  - [x] `activeAssignmentOverridesByBedId` should be exposed beside the persisted `Shift` snapshot so `getActiveShiftPayload` cannot serialize server-owned history accidentally.
  - [x] The joined-nurse assignment RPC and swap-request RPC must validate effective ownership without exposing the full override dictionary or history.
  - [x] A valid bed-only override preserves the current Phase 4 break schedule because generated room coverage does not change; a full assignment rerun still regenerates breaks.
  - [x] Task 0.2 is marked done, and no runtime code, schema, dependency, or configuration changed.
- Broader context:
  - [x] Focused server transactions protect same-bed concurrency, swap completion, authorization, and notification correctness.
  - [x] Request-thread state should stay request-scoped instead of bloating the global workspace or joined-nurse assignment payload.
  - [x] Measuring the current nested board and request lists comes before performance refactoring.
- Verification:
  - [x] Human said the persistence-boundary distinction was not yet clear, then correctly identified the override table as authoritative when stale shift state disagrees.
  - [x] The broad-snapshot overwrite risk and derived-dictionary role were explained.
  - [x] File-specific data-flow question completed: human correctly said `getActiveShiftPayload` must not include the active override dictionary because overrides use a separate table.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-07-26 - Remove Break Scheduling

- Task: Remove break scheduling from the mobile app, shared data model,
  deployed Supabase behavior, and current roadmap without affecting assignment,
  request, realtime, invite, notification, or floor-board workflows.
- Problem understanding:
  - [x] Why removing only the visible screen would leave assignment generation,
    server payloads, notification logic, and legacy snapshots coupled to the
    retired feature.
  - [ ] Why historical checklist entries remain as an audit trail even though
    their referenced implementation no longer exists.
  - [ ] Why the roadmap keeps Phase 9 production assignment optimization while
    retiring the separate future scheduling optimizer.
- Solution understanding:
  - [ ] The route, screen, scheduler, types, UI summaries, assignment hook,
    joined-nurse response field, and notification event were removed together.
  - [x] `requireShiftSnapshot` now reconstructs the supported `Shift` shape so
    unknown retired snapshot fields cannot be written back to Supabase.
  - [ ] Supabase removed the retired event constraint option, rewrote both
    affected functions, and cleaned five legacy active-shift snapshots.
  - [ ] TypeScript, lint, stale-reference checks, and an Android Hermes
    production export passed.
- Broader context:
  - [ ] Assignment generation still saves assignment results and flags, and
    nurse-scoped access still returns assigned beds and request history.
  - [ ] The removal reduces the server and app contract without changing the
    unrelated Phase 9 optimizer plan.
- Verification:
  - [x] Human restated understanding first.
  - [ ] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
- Status: in progress

### 2026-07-26 - Revalidate Phase 8 Task 0.2

- Task: Recheck the existing Phase 8 app/server touchpoint report against the
  post-break-removal codebase without implementing Tasks 1.1 or later.
- Problem understanding:
  - [ ] Why an existing `Done` marker is not evidence that an architecture
    inventory still matches the current code.
  - [ ] Why Task 0.2 remains documentation-only even though it identifies later
    runtime files, server functions, and compatibility risks.
- Solution understanding:
  - [ ] The current model, generator, consumers, RPC wrappers, realtime
    subscriptions, notification routing, dependencies, and absent Phase 8
    runtime symbols were checked directly.
  - [ ] The dated revalidation records that the report still matches the
    post-removal app without adding runtime behavior.
- Broader context:
  - [ ] Task 1.1 remains the first effective-assignment implementation task;
    Task 0.2 does not create its helper, types, tables, or actions early.
  - [ ] Revalidation protects later implementation from relying on stale
    architectural assumptions.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
- Status: pending

### 2026-08-03 - Add Effective-Assignment Derivation

- Task: Implement Phase 8 Task 1.1 without adding override persistence or
  changing the assignment generator.
- Problem understanding:
  - [x] Why generated bed assignments must remain an unchanged baseline.
  - [x] Why routine assignment reads use one active override per bed instead
    of scanning override history.
  - [x] Why the active override dictionary belongs beside `Shift` rather than
    inside the persisted shift snapshot.
- Solution understanding:
  - [x] `getEffectiveAssignmentResult` performs one optional dictionary lookup
    per generated bed assignment and changes only the returned nurse ID.
  - [x] A missing dictionary or missing bed key falls back to the generated
    nurse, and the helper does not mutate its input.
  - [x] The focused tests cover zero, one, replaced same-bed, and
    removed-after-rerun active overrides.
- Broader context:
  - [x] Task 1.2 can use this single derivation boundary for loads and flags.
  - [x] Task 1.3 can populate the context projection from server-owned active
    rows without placing superseded history in routine board state.
- Verification:
  - [x] Human restated that an active override wins and removing its dictionary
    entry falls back to the current generated baseline.
  - [x] Clarified that `LocalId` provided readability but no distinct runtime
    value or nominal type safety, then simplified the models to plain strings.
  - [x] Human correctly identified the override's `toNurseId` as the effective
    nurse when a bed has an active override.
- Status: verified

### 2026-08-03 - Recalculate Effective Loads and Add the Override Transaction

- Task: Implement Phase 8 Tasks 1.2 and 1.3 while keeping the generated
  assignment result as the unchanged baseline.
- Problem understanding:
  - [ ] Why loads and assignment flags must use effective assignments rather
    than the generated baseline after an override exists.
  - [ ] Why move previews can run locally but confirmed moves must be
    revalidated and serialized by the server.
  - [ ] Why blocking reasons differ from warnings that may be acknowledged.
- Solution understanding:
  - [ ] `getAssignmentMovePreview` returns blocking reasons, new or worsened
    warnings, before/after loads, and a proposed result without mutating state.
  - [ ] The board and flags screens derive their display from the shared
    effective result while `activeShift.assignmentResult` remains unchanged.
  - [ ] `confirm_manual_assignment_override` checks ownership, freshness,
    coverage, occupancy, eligibility, and acknowledgements inside one locked
    transaction before superseding and inserting history rows.
  - [ ] Load-warning audit messages are generated from server-verified nurse,
    load, and limit values instead of trusting client-provided wording.
  - [ ] The client acknowledgement input excludes the profile and timestamp
    fields that only the server is allowed to establish.
  - [ ] Routine app reads load only the active bed-keyed projection; superseded
    rows remain server history.
- Broader context:
  - [ ] Task 1.4 can reuse the same preview for an accessible picker, and Task
    1.6 can call the same confirmation boundary for warning acknowledgement.
  - [ ] The partial unique index, row lock, and idempotency key prevent two
    active same-bed rows and duplicate confirmations.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
- Status: pending

### 2026-08-04 - Add Assignment Move UX, Refresh, and Safe Reruns

- Task: Implement Phase 8 Tasks 1.4 through 1.8 as one shared manual-assignment
  workflow.
- Problem understanding:
  - [x] Why swipe reveal is only an entry action while nurse selection and
    confirmation stay in one accessible tap-only flow.
  - [x] Why a local preview may show warnings but the server must recheck
    ownership, freshness, eligibility, and acknowledgements.
  - [x] Why rerunning assignment must replace the baseline and supersede active
    overrides in one transaction.
- Solution understanding:
  - [x] `AssignmentMoveDialog` explains disabled targets, supports tap-only
    selection, previews before/after loads, requires warning acknowledgement,
    and handles saving, success, stale, and retry states.
  - [x] `FloorBoardScreen` reads the effective assignment and wraps occupied
    assigned beds in the swipe-reveal `Move` action.
  - [x] Realtime listeners reload the active projection, while the joined-nurse
    RPC returns only that nurse's effective beds and no override history.
  - [x] `rerun_active_shift_assignment` locks the shift, checks the expected
    baseline, saves the new generated snapshot, and supersedes prior active
    override rows atomically.
- Broader context:
  - [x] The Phase 1 generator remains unchanged; Phase 8 layers deliberate
    manual decisions over its baseline.
  - [x] Swipe reveal keeps the board compact while the picker remains
    accessible, and joined nurses never receive the full board or audit history.
- Verification:
  - [x] Human restated the stale-baseline and atomic-rerun behavior first.
  - [x] Rerun SQL gaps were explained.
  - [x] Code-specific walkthrough covered rerun inputs, stale baseline checks,
    and current-effective-nurse freshness checks.
  - [x] Human reported completing the interactive feature test.
- Status: verified

### 2026-08-04 - Prevent Duplicate Local Nurse IDs After Reload

- Task: Fix the duplicate React key warning that appeared after reloading the
  app and adding a nurse while editing an active shift.
- Problem understanding:
  - [ ] Why the old module counter could generate `nurse-1` again after a page
    reload or Fast Refresh even when the active shift already contained it.
  - [ ] Why changing the `FlatList` key to the row index would only hide the
    warning while leaving duplicate nurse IDs in assignment data.
- Solution understanding:
  - [ ] `createLocalId` now combines the readable prefix with an Expo Crypto
    UUID, so newly created IDs remain unique across reloads.
  - [ ] `formatLocalId` keeps the small formatting rule independently testable
    without loading React Native modules in the Node test runner.
  - [ ] An already-persisted duplicate cannot be repaired automatically because
    assignment references cannot reveal which same-ID nurse was intended.
- Broader context:
  - [ ] The shared helper protects nurses, rooms, beds, shifts, and other local
    entities that use `createLocalId`, not only the nurse list's React keys.
  - [ ] Stable unique domain IDs let React preserve row identity and let the app
    safely reference the same entity from assignments and other records.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
- Status: pending

### 2026-08-04 - Remove Swap Selection From Generic Bed Moves

- Task: Simplify the assignment move review by removing the optional accepted
  swap selector.
- Problem understanding:
  - [x] Why asking the charge nurse to manually associate a routine bed move
    with a swap request was confusing and unnecessary.
  - [x] Why the app still needs a request-to-override link when an accepted swap
    is deliberately completed.
- Solution understanding:
  - [x] `AssignmentMoveDialog` no longer finds, displays, selects, or submits an
    accepted swap request during a generic board move.
  - [x] The backend `relatedSwapRequestId` capability remains available for the
    future request-specific `Complete with assignment move` action.
- Broader context:
  - [x] A normal board move and completing an accepted swap are separate user
    intentions and should begin from separate screens/actions.
  - [x] Task 2.6 can supply the request ID automatically instead of asking the
    user to choose it again.
- Verification:
  - [x] Human explained that swap completion starts from the nurse request page.
  - [x] Clarified that the request page already knows which request to link.
  - [x] Human correctly confirmed that `AssignmentMoveDialog` should not send
    `relatedSwapRequestId` for an ordinary board move.
- Status: verified

### 2026-08-04 - Close Swipe Row When Its Action Is Pressed

- Task: Reset a revealed bed row before opening the assignment move dialog.
- Problem understanding:
  - [x] Why closing the modal did not reset the still-mounted swipe component.
  - [x] Why the initial `false` state only applies when the component mounts.
- Solution understanding:
  - [x] `handleActionPress` animates `rowTranslateX` back to zero before calling
    the existing `onActionPress` callback.
  - [x] The reset belongs inside `SwipeRevealAction` because that component owns
    both the reveal state and animated value.
- Broader context:
  - [x] Other consumers of the reusable swipe action also return to a closed row
    after their action is consumed.
  - [x] No modal, floor-board, or navigation state was added for this behavior.
- Verification:
  - [x] Human identified that swipe behavior belongs to the swipe component.
  - [x] Clarified that the component owns both its reveal state and animation.
  - [x] Human correctly identified `0` as the closed `rowTranslateX` value.
- Status: verified

### 2026-08-05 - Add Request-Message Server Model and Authorization

- Task: Implement Phase 8 Task 2.1 without adding realtime thread refresh,
  request UI, lifecycle changes, or notification content.
- Problem understanding:
  - [x] Why request metadata can remain in the active-shift snapshot while
    append-only conversation messages need a separate server table.
  - [x] Why the server must derive the author profile and thread access instead
    of accepting an author identity from the client.
  - [x] Why a retry identifier prevents duplicate sends without treating two
    intentional messages with the same body as duplicates.
- Solution understanding:
  - [x] `NurseRequestMessage` represents one server-timestamped message with a
    verified `authorProfileId`; it does not duplicate an unused role label.
  - [x] `requestMessageRepository` provides the narrow app-facing list and
    append actions, trims and validates input, and strictly validates the
    camelCase result contract returned by both RPCs.
  - [x] `get_nurse_request_thread_actor` finds the request in the current shift
    snapshot, then authorizes only the shift owner or the linked access row
    whose `nurse_id` matches the request's `requestingNurseId`.
  - [x] The append RPC owns author identity and time; the partial unique index
    and mutation-key check return an identical retry without inserting a
    second row.
  - [x] The table grants no direct insert, update, or delete access, and this
    task creates no notification payload containing message bodies.
- Broader context:
  - [x] Task 2.2 can add narrow realtime refresh on top of this authorized
    record without exposing full active-shift data to joined nurses.
  - [x] Tasks 2.3 and 2.4 can share this repository while keeping their charge
    and nurse screens separate.
- Verification:
  - [x] Human explained that the authorization helper checks access, the list
    RPC returns ordered messages, and the append RPC adds one new row.
  - [x] Clarified that separate rows avoid full-shift JSON rewrites and support
    safe concurrent, nurse-scoped message operations.
  - [x] Human identified the signed-in profile as the author source and an
    identical mutation retry as one duplicate result; clarified that reusing
    the key for different content is rejected.
- Status: verified

### 2026-08-05 - Add Realtime Charge and Nurse Request Threads

- Tasks: Implement Phase 8 Tasks 2.2 through 2.4: narrow realtime refresh,
  the charge thread UI, and the joined-nurse scoped detail/thread UI.
- Problem understanding:
  - [x] Why original requests and conversation replies need separate realtime
    signals because they are stored in `active_shifts` and
    `nurse_request_messages`, respectively.
  - [ ] Why leaving the screen, losing nurse access, ending the shift, or
    signing out must stop the listener and disable message sending.
  - [ ] Why a route parameter alone is not proof that a joined nurse owns a
    request.
- Solution understanding:
  - [ ] Private Database Broadcast triggers emit pointer-only events, topic RLS
    authorizes the signed-in participant, and the client refetches through its
    existing authorized server boundary.
  - [ ] `useRequestThread` owns authorized loading, listener lifecycle,
    chronological merging, connection state, and idempotent send retries.
  - [ ] `RequestThread` is shared presentation; it aligns messages by comparing
    `authorProfileId` with the signed-in profile and does not need role labels.
  - [ ] `JoinedNurseRequestDetailScreen` looks up the route ID only inside the
    nurse-scoped `requestHistory` before enabling the message hook.
  - [ ] A failed connected send retains the draft and mutation ID, while a
    disconnected composer creates no offline queue.
- Broader context:
  - [ ] Charge and requesting nurse now share one server-ordered conversation
    without exposing the full board to the joined nurse.
  - [ ] Request metadata and lifecycle state remain separate from append-only
    conversation rows so later lifecycle tasks can evolve independently.
- Verification:
  - [x] Human explained the distinction between watching `active_shifts` for
    original requests and `nurse_request_messages` for replies, and identified
    that both a server signal and client subscriber are required.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [x] Two authorized sessions completed the send/receive manual check.
- Status: in progress

### 2026-08-08 - Add Request Lifecycle, Swap Completion, and Safe Activity Notifications

- Tasks: Implement Phase 8 Tasks 2.5 through 2.7 without changing the
  generated assignment algorithm or adding an offline queue.
- Problem understanding:
  - [x] Why issue acknowledgement needs its own lifecycle instead of reusing
    the swap decision status.
  - [x] Why accepting a swap cannot by itself prove that a bed assignment
    changed.
  - [x] Why push payloads must use generic copy and server-authorized routing
    rather than message bodies or patient details.
- Solution understanding:
  - [x] Missing `issueReviewStatus` derives as `open`, and the charge-only RPC
    owns reviewed, resolved, and reopened transitions.
  - [x] `relatedSwapRequestId` enters the existing assignment transaction, and
    the database trigger records completion only after its override is saved.
  - [x] `getNurseRequestLifecycleState` derives the shared charge/nurse label,
    including `Completed - assignment later changed` when the saved completion
    override is no longer active.
  - [x] `NURSE_REQUEST_LIFECYCLE_STATE` owns the reusable lifecycle values, and
    `NurseRequestLifecycleState` is derived from that constant object so the
    runtime values and TypeScript type cannot drift apart.
  - [x] Message and meaningful lifecycle writes enqueue one generic event for
    the other participant; enqueue failure is isolated from the request write.
  - [x] `NotificationTapContext` reloads current authorized charge or
    nurse-scoped state before opening request detail and otherwise uses safe
    recovery.
- Broader context:
  - [x] Request decisions, assignment changes, conversation messages, realtime
    refresh, and push awareness stay separate but connect through stable IDs.
  - [x] Completed request history remains durable even when a later assignment
    move becomes the active state.
- Verification:
  - [x] Human restated current understanding before explanation.
  - [x] Human explained what proves an accepted swap was actually completed.
  - [x] Code-specific walkthrough of `getNurseRequestLifecycleState` or the
    swap-completion trigger completed.
  - [x] Hosted two-session lifecycle and notification checks completed.
- Status: verified

### 2026-08-09 - Add Phase 8 Responsive Layout and Visual Polish

- Tasks: Implement Phase 8 Tasks 4.1 through 4.4 without changing domain data,
  nurse authorization, request behavior, or the assignment algorithm.
- Problem understanding:
  - [ ] Why layout mode must come from current content width instead of device
    type or persisted shift data.
  - [ ] Why the phone floor board stays a vertical list while tablet shows only
    one selected nurse's full detail.
  - [ ] Why charge and joined-nurse request layouts can share a breakpoint but
    must keep separate authorization boundaries.
- Solution understanding:
  - [ ] `getResponsiveLayoutMode` defines one 768-point boundary, while
    `useResponsiveLayout` derives the current mode from `useWindowDimensions`.
  - [ ] `ResponsiveContent` centers unchanged setup flows and allows the
    Phase 8 screens to use a readable expanded maximum width.
  - [ ] `FloorBoardScreen` owns selected nurse state above its compact/expanded
    render branch, so resizing does not change shift data or lose selection.
  - [ ] Charge request, joined request, and joined workspace screens use
    balanced columns only in expanded mode and preserve the compact order.
  - [ ] `WorkflowScreen` keeps prominent actions full width by default, while
    `ChargeNurseRequestDetailScreen` opts its navigation-only `Back to flags`
    control into the 144-by-44 compact secondary appearance.
- Broader context:
  - [ ] Responsive presentation remains independent of the server-owned shift,
    effective assignment, realtime refresh, and nurse-scoped access model.
  - [ ] Phase 9 can replace assignment generation without changing this layout
    boundary or the Phase 8 manual-move interaction.
- Verification:
  - [ ] Human restated current understanding before explanation.
  - [ ] Gaps were explained.
  - [ ] Code-specific walkthrough of `useResponsiveLayout` and selected nurse
    behavior completed.
  - [x] TypeScript, Expo lint, responsive breakpoint tests, and targeted
    assignment/request regression tests passed.
  - [x] Signed-in compact charge board, charge request, joined assignment, and
    joined request flows were checked in the browser with no app-origin errors.
  - [x] The rendered `Back to flags` button measured 144 by 44 points with the
    intended secondary surface and outline treatment.
  - [ ] Native tablet portrait/landscape, keyboard, and long-text checks passed.
- Status: pending

### 2026-08-09 - Complete Phase 8 Accessibility and Performance Work

- Tasks: Implement Phase 8 Tasks 5.1 through 5.3 without changing assignment
  rules, adding a list library, or treating development fixtures as shift data.
- Problem understanding:
  - [x] Why acuity cannot rely on its colored rail and why a swipe cannot be the
    only accessible path to the move dialog.
  - [x] Why reply typing should not reformat every existing message timestamp or
    rebuild every stable message row.
  - [x] Why repeated array scans are avoidable after the effective shift changes,
    while the active bed-keyed assignment remains the ownership source.
- Solution understanding:
  - [x] `useReducedMotion` shares one native preference listener and lets move
    and modal transitions skip animation when the system preference is enabled.
  - [x] `RequestThread` reuses one `Intl.DateTimeFormat` and memoizes the stable
    history separately from the changing composer draft.
  - [x] `createFloorBoardLookup` indexes effective assignments, beds, rooms,
    nurses, flags, loads, teams, and coverage once per effective shift change.
  - [x] The 400-bed and 250-message fixture lives under `tests/` and can never
    become production or Supabase shift data.
  - [x] Measurement justified the formatter and lookup cleanup, but did not
    justify a new list library or a nested thread list.
- Broader context:
  - [x] Phase 8 remains presentation and interaction work; the Phase 1 assignment
    generator and Phase 8 active override projection are unchanged.
  - [x] Native VoiceOver/TalkBack, dynamic type, focus-return, scroll, swipe, and
    rotation checks remain part of Task 6.3 rather than being claimed by headless
    measurements.
- Verification:
  - [x] Human restated that Task 5 covers performance improvements and
    accessibility changes.
  - [x] Gaps were explained at a high level before the code-specific quiz.
  - [x] Code-specific walkthrough of `RequestMessageList`,
    `createFloorBoardLookup`, or the memoized `FloorBoardScreen` projections
    completed.
  - [x] TypeScript, Expo lint, lookup tests, and targeted assignment/request
    regression tests passed.
  - [x] Repeatable JavaScript measurements recorded the before/after projection
    results in `docs/phase-8/accessibility-and-performance-pass.md`.
  - [x] Signed-in web smoke checks loaded charge request detail and the expanded
    floor board, exposed headings and spoken acuity, and measured the changed
    interactive targets at 44 points or taller without app-origin errors.
  - [ ] Native accessibility and device-interaction checks passed.
- Status: verified

### 2026-08-10 - Plan Phase 9 Production Assignment Optimizer

- Task: Create the five requested Phase 9 planning documents without changing
  app, backend, schema, dependency, configuration, or test code.
- Problem understanding:
  - [x] Why the Phase 1 phone generator can strand globally usable capacity.
  - [x] Why Phase 9 must replace baseline generation without replacing the
    existing `AssignmentResult` and Phase 8 manual-override boundary.
  - [x] Why the Python optimizer must run as a separately deployed service
    instead of being imported into the Expo app.
- Solution understanding:
  - [x] `docs/phase-9/` defines user stories, data contracts, mobile behavior,
    screen states, and small ordered implementation tasks.
  - [x] Expo calls a separately deployed Python/OR-Tools service; Supabase owns
    the user-authorized prepare action and service-authorized atomic finalization.
  - [x] Hard constraints protect max load, red-bed RN eligibility,
    occupied-bed-only assignment, and coverage eligibility.
  - [x] Lexicographic priorities minimize unassigned beds before acuity load,
    patient count, and stable tie-breaks.
  - [x] Each successful run gets a new server-generated result ID, while stale
    or failed runs preserve the previous baseline and active manual moves.
- Broader context:
  - [x] Existing boards, flags, realtime refresh, notifications, and nurse-
    scoped reads can consume the optimizer result without parallel models.
  - [x] AI, EHR/EMR, automated acuity, multi-hospital tools, handoff notes,
    analytics, solver settings UI, and offline writes remain outside Phase 9.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained through the concrete Expo, Python/OR-Tools, and
    Supabase prepare/finalize flow.
  - [x] Human identified that finalization must reject an older revision because
    someone may have updated an optimizer input during calculation.
  - [x] Human correctly predicted that a timed-out rerun preserves the existing
    assignment result and active manual overrides.
  - [x] Human identified security as a reason to reload Supabase after success;
    clarified that the reload also confirms the exact committed source of truth.
  - [x] Human identified `AssignmentResult` as the compatibility contract that
    existing Phase 1-8 consumers continue to use.
  - [x] Document-specific question or walkthrough completed.
- Status: verified

### 2026-08-15 - Freeze the Phase 9 Optimizer Rules

- Task: Complete the specification and manual review for Phase 9 Task 0.2
  without adding runtime, dependency, schema, configuration, or test code.
- Problem understanding:
  - [x] Why the optimizer needs one frozen definition for participating beds,
    dynamic team count, coverage, side guidance, ordering, objectives, and
    outcomes before solver implementation.
  - [x] Why minimizing unassigned occupied beds must outrank every workload,
    team-balance, side-guidance, and deterministic preference.
  - [x] Why side-based maximums remain soft guidance while each nurse's
    `maxPatientLoad` is a hard constraint.
- Solution understanding:
  - [x] How exact staged solves fix each proven optimum before starting the
    next objective.
  - [x] Why `FEASIBLE` at the deadline is a timeout rather than a committable
    result, while an optimal understaffed result may still contain unassigned
    beds.
  - [x] How canonical ordinals, per-bed owner fixing, and per-nurse team fixing
    make equal aggregate solutions deterministic.
  - [x] Why room coverage is projected from the room's selected team and why
    nurse experience has two narrow uses: an otherwise-equal red-bed owner tie
    and equal category distribution across otherwise-equal teams.
  - [x] Why every occupied room selects exactly one generated team, while
    multiple nurses from that same team may split the room's beds.
  - [x] How the dynamic team formula grows beyond two teams while keeping team
    membership counts within one nurse of each other.
  - [x] How `optimal`, `infeasible_input`, `timed_out`, and
    `internal_failure` differ.
- Broader context:
  - [x] Why the existing `AssignmentResult` and manual-override baseline
    contracts remain unchanged.
  - [x] Why the 400-bed/40-nurse ceiling still requires a production-like
    benchmark during Task 0.3.
  - [x] Why Task 0.2 adds no Python service, OR-Tools package, endpoint, schema,
    or mobile behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or document walkthrough completed.
- Status: verified

### 2026-08-15 - Document the Phase 9 Python Service Boundary

- Task: Complete the architecture and deployment specification for Phase 9
  Task 0.3 without adding Python, OR-Tools, schema, endpoint, configuration, or
  mobile runtime code.
- Problem understanding:
  - [x] Why Expo cannot import the OR-Tools Python package and why the solver
    needs its own bounded backend runtime.
  - [x] Why Cloud Run is the current best-fit managed-container host, what it
    costs operationally, and when AWS or Azure would be the better choice.
  - [x] Why a valid Supabase JWT proves identity but the prepare action must
    separately prove active-shift ownership.
  - [x] Why the maximum-floor ceiling remains provisional until the implemented
    solver passes a production-like benchmark.
- Solution understanding:
  - [ ] How the single `POST /v1/assignment-runs` route distinguishes an
    initial run from a rerun using the expected baseline ID.
  - [ ] How the user bearer token is verified, forwarded only to prepare, and
    then discarded without being stored or logged.
  - [ ] Why only the server-secret finalization transaction may save an
    optimizer result, and why a normal app user cannot invent one.
  - [ ] Why the service uses one Uvicorn worker, Cloud Run concurrency one, and
    CP-SAT `num_search_workers = 1`.
  - [ ] How the 135-second internal deadline, 140-second host timeout, and one
    shared 120-second solve budget prevent a late partial result from committing.
  - [ ] How an immutable container revision and traffic rollback restore the
    previous service without changing an existing assignment baseline.
- Broader context:
  - [ ] Why the app receives only the optimizer base URL and remains unaware of
    Python modules, solver variables, and the finalization credential.
  - [ ] Why Supabase remains the source of truth and the app reloads it after a
    successful action instead of trusting the endpoint response as the board.
  - [ ] Why Task 0.3 freezes the benchmark method but cannot honestly record a
    passing result before the later solver implementation exists.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [ ] Code/document-specific question completed.
  - [ ] Maximum-floor benchmark report attached after solver implementation.
- Status: in progress - architecture document written; teaching checkpoint and
  the later implementation-dependent benchmark remain pending.

### 2026-08-15 - Confirm Current Phase 9 Assignment Touchpoints

- Task: Complete the code and server-boundary trace for Phase 9 Task 0.4
  without changing app behavior, database functions, schemas, dependencies,
  configuration, or tests.
- Problem understanding:
  - [x] Why the current first assignment and rerun calculate the result on the
    phone but do not use the same server write boundary.
  - [x] Why accepting a complete client `nextShift` is not an acceptable
    production optimizer trust boundary.
  - [x] Why a successful rerun must save the new baseline and supersede active
    overrides atomically.
- Solution understanding:
  - [x] How `AssignmentReviewScreen` currently branches from local generation
    into the broad first-run save or focused rerun RPC.
  - [x] Where current baseline IDs are created, checked, and stored, and why
    Phase 9 needs a fresh opaque ID for each successful run.
  - [x] How `getEffectiveAssignmentResult` overlays active moves without
    mutating the saved baseline, generated teams, room coverage, or result ID.
  - [x] Why effective flags are regenerated after workspace load while saved
    `shift.flags` describes the committed baseline.
  - [x] How Realtime signals cause charge and joined-nurse refetches without
    broadcasting assignment or patient data.
  - [x] Where server-side notification comparison observes committed baseline
    changes and why failed or stale solves must write nothing.
- Broader context:
  - [x] Which current files and server functions Phase 9 changes, and which
    board, manual-move, joined-nurse, Realtime, and notification contracts it
    preserves.
  - [x] Why unrelated generic `saveActiveShift` callers must not be routed
    through the optimizer.
  - [x] Why the standalone Phase 8 manual-move notification caveat remains a
    separate integration/regression concern rather than a hidden Task 0.4
    behavior change.
- Verification:
  - [x] Human restated current understanding before explanation.
  - [x] Gaps were explained.
  - [x] Code/document-specific question completed.
  - [x] First-run, rerun, and baseline/effective manual traces completed.
  - [x] Document-only diff and touchpoint reference checks passed.
- Status: verified

### 2026-08-19 - Add Canonical Phase 9 Optimizer Fixtures

- Task: Implement Phase 9 Task 1.1 by defining synthetic canonical optimizer
  inputs, expected decisions, allowed aggregate-equivalent choices, and every
  frozen objective value without implementing a solver.
- Problem understanding:
  - [x] Why expected outcomes must be frozen before OR-Tools implementation.
  - [x] Why the fixture catalog uses normalized structured data and excludes
    patient identity and free-text clinical fields.
  - [x] Why the greedy-failure fixture needs the one-capacity team on the
    lower-census room to preserve the four-capacity team for the larger room.
- Solution understanding:
  - [x] How `phase9OptimizerFixtures.json` represents canonical input order,
    teams, room-team choices, bed owners, and objective values.
  - [x] Why `allowedEquivalentChoices` records aggregate-equivalent decisions
    but does not replace the final canonical decision.
  - [x] How `validateDecisions` recomputes max loads, red-owner ranks, side
    guidance, and team gaps without searching for an optimum.
  - [x] Why red-bed checks require an RN while understaffing uses a `null`
    owner instead of exceeding a nurse's hard max load.
- Broader context:
  - [x] How Task 1.2 can normalize server shift data into the same ordered input
    shape and how later solver tasks can use the catalog as regression oracles.
  - [x] Why this task adds no Python service, OR-Tools dependency, endpoint,
    schema, mobile behavior, or patient data.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained using the greedy-failure capacities and the
    red-bed assertion in `validateDecisions`.
  - [x] Human predicted the greedy-failure fixture's unassigned count and
    explained the team-capacity choice.
  - [x] Code-specific walkthrough of `validateDecisions` completed; human
    correctly predicted that an LPN red-bed owner fails the assertion.
  - [x] Focused fixture checks passed: 14/14.
  - [x] Full Node test suite passed: 37/37.
  - [x] Expo lint and TypeScript validation passed.
- Status: verified

### 2026-08-19 - Add Phase 9 Input Normalization and Validation

- Task: Implement Phase 9 Task 1.2 by converting a server-authoritative shift
  snapshot into a validated, canonical, immutable solver model and stable
  fingerprint without adding solver behavior.
- Problem understanding:
  - [ ] Why malformed or unrelated shift data must fail before solver creation.
  - [ ] Why database/query iteration order cannot become an accidental optimizer
    tie-break.
  - [ ] Why patient free text and empty beds do not belong in solver input.
- Solution understanding:
  - [ ] How `normalize_shift_snapshot` validates IDs, relationships, acuity,
    max loads, admitting side, side ranges, and supported-size ceilings.
  - [ ] How captured snapshot ordinals produce canonical side, room, bed, and
    nurse order while incidental bed-state order is ignored.
  - [ ] How immutable dataclasses define the temporary normalized model.
  - [ ] How canonical JSON plus SHA-256 produces the reproducibility and
    idempotency fingerprint.
  - [ ] Why patient initials determine occupancy but initials, diagnosis, age,
    names, and labels are excluded from the returned model and fingerprint.
- Broader context:
  - [ ] Why Tasks 1.3-1.6 consume the normalized model instead of raw Shift JSON.
  - [ ] Why this task adds no OR-Tools model, HTTP endpoint, database write,
    Expo import, or assignment result.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Human predicted whether a diagnosis-only change affects the fingerprint.
  - [ ] Code-specific walkthrough of `normalize_shift_snapshot` completed.
  - [x] Python normalization suite passed: 4 tests, including all 11 fixtures
    and eight invalid-input branches.
  - [x] Existing Node suite passed: 37/37.
  - [x] Expo lint, TypeScript, Python compilation, and diff checks passed.
  - [x] Local validation used Python 3.14.4; the production-pinned Python
    3.13.14 runtime gate remains required by the later service/benchmark work.
- Status: pending

### 2026-08-19 - Add Phase 9 Team and Room-Coverage Model

- Task: Implement Phase 9 Task 1.3 with the pinned OR-Tools team-membership
  and occupied-room structure, deferring the human checkpoint by request until
  Tasks 1.2-1.6 are all implemented.
- Problem understanding:
  - [ ] Why team membership and room coverage must be explicit solver decisions.
  - [ ] Why an occupied room cannot mix nurses from different teams.
- Solution understanding:
  - [ ] How every nurse is constrained to exactly one evenly sized team.
  - [ ] How every occupied room selects exactly one generated team.
  - [ ] Why room coverage is derived from the selected team's full membership
    instead of separate unconstrained coverage variables.
  - [ ] Why empty rooms have no solver team variable and project empty coverage.
- Broader context:
  - [ ] How Task 1.4 can require each bed owner to belong to the room's team.
  - [ ] Why Task 1.3 does not yet choose optimal bed owners or workloads.
- Verification:
  - [ ] Combined human checkpoint completed after Task 1.6.
  - [x] All 11 canonical fixture structures are feasible.
  - [x] Split-room coverage equals the selected team's two-nurse membership.
  - [x] Empty-room and repeated fixed-projection checks passed.
- Status: pending - implementation complete; combined checkpoint deferred by
  user request.

### 2026-08-19 - Add Phase 9 Bed-Assignment Hard Constraints

- Task: Implement Phase 9 Task 1.4 with eligible nurse/unassigned bed choices,
  max-load, RN-only red-bed, and assignment-implies-coverage constraints,
  deferring the checkpoint until Task 1.6 by request.
- Problem understanding:
  - [ ] Why unavoidable understaffing needs an internal unassigned choice.
  - [ ] Why red eligibility, hard max load, and room-team membership cannot be
    repaired only after solving.
- Solution understanding:
  - [ ] How every participating bed has exactly one eligible owner or unassigned.
  - [ ] Why LPN variables are never created for red beds.
  - [ ] How nurse max load is a hard sum constraint.
  - [x] How each bed assignment is restricted to its room's selected team.
- Broader context:
  - [ ] Why empty beds never create assignment variables.
  - [ ] How Task 1.5 can optimize only among decisions that already satisfy all
    safety and capacity rules.
- Verification:
  - [ ] Combined human checkpoint completed after Task 1.6.
  - [x] Human correctly explained that an owner choice is rejected when the
    nurse does not belong to the team covering the bed's room.
  - [x] All canonical fixture assignments satisfy the hard constraints.
  - [x] Forced overload and cross-team ownership are infeasible.
  - [x] Red-bed LPN and empty-bed variable checks passed.
- Status: pending - implementation complete; combined checkpoint deferred by
  user request.

### 2026-08-19 - Add Phase 9 Lexicographic Objectives

- Task: Implement Phase 9 Task 1.5 with exact staged CP-SAT objectives,
  deterministic tie-breaks, pinned OR-Tools, one worker, a fixed seed, and one
  shared solve budget; defer the checkpoint until Task 1.6 by request.
- Problem understanding:
  - [ ] Why one guessed weighted sum could trade a safety priority for a later
    preference.
  - [ ] Why `FEASIBLE` is insufficient for fixing a lexicographic optimum.
- Solution understanding:
  - [ ] How every `OPTIMAL` stage value becomes an equality before the next
    objective is solved.
  - [ ] How the objective order covers unassigned, nurse load, red-owner rank,
    side guidance, ordered team gaps, and canonical decisions.
  - [ ] Why one worker, fixed seed, pinned OR-Tools, and canonical fixing support
    reproducible decisions.
- Broader context:
  - [ ] Why later preferences can never worsen the fixed unassigned count.
  - [ ] Why runtime upgrades must pass the same deterministic fixture suite.
- Verification:
  - [ ] Combined human checkpoint completed after Task 1.6.
  - [x] Human explained that tie-breakers make equal-quality floor assignments
    predictable instead of allowing arbitrary choices.
  - [x] Human explained that each earlier objective is fixed before later
    objectives are solved, so tie-breakers cannot worsen clinical priorities.
  - [x] Human explained that a timeout during a tie-breaker returns an error
    rather than saving a partial assignment.
  - [x] All 11 fixtures match every expected objective and canonical decision.
  - [x] Stage-order and repeated-decision checks passed.
  - [x] Exact OR-Tools 9.15.6755 is installed in the ignored service environment
    and recorded with exact transitive versions in `requirements.lock`.
- Status: pending - implementation complete; combined checkpoint deferred by
  user request.

### 2026-08-19 - Build and Independently Validate Phase 9 Output

- Task: Implement Phase 9 Task 1.6 by projecting canonical solver decisions to
  the existing assignment and flag shapes and independently rejecting corrupt
  output; defer the combined checkpoint until all validation finishes.
- Problem understanding:
  - [ ] Why a solver candidate must not be trusted solely because CP-SAT returned
    `OPTIMAL`.
  - [ ] Why internal unassigned choices cannot become fake saved assignments.
- Solution understanding:
  - [ ] How every successful build receives a fresh result ID while child IDs
    are stable within that result.
  - [ ] How generated teams, room coverage, and bed assignments preserve the
    existing mobile `AssignmentResult` keys.
  - [ ] How existing flag types are rebuilt from the same validated result.
  - [ ] How independent validation recomputes IDs, relationships, hard rules,
    decisions, objectives, and flags without reading solver variables.
- Broader context:
  - [ ] Why existing board, effective-assignment, flags, and nurse-view readers
    do not need a second optimizer result model.
  - [ ] Why finalization must receive only output that passes this boundary.
- Verification:
  - [ ] Combined human checkpoint completed after full validation.
  - [x] All fixtures build the established output shape.
  - [x] Fresh ID, stable child ID, unassigned flag, shared-budget timeout, and
    corrupt-output rejection checks passed.
  - [x] Existing TypeScript floor-board, effective-assignment, nurse-view, and
    flag lookup helpers consumed real Python-generated output.
  - [x] Complete Phase 9 core passed: 23/23 Python tests and 2/2 cross-language
    compatibility tests.
  - [x] Phase 1-8 regression passed: 37/37 Node tests, TypeScript, and Expo lint.
  - [x] Python compilation, exact dependency health, ignored-environment, and
    diff checks passed.
- Status: pending - implementation complete; combined checkpoint remains.

### 2026-08-20 - Refactor the Phase 9 Python Service for Readability

- Task: Make the complete Phase 9 Python optimizer service easier for a beginner
  to read without changing normalization, solver, or output behavior.
- Problem understanding:
  - [x] Nested comprehensions can hide which solver variables are created and
    which constraints are added.
  - [x] A stored OR-Tools `IntVar` is a symbolic decision; its solved 0/1 value
    is read later through the solver.
  - [ ] Why expanding every simple expression would add noise rather than clarity.
- Solution understanding:
  - [x] Nurse/team choices now use explicit keys, variable names, loops, and
    intent-focused comments.
  - [x] Human explained that `add_exactly_one` requires each nurse to belong to
    one team while the solver chooses which team.
  - [ ] How the same readable phase structure now applies to normalization,
    assignment constraints, staged objectives, output building, and validation.
- Broader context:
  - [ ] Why readability matters especially at clinical eligibility, hard-capacity,
    objective-priority, and output-validation boundaries.
  - [x] The refactor changes presentation and local structure, not the assignment
    contract or expected decisions.
- Verification:
  - [x] Human restated the nurse/team decision flow in her own words.
  - [x] Gaps around `new_bool_var`, dictionary values, and solved values were
    explained.
  - [x] Code-specific walkthrough of `nurse_team` and `add_exactly_one` completed.
  - [x] All 23 Python tests, 2 cross-language tests, and 37 existing Node tests
    passed; TypeScript, Expo lint, Python compilation, and dependency checks pass.
- Status: in progress - nurse/team model verified; broader service walkthrough
  remains part of the combined Task 1.2-1.6 checkpoint.

### 2026-08-22 - Complete Phase 9 Server Coordination and Atomic Save

- Task: Implement Phase 9 Tasks 2.1-2.4 as one authenticated, idempotent,
  atomic optimizer request flow, then complete one combined checkpoint.
- Problem understanding:
  - [x] Why a backend run record is needed instead of trusting a client-created
    assignment or storing a duplicate shift snapshot.
  - [x] Why an identical retry is checked before current preconditions, while a
    new mutation must match the current revision and baseline.
  - [x] Why bearer-token authentication, shift authorization, solver validation,
    and protected finalization are separate security boundaries.
- Solution understanding:
  - [x] How `prepare_optimizer_run` derives the caller's charge profile and
    coordinates one run before returning the authorized snapshot.
  - [x] How `active_shifts.updated_at` acts as the server revision precondition;
    human explained that the board may change between prepare and finalization.
  - [x] How `run_optimizer_request` branches completed/in-progress retries before
    normalization, solving, and finalization.
  - [x] Why an immediate running retry waits, while the same mutation may reclaim
    a run only after its 90-second recovery lease expires.
  - [x] Why prepare and finalize lock the run and shift in the same order; human
    identified prevention of circular transaction waiting.
  - [x] How `finalize_optimizer_run` saves baseline, flags, run success, and
    rerun override supersession in one transaction.
  - [x] Why failed, stale, timed-out, and invalid paths never update
    `active_shifts`; human identified `active_shifts` as the real assignment
    change while `optimizer_runs` stores non-commit outcomes.
- Broader context:
  - [x] Why the successful `active_shifts` update automatically reuses existing
    realtime and generic notification behavior.
  - [x] Why the existing joined-nurse RPC can see the new committed baseline but
    still returns only that nurse's effective beds; human chose the scoped view
    instead of the full board and optimizer metadata.
  - [x] Why `optimizer_runs`, patient details, service credentials, solver
    internals, and the full board stay outside joined/mobile responses.
- Verification:
  - [x] Human restated the verifier, prepare, solver, and finalization flow.
  - [x] Gaps around server-authoritative input, abandoned-run recovery, atomic
    finalization, and success-only downstream signals were explained.
  - [x] Code/document-specific checkpoint completed, including inherited client
    initialization, prepare/run statuses, revision checks, recovery leases,
    source-of-truth writes, and lock ordering.
  - [x] Human identified that the dependency-install layer supplies the pinned
    Python packages; the Docker cache benefit and Uvicorn factory gap were
    explained afterward.
  - [x] Hidden inherited RPC-client setup was replaced with explicit forwarding
    constructors for the prepare and finalize clients; 48/48 Python tests still
    pass after the readability-only change.
  - [x] Human explained that each explicit child constructor forwards its
    connection settings to `_SupabaseRpcClient` through `super()`.
  - [x] Human confirmed that a normal publishable-key/user-token request must be
    denied access to service-only optimizer finalization.
  - [x] Human distinguished the optional saved `outcome_code` (`None` for a new
    run) from the endpoint's later numeric HTTP status.
  - [x] Human distinguished prepare `status` from persisted `runStatus` and
    predicted `existing` plus `succeeded` for a completed identical retry.
  - [x] Human explained that phone-supplied state could be stale and correctly
    predicted saved-result reuse, immediate-running, and stale-precondition
    retry branches; the tampering risk and 90-second reclaim branch were then
    clarified.
  - [x] Human confirmed that an abandoned but still-current run is reclaimed as
    `prepared` after the 90-second lease.
  - [x] Python Phase 9 suite passed: 48/48, including HTTP, auth, retry,
    timeout, no-commit, SQL contract, and real solve-to-finalize tests.
  - [x] Phase 9 fixture suite passed: 14/14.
  - [x] Phase 9 output compatibility suite passed: 2/2.
  - [x] Phase 1-8 Node regression passed: 37/37; TypeScript and Expo lint pass.
  - [x] Disposable PostgreSQL execution passed for schema/grants, authorization,
    identical retry, expired-lease recovery, mutation conflict, initial save,
    rerun supersession, stale no-commit, corrupt-output rejection, and
    forced-error rollback.
  - [ ] Live Supabase RLS, Realtime, notification, and connected nurse-scope
    checks run in a disposable project.
- Status: verified - implementation, local verification, and the combined human
  understanding checkpoint are complete. Live Supabase RLS, Realtime,
  notification, and connected nurse-scope checks remain an explicit
  pre-production gate rather than a completed verification claim.

### 2026-08-23 - Connect Initial Mobile Assignment to the Phase 9 Optimizer

- Task: Implement Phase 9 Tasks 3.1 and 3.2 by adding the authenticated mobile
  optimizer contract and replacing only the first-run local generator path.
- Problem understanding:
  - [x] Why the phone must request an assignment instead of sending a
    client-generated `assignmentResult` for the server to trust.
  - [x] Why shift revision, optional prior baseline ID, and mutation ID solve
    different stale/concurrency/retry problems.
  - [x] Why the existing rerun path remains temporarily unchanged until Task
    3.3 instead of changing override behavior early.
- Solution understanding:
  - [x] How `requestAssignmentOptimization` obtains the current access token
    and validates the six app-facing outcomes.
  - [x] What the four mobile action fields identify and how the shift revision
    differs from the optional prior-baseline precondition.
  - [x] How `runAssignmentOptimizer` reloads Supabase after `saved` or `stale`
    and verifies a saved result ID before the screen may navigate.
  - [x] How `optimizerRequestInFlightRef` blocks rapid duplicate presses while
    `retryMutationIdRef` preserves one idempotency key after an unavailable or
    ambiguous response.
  - [x] Why malformed, invalid, stale, timed-out, unavailable, and failed paths
    stay on Assignment Review without creating a local baseline.
- Broader context:
  - [x] Why existing floor-board, flags, realtime, and joined-nurse readers need
    no second assignment model after the backend commit is refreshed.
  - [x] How Task 3.3 can reuse the same repository action with the current
    baseline ID, while Task 3.4 later removes the final rerun generator call.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [x] Code-specific quiz and walkthrough completed for `primaryBusy`, the two
    request refs, refresh/result-ID matching, request preconditions, protected
    finalization, safe failures, and downstream `AssignmentResult` reuse.
  - [x] Human explained that `primaryBusy` communicates ongoing work while the
    separate disabled state prevents another press.
  - [x] Human identified that the refreshed board could be outdated and worked
    through result-ID mismatch cases, UUID creation, and the difference between
    optimizer run IDs and committed assignment result IDs.
  - [x] Optimizer repository contract suite passed: 9/9.
  - [x] Full Python optimizer suite passed: 48/48.
  - [x] Existing Node suite passed: 46/46, plus 2/2 cross-language output
    compatibility checks.
  - [x] TypeScript, Expo lint, web production export, and diff checks passed.
  - [ ] Live authenticated initial assignment and screen-reader/dynamic-type
    checks run against a configured optimizer service.
- Status: verified - automated implementation checks and the human
  understanding checkpoint pass. The configured-service manual pass remains an
  explicit pre-production gate.

### 2026-08-24 - Connect Optimizer Reruns and Retire Mobile Generation

- Task: Implement Phase 9 Tasks 3.3 and 3.4 by routing reruns through the
  authenticated optimizer, preserving moves until successful finalization, and
  removing the client-generated assignment runtime path.
- Problem understanding:
  - [x] Why the old rerun path was unsafe even though its Supabase RPC checked
    the prior baseline ID.
  - [x] Why reruns need both the current shift revision and expected prior
    assignment-result ID.
  - [x] Why failure, stale, timeout, and unavailable outcomes must preserve the
    committed baseline and active manual moves.
- Solution understanding:
  - [x] How `runBackendAssignment` uses the same optimizer action for initial
    runs and reruns, adding the current result ID only for a rerun.
  - [x] Why active overrides are cleared only inside successful protected
    finalization instead of when the confirmation button is pressed.
  - [x] How `AssignmentMoveDialog` keeps the baseline ID from when it opened so
    a dialog made stale by a rerun cannot silently save against the new result.
  - [x] Why the mobile generator, legacy context action, repository RPC, and
    authenticated database grant were all retired together.
- Broader context:
  - [x] Why effective-assignment, flag preview, board display, and nurse-scoped
    readers remain mobile consumers of the committed result rather than
    assignment generators.
  - [x] Why removing the old path makes the Python optimizer the single trusted
    assignment-generation boundary without changing the `AssignmentResult`
    shape.
- Verification:
  - [x] Human restated the key ideas incrementally through the checkpoint.
  - [x] Gaps were explained.
  - [x] Code-specific quiz and walkthrough completed.
  - [x] Human identified that removing the screen call alone is insufficient
    because a modified client could still call the legacy RPC directly with an
    authenticated token; `REVOKE` leaves the function present but blocks those
    mobile roles.
  - [x] Human identified successful finalization as the only point where active
    moves may be cleared; every non-success outcome keeps the prior effective
    board intact.
  - [x] Human recognized an outdated expected baseline ID as evidence that
    another rerun already replaced the assignment; the stale request must make
    no additional baseline or override changes.
  - [x] Human distinguished the shift revision, which detects newer nurses,
    patients, acuity, or other shift inputs, from the baseline ID, which detects
    assignment replacement.
  - [x] Human recognized that the move dialog starts from the baseline present
    when it opens; preserving that ID lets a later rerun make the dialog stale
    instead of silently rebasing its old choice onto the new assignment.
  - [x] Human identified effective-assignment and flag-preview helpers as
    consumers of the committed baseline plus manual moves, not generators of a
    new baseline.
  - [x] Phase 9 mobile contract and runtime checks passed: 12/12.
  - [x] Effective-assignment and move-preview checks passed: 8/8.
  - [x] Full Python optimizer and SQL contract suite passed: 49/49.
  - [x] Phase 9 fixtures passed: 14/14; output compatibility passed: 2/2.
  - [x] Existing local ID, realtime, request lifecycle, responsive-layout, and
    Phase 8 performance regressions passed: 15/15.
  - [x] TypeScript, Expo lint, web production export, source search, and diff
    checks passed.
  - [ ] Configured-service rerun success/stale/failure, move-clearing, stale
    dialog, screen-reader, and dynamic-type checks run manually.
- Status: verified - implementation, automated verification, and the human
  understanding checkpoint are complete. The configured-service rerun and
  accessibility passes remain an explicit pre-production gate.

### 2026-08-24 - Validate Phase 9 Task 4.x

- Task: Add and run the feasible Phase 9 Tasks 4.1-4.5 validation work while
  preserving explicit Cloud Run, live Supabase, native-device, and learner
  gates that this workspace cannot honestly complete.
- Problem understanding:
  - [ ] Why a solver result marked `FEASIBLE` cannot be saved even when it looks
    clinically usable.
  - [ ] Why the provisional 200-room, 400-bed, 40-nurse ceiling had to be
    measured rather than accepted from the planning document.
  - [ ] Why automated mobile and SQL contract checks cannot replace live RLS,
    concurrency, notification, Realtime, and accessibility checks.
- Solution understanding:
  - [ ] How `add_deterministic_start_hint` gives CP-SAT a valid starting idea
    without adding a hard constraint or changing the exact objective order.
  - [ ] Why `normalize_shift_snapshot` supports 25 rooms through 50 occupied
    beds or 20 rooms through 80 occupied beds, while still rejecting more than
    80 beds, more than 12 nurses, and unmeasured larger shape combinations.
  - [ ] How `benchmark_maximum_floor.py` separates decision fingerprints from
    fresh output IDs and records timing, status, and memory evidence.
  - [ ] Which output properties, authorization paths, idempotency branches,
    stale checks, atomic write ordering, and privacy rules the new tests cover.
- Broader context:
  - [ ] Why lowering a measured support ceiling is safer than increasing the
    timeout or committing a merely feasible assignment.
  - [ ] How the backend optimizer remains the one baseline generator while the
    existing mobile board, nurse view, flags, and manual-override projection
    continue consuming the established `AssignmentResult`.
  - [ ] Which Cloud Run, live Supabase, authenticated native, and prior-phase
    manual checks remain before Phase 9 Task 4.x can be marked done.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Pinned Python 3.13 image completed 20/20 warm full and 20/20 warm
    understaffed attempts with deterministic fingerprints, zero failures, p95
    12.865/28.055 seconds, and peak RSS below 131 MB.
  - [x] Python checks passed: 75/75.
  - [x] Node Phase 1-9 regressions passed: 51/51.
  - [x] TypeScript, Expo lint, and web production export passed.
  - [ ] Five deployed cold starts with production-like Supabase latency passed.
  - [ ] Live Supabase RLS/concurrency/signals and authenticated native
    accessibility/manual matrices passed.
- Status: pending - implementation and feasible automated/container checks pass;
  human understanding and the external pre-production gates remain.

### 2026-08-25 - Preserve Optimizer Timeout Diagnostics

- Task: Retain the exact solver work completed before a timeout so later
  performance changes can target the measured bottleneck without exposing
  snapshot or canonical entity details to the mobile client or service logs.
- Problem understanding:
  - [ ] Why the failed stage name alone cannot show how the shared solve budget
    was divided among earlier stages and the failed stage.
  - [ ] Why `FEASIBLE` objective and bound evidence is useful for diagnosis but
    still cannot be committed as NurseFlow's exact result.
- Solution understanding:
  - [ ] How `SolveFailureDiagnostics` travels on `OptimizerTimedOutError` and
    preserves the completed immutable `ObjectiveStage` trace.
  - [ ] Why benchmark JSON keeps exact synthetic stage names while service logs
    strip the room, bed, or nurse ID after the stage category.
  - [ ] Why the public 504 body and stored `timed_out` code remain unchanged.
- Broader context:
  - [ ] How elapsed time, remaining budget, failed-stage duration, branches,
    conflicts, objective value, and best bound guide the next performance work.
  - [ ] Why diagnostics improve measurement rather than solver speed directly.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Focused optimizer and service checks passed: 20/20.
  - [x] Complete Python optimizer service suite passed: 63/63.
  - [x] Real 0.01-second and 1-second timeout probes emitted structured failure
    diagnostics, including five completed stages before the one-second failure.
  - [x] Doubled concurrency-one diagnostics identified the full-case team
    patient/acuity gaps and understaffed maximum nurse acuity proof as the
    immediate large-input bottlenecks.
- Status: pending - implementation and focused checks pass; human understanding
  checkpoint remains.

### 2026-08-25 - Evaluate Generated Team-Label Symmetry

- Task: Test whether removing clinically equivalent team-label permutations
  improves the measured bottlenecks without changing NurseFlow's existing
  room-first canonical decisions or exact objectives.
- Problem understanding:
  - [ ] Why six interchangeable generated labels can represent up to 720
    renamed copies of the same team partition.
  - [ ] Why the first nurse-based rule was rejected when frozen fixtures showed
    that it changed the established room-first canonical output.
- Solution understanding:
  - [ ] How the experiment allowed Team B only after an earlier canonical room
    introduced Team A, continuing for later labels without forcing contiguous
    coverage or clinical membership.
  - [ ] Why identical fixture decisions and supported fingerprints are required
    before treating symmetry breaking as safe.
- Broader context:
  - [ ] Why improving doubled full-case team-gap proofs was insufficient when
    the critical understaffed maximum-acuity proof did not improve.
  - [ ] Why the same-runtime supported A/B justified reverting the experiment
    instead of keeping a theoretically attractive constraint.
  - [ ] Why the ceiling stays 25/50/12 and explicit acuity-proof strengthening
    is the next candidate.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Focused team, assignment, optimizer, and complex checks passed during
    the experiment: 22/22.
  - [x] Complete Python optimizer service suite passed during the experiment:
    65/65.
  - [x] Supported full and understaffed fingerprints remained unchanged.
  - [x] Doubled full and understaffed diagnostic probes recorded.
- Status: pending - the measured experiment was rejected and reverted; human
  understanding remains.

### 2026-08-25 - Strengthen Aggregate Acuity Propagation

- Task: State already-implied nurse, team, assigned, and unassigned acuity
  relationships directly so CP-SAT can prove tight maximum-acuity values with
  less indirect search.
- Problem understanding:
  - [ ] Why the doubled understaffed model found candidate 8 and bound 7 but
    could not prove whether maximum acuity 7 was achievable.
  - [ ] Why a mathematically redundant constraint can improve propagation
    without changing which assignments are valid.
- Solution understanding:
  - [ ] How assigned nurse acuity plus unassigned acuity equals total floor
    acuity, and all team acuity equals assigned nurse acuity.
  - [ ] How global nurse and per-team capacity inequalities connect those totals
    directly to `maximum_acuity_load`.
  - [ ] Why the helper is isolated so the benchmark can disable only these
    constraints for a same-runtime A/B.
- Broader context:
  - [ ] Why proving doubled maximum acuity 7 is a material stage improvement but
    does not make 50 rooms, 100 beds, and 24 nurses supported yet.
  - [ ] Why supported fingerprints, local timing, full regression, and a future
    pinned-container repeat are separate parts of the acceptance evidence.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Focused optimizer, complex-scenario, and output checks passed: 17/17.
  - [x] Complete Python optimizer service suite passed: 64/64.
  - [x] Supported full and understaffed fingerprints remained unchanged.
  - [x] Supported three-attempt understaffed A/B was deterministic and favored
    aggregate constraints at median/p95 22.074/22.637 versus 22.790/23.394.
  - [x] Doubled understaffed A/B advanced from a 48.976-second acuity timeout to
    a proven acuity optimum of 7 in 15.187 seconds and two later stages.
  - [ ] Refreshed pinned-container repeat benchmark passed.
- Status: pending - implementation and local evidence pass; human understanding
  and the refreshed pinned-container benchmark remain.

### 2026-08-25 - Strengthen Aggregate Patient-Count Propagation

- Task: State already-implied assigned, unassigned, nurse, and team patient
  totals directly so CP-SAT can prove tight maximum census with less indirect
  bed-owner search.
- Problem understanding:
  - [ ] Why 100 occupied beds with four unassigned and 24 nurses makes maximum
    patient count 4 a tight equality case: `24 * 4 = 96` assigned patients.
  - [ ] Why the 17.640-second patient-count proof was the next measurable stage
    after aggregate acuity moved the bottleneck downstream.
- Solution understanding:
  - [ ] How assigned nurse count plus unassigned count equals occupied-bed count,
    and all team patient counts equal assigned nurse count.
  - [ ] How global nurse and per-team capacity inequalities connect those totals
    directly to `maximum_nurse_patient_count`.
  - [ ] Why the A/B disabled only `_add_aggregate_patient_count_constraints`
    while keeping aggregate acuity active on both sides.
- Broader context:
  - [ ] Why completing four additional doubled objectives is progress without
    making the doubled input supported.
  - [ ] Why unchanged fingerprints and favorable supported timing matter before
    retaining a redundant performance constraint.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Focused optimizer, complex-scenario, and output checks passed: 18/18.
  - [x] Complete Python optimizer service suite passed: 65/65.
  - [x] Supported full and understaffed fingerprints remained unchanged.
  - [x] Supported three-attempt understaffed A/B was deterministic and favored
    patient propagation at median/p95 17.845/21.447 versus 21.579/21.724.
  - [x] Doubled patient-count proof improved from 17.640 to 5.495 seconds and
    four additional exact objectives completed before timeout.
  - [ ] Refreshed pinned-container repeat benchmark passed.
- Status: pending - implementation and local evidence pass; human understanding
  and the refreshed pinned-container benchmark remain.

### 2026-08-25 - Retest Team-Label Symmetry After Aggregate Propagation

- Task: Re-evaluate room-first generated-team value precedence after aggregate
  acuity and patient constraints moved the doubled bottleneck into team gaps.
- Problem understanding:
  - [ ] Why an optimization rejected under the old model can become useful after
    other constraints change the active bottleneck and search behavior.
  - [ ] Why the A/B had to keep both aggregate helpers active on both sides and
    vary only `_add_room_team_value_precedence`.
- Solution understanding:
  - [ ] How room-first value precedence removes renamed team copies without
    forcing contiguous coverage, nurse membership, or clinical assignments.
  - [ ] Why nurse-first precedence remains invalid for the frozen canonical
    contract even though room-first precedence now passes.
- Broader context:
  - [ ] Why reaching the same RN-gap stage 6.038 seconds earlier is meaningful
    progress but still does not support the doubled ceiling.
  - [ ] Why the expanded five-attempt supported A/B reversed the earlier reason
    for rejecting room-first symmetry.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Focused team, assignment, optimizer, and complex checks passed: 24/24.
  - [x] Complete Python optimizer service suite passed: 67/67.
  - [x] Supported full and understaffed fingerprints remained unchanged.
  - [x] Five-attempt supported A/B was deterministic with zero timeouts and
    favored symmetry at median/p95 17.158/17.407 versus 17.513/20.312.
  - [x] Doubled A/B reached the RN-gap stage 6.038 seconds earlier with symmetry.
  - [ ] Refreshed pinned-container repeat benchmark passed.
- Status: pending - implementation and local evidence pass; human understanding
  and the refreshed pinned-container benchmark remain.

### 2026-08-25 - Reuse Each Proven Stage as the Next Solver Hint

- Task: Replace the initial construction hint after every exact objective with
  the complete solution that CP-SAT just proved optimal.
- Problem understanding:
  - [ ] Why 42.531 seconds "reaching RN-gap" was cumulative rather than the
    cost of a single RN objective.
  - [ ] Why the original hint can become less useful after earlier objective
    values are frozen as equalities.
- Solution understanding:
  - [ ] How `_replace_hint_with_solution` clears the old hint and records every
    variable value from the last `OPTIMAL` solve.
  - [ ] Why that complete solution satisfies the newly frozen equality and is
    therefore a valid incumbent for the next stage.
  - [ ] Why the hint changes search guidance only and cannot weaken constraints,
    reorder priorities, or make a `FEASIBLE` result acceptable.
- Broader context:
  - [ ] Why materially faster supported runs justify retention even though the
    doubled request still fails the complete exact canonical sequence.
  - [ ] Why reaching canonical room tie-breaking is stronger progress than
    merely reaching RN-gap, but is not evidence for raising the ceiling.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Focused optimizer, team, assignment, and complex checks passed: 25/25.
  - [x] Complete Python optimizer service suite passed: 68/68.
  - [x] Supported full and understaffed fingerprints remained unchanged.
  - [x] Five-attempt supported A/B was deterministic with zero timeouts and
    favored rolling hints at median/p95 12.521/17.345 versus 16.998/18.236.
  - [x] Doubled enabled completed all primary objectives plus nine canonical
    room decisions; disabled timed out during `team_patient_count_gap`.
  - [ ] Refreshed pinned-container repeat benchmark passed.
- Status: pending - implementation and local evidence pass; human understanding
  and the refreshed pinned-container benchmark remain.

### 2026-08-25 - Chunk Canonical Room Tie-Breakers

- Task: Prove five canonical room ranks per solve with an exact mixed-radix
  expression instead of starting a separate exact solve for every room.
- Problem understanding:
  - [ ] Why rolling hints moved the doubled bottleneck from primary objectives
    into repeated canonical room solves.
  - [ ] Why fewer solves may help even when every room choice still has to be
    proven and frozen.
  - [ ] Why making a chunk smaller can simplify each proof but add enough
    repeated-solve overhead to make the whole sequence slower.
- Solution understanding:
  - [ ] How `_mixed_radix_expression` makes an earlier room rank outweigh every
    possible combination of later ranks in the same chunk.
  - [ ] Why each decoded room rank is fixed individually after the chunk is
    proven `OPTIMAL`.
  - [ ] Why this exact bounded encoding differs from guessing weights for
    clinical objectives.
- Broader context:
  - [ ] Why the large supported improvement justifies retention even though
    doubled stage-entry variance prevented farther overall progress.
  - [ ] Why canonical bed-owner chunking is a possible later experiment but was
    not included in this room-only A/B.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Focused optimizer, team, assignment, and complex checks passed: 28/28.
  - [x] Complete Python optimizer service suite passed: 71/71.
  - [x] Every fixture and both supported benchmark fingerprints remained
    unchanged.
  - [x] Five-attempt supported A/B was deterministic with zero timeouts and
    favored chunk size five at median/p95 7.926/8.791 versus 13.134/16.239.
  - [x] Doubled first-ten-room proof time improved from 20.377 to 17.002 seconds.
  - [x] Three-room tuning was rejected: supported median/p95 regressed to
    10.041/11.951 and the doubled probe proved nine rather than ten room ranks.
  - [ ] Refreshed pinned-container repeat benchmark passed.
- Status: pending - implementation and local evidence pass; human understanding
  and the refreshed pinned-container benchmark remain.

### 2026-08-25 - Add Direct Team Feasibility Cuts

- Task: State team census versus configured nurse capacity and assigned red
  census versus configured RN capacity directly in the CP-SAT model.
- Problem understanding:
  - [ ] Why the existing bed-owner model already implies both team limits but
    makes CP-SAT rediscover them through many ownership and membership choices.
  - [ ] Why the room-chunk bottleneck can benefit from rejecting an impossible
    team choice before individual bed owners are resolved.
- Solution understanding:
  - [ ] How `_add_team_feasibility_constraints` compares each team's assigned
    patient count with the summed max-load capacity of its nurses.
  - [ ] How the RN/red cut compares assigned red beds with the summed configured
    capacity of RNs on that team.
  - [ ] Why these redundant inequalities strengthen propagation without removing
    any assignment that satisfied the original hard constraints.
- Broader context:
  - [ ] Why proving 15 rather than 10 doubled room ranks is material progress but
    still does not justify raising the supported ceiling.
  - [ ] Why unchanged fingerprints and favorable supported timing are required
    before retaining a propagation-only optimization.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Focused optimizer, team, assignment, and complex checks passed: 30/30.
  - [x] Complete Python optimizer service suite passed: 73/73.
  - [x] Every fixture and both supported benchmark fingerprints remained
    unchanged.
  - [x] Five-attempt supported A/B favored the cuts at median/p95 7.823/7.873
    versus 8.296/8.529, with zero timeouts on both sides.
  - [x] Doubled cuts enabled proved 15 canonical room ranks versus 10 disabled.
  - [ ] Refreshed pinned-container repeat benchmark passed.
- Status: pending - implementation and local evidence pass; human understanding
  and the refreshed pinned-container benchmark remain.

### 2026-08-25 - Evaluate Two CP-SAT Search Workers

- Task: Screen two internal solver workers as a possible 2-vCPU latency
  optimization while retaining one request per service instance.
- Problem understanding:
  - [ ] Why dependent lexicographic stages cannot run concurrently even though
    CP-SAT can parallelize the search inside one stage.
  - [ ] Why two search workers need at least two available CPU cores and must not
    be confused with allowing two simultaneous HTTP solves on one instance.
- Solution understanding:
  - [ ] How `search_worker_count` changes only CP-SAT's internal worker count and
    keeps the production default at one.
  - [ ] Why every stage still requiring `OPTIMAL` and explicit canonical fixing
    preserved supported decision fingerprints during the experiment.
- Broader context:
  - [ ] Why faster canonical chunks did not justify two workers when earlier
    objectives, supported latency, and memory regressed.
  - [ ] Why a 2-vCPU deployment change is rejected when doubled completed
    progress does not advance beyond the one-worker model.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Focused optimizer, team, assignment, and complex checks passed: 32/32.
  - [x] Complete Python optimizer service suite passed: 75/75.
  - [x] Full and understaffed supported fingerprints remained unchanged.
  - [x] Two-worker supported median/p95 regressed to 11.851/13.133 seconds from
    7.823/7.873 with one worker, and peak memory increased.
  - [x] Both doubled variants proved 15 room ranks before the fourth chunk.
- Status: pending - the two-worker candidate is rejected and production stays
  at one worker; the human understanding checkpoint remains.

### 2026-08-25 - Replace Canonical Stages with One Exact Fixed Search

- Task: A/B test the highest-upside exact canonical optimization while
  preserving every clinical objective, canonical decision, and timeout detail.
- Problem understanding:
  - [ ] Why the dependent clinical and balance objectives must still be proved
    and frozen one at a time before canonical tie-breaking begins.
  - [ ] Why repeated room, bed-owner, and nurse-team optimization solves created
    substantial setup and presolve overhead at the supported maximum.
- Solution understanding:
  - [ ] How `use_fixed_canonical_search` orders room ranks, bed-owner ranks, then
    nurse-team ranks and tries the lowest value first in one complete search.
  - [ ] Why the final pass clears hints, covers every model variable, and turns
    off presolve so CP-SAT cannot bypass or rewrite the declared rank order.
  - [ ] Why `optimizer.py` still requires `OPTIMAL` and retains the same shared
    timeout diagnostics instead of returning a partial canonical candidate.
- Broader context:
  - [ ] Why exact fixture equality matters more than matching aggregate
    objective values when board assignments must remain deterministic.
  - [ ] Why a large supported understaffed gain does not justify doubling the
    input ceiling when the doubled fixed pass still times out.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Initial presolve-enabled candidate was rejected after changing five
    frozen canonical fixture decisions.
  - [x] Corrected candidate matched every fixture and four varied synthetic
    scenarios exactly.
  - [x] Complete Python optimizer service suite passed: 78/78.
  - [x] Supported understaffed candidate improved median/p95 from
    10.140/12.461 seconds to 5.940/6.758 with the same fingerprint.
  - [x] Supported full candidate improved from 8.009 to 7.538 seconds with the
    same fingerprint.
  - [x] Doubled candidate completed all primary objectives but timed out in
    `canonical_fixed_search`; the 25/50/12 ceiling remains unchanged.
- Status: pending - the optimization and local A/B pass; refreshed pinned
  container evidence and the human understanding checkpoint remain.

### 2026-08-25 - Split Exact Canonical Search and Screen a 90-Second Budget

- Task: Reduce the fixed canonical search tree without losing exactness, and
  test whether a 90-second shared budget makes the doubled shape supportable.
- Problem understanding:
  - [ ] Why the single fixed pass forced room search to carry every later
    bed-owner and nurse-membership rank through the same search tree.
  - [ ] Why increasing only the solver budget beyond the service and host
    deadlines would not actually give the solver more usable request time.
- Solution understanding:
  - [ ] How `split_fixed_canonical_search` solves and freezes room ranks, then
    bed-owner ranks, then nurse-team ranks while preserving their exact order.
  - [ ] Why each pass still clears hints, disables presolve, covers all model
    variables, and requires `OPTIMAL` before its tuple can be frozen.
  - [ ] How timeout diagnostics now identify the incomplete canonical pass and
    retain every previously completed objective or canonical group.
- Broader context:
  - [ ] Why the supported performance gain justifies retaining split search but
    the failed doubled 90-second run does not justify raising the ceiling.
  - [ ] Why raising the production solver budget requires coordinated changes
    to the internal request deadline, Cloud Run timeout, and retry lease.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Split search matched staged and single fixed decisions on every frozen
    fixture and four varied synthetic scenarios.
  - [x] Forced split timeout retained 11 primary stages and named the room pass.
  - [x] Understaffed split median/p95 improved from 7.320/11.534 seconds to
    3.352/3.399 with the same fingerprint.
  - [x] Full split median/p95 improved from 8.081/8.513 seconds to 5.563/6.618
    with the same fingerprint.
  - [x] Doubled 90-second run completed rooms but timed out in bed owners.
  - [x] Complete Python optimizer service suite passed: 79/79.
- Status: pending - implementation and regression pass; the human understanding
  checkpoint remains.

### 2026-08-25 - Reset Joined Access Before Editing an Assigned Shift

- Task: Warn before reopening active-shift setup, invalidate the old assignment
  boundary, disconnect joined nurses, and restrict join codes to nurses with
  assigned patients.
- Problem understanding:
  - [x] Why editing patient, nurse, or load data makes the existing assignment
    and joined-nurse view stale.
  - [x] Why assignment reset, invite expiration, access removal, and override
    supersession must succeed together.
  - [x] Why invite eligibility must use occupied beds from the effective
    assignment rather than the generated baseline alone.
- Solution understanding:
  - [x] How `AssignedShiftEditGuard` blocks editing until the user confirms.
  - [x] How `reset_active_shift_for_editing` locks and checks the current
    baseline before applying all reset changes in one transaction.
  - [x] How `getNurseAssignedPatientCount` drives both the invite UI and the
    repository guard.
- Broader context:
  - [x] Why disconnected nurses must join again only after a new assignment is
    ready.
  - [x] Why keeping no-patient nurses visible with a disabled action is clearer
    than silently removing them from the invite list.
- Verification:
  - [x] Human restated understanding first: explained that one failed reset
    operation rolls back the other reset changes.
  - [x] Routing gap explained and corrected: a successful reset reveals the
    requested setup screen instead of navigating directly to assignment review.
  - [x] Code-specific quiz completed: correctly used the effective assignment
    to enable a nurse whose patient arrived through a manual override.
  - [x] TypeScript, lint, nine focused regressions, and Expo web export passed.
  - [ ] Supabase function installed and two-session manual validation passed.
- Status: verified - the human explained transaction rollback and effective
  assignment eligibility, then correctly identified Patients and acuity as the
  post-reset screen. Server install and live two-session validation remain as
  operational checks.

### 2026-08-26 - Evaluate Exact Bed-Owner Blocks

- Task: Test whether smaller exact blocks reduce the doubled bed-owner search
  bottleneck without hurting the supported production shape.
- Problem understanding:
  - [ ] Why one 100-owner fixed pass might appear harder than several smaller
    prefix passes, but each extra pass also repeats solver setup and search.
  - [ ] Why the then-supported 25/50/12 contract was the production acceptance
    gate, not progress on an unsupported doubled input alone.
- Solution understanding:
  - [ ] How `fixed_bed_owner_block_size` freezes each canonical owner prefix
    before solving the next block.
  - [ ] Why frozen blocks preserve exact lexicographic decisions even though
    timing can be worse.
- Broader context:
  - [ ] Why the experiment is rejected when both screened sizes regress
    supported latency and fail to finish their first doubled owner block.
  - [ ] Why the benchmark switch may remain for reproducibility while the
    production default stays unblocked.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Blocked search matched every fixture and four varied synthetic cases.
  - [x] Ten-bed supported median/p95 regressed to 4.888/7.984 seconds.
  - [x] Twenty-five-bed supported median/p95 regressed to 4.376/4.564 seconds.
  - [x] Neither doubled 90-second probe completed its first owner block.
  - [x] Complete Python optimizer service suite passed: 80/80.
- Status: pending - experiment and regression complete; the candidate is
  rejected and the human understanding checkpoint remains.

### 2026-08-28 - Support the Required 20-Room/80-Bed Floor Exactly

- Task: Raise the measured optimizer envelope to 20 rooms, 80 occupied beds,
  and 12 nurses without weakening objectives or canonical accuracy.
- Problem understanding:
  - [ ] Why increasing the original split fixed solver to 120 seconds still
    timed out in `canonical_fixed_room_search` after primary objectives finished.
  - [ ] Why a 20/80 run with nurse maximum five tests capacity pressure but is
    not the fully assignable worst case: 12 nurses can own only 60 beds.
  - [ ] Why raising the maximum to seven moved the bottleneck first to the exact
    red-owner objective and then, after that was improved, to canonical owners.
  - [ ] Why the service should not claim the untested cross-product of 25 rooms
    and 80 occupied beds when only 25/50 and 20/80 were measured.
- Solution understanding:
  - [ ] How `_resolve_mixed_radix_room_search` keeps the fixed room pass through
    50 occupied beds and selects exact five-room mixed-radix chunks above 50.
  - [ ] Why a mixed-radix chunk preserves room-by-room lexicographic order, and
    why fixing each decoded rank preserves that prefix for the next chunk.
  - [ ] How `_build_structural_red_rank_lower_bound_model` proves a safe rank
    floor from room/nurse teams and per-nurse acuity counts, and why the full
    model must still produce a concrete feasibility witness at that value.
  - [ ] Why fully assigned large floors use exact six-bed mixed-radix owner
    chunks while capacity-pressure floors keep the fixed owner pass.
  - [ ] Why owner chunk sizes 3, 4, 5, 7, and 8 were rejected after the
    one-at-a-time timing comparison retained size 6.
  - [ ] Why every optimization and canonical chunk still requires `OPTIMAL`.
  - [ ] How 120/135/140/150-second solver, service, host, and retry limits leave
    ordered headroom instead of allowing an ambiguous host-side cutoff.
- Broader context:
  - [ ] Why chunk sizes four and seven, two workers, and fixed-gap bounds were
    rejected after regressions, while size six was rejected because its full
    gain came with an understaffed regression.
  - [ ] Why deterministic fingerprints and output validation protect accuracy
    while performance candidates are compared.
  - [ ] Why losing experimental branches were removed after their A/B evidence
    was recorded, leaving only measured production paths and explicit controls.
  - [ ] Why a refreshed pinned-container and Cloud Run cold-start benchmark is
    still required even though all local 20/80 attempts finished far below the
    120-second solver allowance.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific quiz or walkthrough completed.
  - [x] Focused normalization, optimizer, service, and SQL checks passed: 56/56.
  - [x] Five capacity-pressure 20/80 attempts per variant were optimal and
    deterministic at 22.039/53.586 seconds median/p95 for capacity 60 and
    10.445/10.770 seconds for capacity 48.
  - [x] Five fully assignable production-default 20/80 attempts were optimal,
    assigned all 80 beds, used one fingerprint, and had 18.402/20.658 seconds
    median/p95 with peak RSS 128,593,920 bytes.
  - [x] Default-path 25/50 regression retained fixed room search and completed
    full/understaffed in 4.754/3.964 seconds with matching fingerprints.
  - [x] Final complete Python optimizer service suite passed: 88/88, including
    the fully assignable 20/80 regression.
  - [ ] Refreshed pinned-container and deployed Cloud Run gates passed.
- Status: pending - implementation, local A/B evidence, and final regression
  pass; production-like runtime gates and the human understanding checkpoint
  remain.

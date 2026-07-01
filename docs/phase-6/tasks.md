# Phase 6 Implementation Tasks

This task list plans realtime collaboration and nurse invite codes in small, testable steps.

Phase 6 adds live active shift updates, nurse invite codes, code-based join handling, and real joined nurse participation. Do not add push notifications, offline write queues, conflict resolution systems, drag-and-drop assignment override, board snapshot sharing, tablet layout, AI, organization admin, or hospital admin features.

Each task should be small enough for one focused Codex session. Each task includes a manual validation check that should be tested before moving on.

Status legend:

- Done
- No marker means not done yet.

## Build Order Summary

1. Confirm Phase 6 scope guardrails.
2. Add realtime connection state and subscription boundary.
3. Subscribe charge nurse active shift screens to live updates.
4. Add nurse invite server model and authorization planning.
5. Generate and display per-nurse invite codes.
6. Add copy, share, regenerate, and revoke behavior.
7. Add nurse code entry and validation.
8. Link signed-in users to nurse access from valid codes.
9. Subscribe joined nurse screens to live nurse-scoped assignment updates.
10. Make issue and swap request updates live in-app.
11. Expire invites when a shift ends.
12. Run a full manual Phase 6 test pass.

## Setup Tasks

### Done Task 0.1: Create Phase 6 Planning Docs

Story coverage: US1, US2, US3, US4, US5, US6, US7

Build:

- Add Phase 6 planning docs for user stories, data model, mobile design, screens, and implementation tasks.
- Confirm Phase 6 is realtime collaboration and nurse invites based on `docs/phases.md`.
- Preserve Phase 1 assignment behavior, Phase 2 carry-over behavior through server snapshots, Phase 3 request behavior, Phase 4 break scheduling, and Phase 5 auth/server persistence.
- Keep push notifications, offline write queues, conflict resolution, drag-and-drop, board sharing, tablet layout, and AI out of Phase 6.

Validation check:

- You can point to `docs/phases.md` and `docs/phase-6/` and explain what Phase 6 includes and excludes before writing feature code.
- No app implementation code is written in this task.

### Done Task 0.2: Confirm Existing App Touchpoints

Story coverage: US1, US2, US3, US4, US5, US7

Build:

- Review current routes, screens, services, server workspace context, joined nurse access flow, request flow, and active shift save flow.
- Identify where realtime connection state should live.
- Identify where invite repository/service functions should live.
- Identify which existing Phase 5 joined nurse shell can become the real invite join path.
- Document any compatibility risks before changing runtime code.

Validation check:

- You can list the likely files affected by Phase 6 before coding starts.
- Existing Phase 1-5 behavior is not changed in this task.

## Realtime Foundation

### Done Task 1.1: Add Realtime Connection State Types

Story coverage: US1, US4, US7

Build:

- Add simple connection state values for connecting, live, reconnecting, disconnected, and error.
- Keep connection state separate from saved active shift data.
- Keep this as foreground app state, not database state.
- Use named component prop types when implementation reaches UI components.
- Do not add offline queue or conflict state.

Validation check:

- TypeScript compiles.
- Existing auth, server workspace, active shift, assignment, request, and break types still compile.

### Done Task 1.2: Add Charge Active Shift Realtime Subscription Boundary

Story coverage: US1, US7

Build:

- Start a realtime listener when a signed-in charge nurse has an active shift.
- Stop the listener when the user signs out, the shift ends, or the active shift is cleared.
- Refetch the active shift after receiving a relevant server change signal.
- Show connection state in logs or temporary debug output before adding polished UI.
- Keep existing request-then-refresh writes intact.

Validation check:

- Open an active shift and confirm the listener starts.
- Sign out and confirm the listener stops.
- Update the active shift from another session or backend tool and confirm the app refreshes the active shift.

### Done Task 1.3: Add Live Status UI to Charge Screens

Story coverage: US1, US7

Build:

- Add a compact live status chip to the charge nurse workspace and floor board.
- Show connecting, live, reconnecting, disconnected, and error states.
- Add a retry or refresh action for recoverable errors.
- Keep the copy calm and clear.

Validation check:

- Live status appears on the active shift screen.
- Disconnecting network or forcing a channel error shows a disconnected/error state.
- The UI does not mention offline queue or push notifications.

## Nurse Invites

### Done Task 2.1: Add Shift Nurse Invite Server Model

Story coverage: US2, US6

Build:

- Add a server invite record tied to one active shift and one nurse.
- Store invite status, expiration, creator, and safe token validation data.
- Ensure one nurse has at most one active invite per active shift.
- Add authorization rules so only the owning charge nurse can manage invites for their shift.
- Do not store raw invite codes as normal persisted app data.
- Added `docs/phase-6/supabase-invite-setup.md` with the `shift_nurse_invites` table, RLS policies, and one-active-invite partial unique index.
- Added `ShiftNurseInviteRecord` and `shiftInviteRepository` as the small app-side boundary for creating and loading invite records.

Validation check:

- Charge nurse can create an invite record for a nurse in their own active shift.
- Charge nurse cannot create an invite for another user's shift.
- Joined nurse users cannot list or manage invite records.
- TypeScript and lint pass.

### Done Task 2.2: Generate Per-Nurse Invite Code

Story coverage: US2

Build:

- Add a focused action to generate an invite code for a nurse in the active shift.
- Return the code to the app only after the server creates the invite record.
- Show a readable error if no active shift or target nurse exists.
- Keep generated codes valid only for active shifts.
- Added secure per-nurse code generation and hashed code storage in `shiftInviteRepository`.
- Kept raw invite codes in screen memory only; they are not persisted as normal app data.

Validation check:

- Generate a code for one active-shift nurse.
- Confirm the code is tied to the intended shift and nurse.
- Confirm generation fails safely after the shift ends.

### Done Task 2.3: Add Nurse Invites Screen

Story coverage: US2, US6

Build:

- Add a Nurse Invites screen reachable from the Floor Board.
- List active shift nurses with joined status and invite status.
- Add generate, copy, share, and regenerate actions.
- Show empty states for no active shift and no nurses.
- Show invite expiration language.
- Added `/nurse-invites`, reachable from the Floor Board bottom sub-nav.
- Added copy through `expo-clipboard` and share through the native device share sheet.

Validation check:

- Active shift with nurses shows one row per nurse.
- A generated invite code can be copied.
- A generated invite code can be shared through the device share sheet.
- Empty and error states are readable.

### Done Task 2.4: Regenerate and Revoke Invite Codes

Story coverage: US6

Build:

- Add regenerate behavior for one nurse's invite code.
- Revoke the old active invite when a new one is generated.
- Confirm regeneration before invalidating the old code.
- Keep already linked nurse access unless a later explicit access-removal task is added.
- Added confirmation before regeneration.
- Regeneration revokes any active invite for that shift nurse, then creates a fresh active invite and code.

Validation check:

- Regenerate a code and confirm the newest code is active.
- Confirm the previous code fails safely.
- Confirm a joined nurse does not lose access simply because the code was regenerated.

## Nurse Code Join Flow

### Done Task 3.1: Add Nurse Code Entry Handling

Story coverage: US3

Build:

- Enable the existing Join Active Session screen for 6-character nurse code entry.
- Store the typed nurse code in screen state.
- Show an invalid format state for missing, short, or malformed codes.
- If signed out, preserve enough pending code context to continue after sign-in.
- Do not show patient data before validation and join.
- Enabled `/join-active-session` for 6-character nurse code entry.
- Added local format validation for missing, short, and malformed codes.
- Preserved the pending code through login/signup return params.

Validation check:

- Typing a 6-character nurse code enables the next step.
- Missing, short, or malformed codes show a safe invalid state.
- Entering a nurse code while signed out asks the user to sign in or create an account.

### Done Task 3.2: Validate Nurse Code and Show Join Confirmation

Story coverage: US3

Build:

- Validate the nurse code with the server before allowing join.
- Show a small confirmation with nurse name and floor name after validation.
- Block join for expired, revoked, already-used, ended-shift, stale-nurse, or participation-conflict states.
- Keep error messages plain.
- Added `validateShiftNurseInviteCode` as the app-side server validation boundary.
- Added `validate_shift_nurse_invite_code` setup notes for safe server validation.
- Show a confirmation with nurse name and floor name only; linking remains Task 3.3.

Validation check:

- Valid nurse code shows join confirmation.
- Expired nurse code shows expired state.
- Revoked old code shows revoked or invalid state.
- User already in another active shift sees a clear participation conflict state.

### Done Task 3.3: Link Signed-In User to Shift Nurse Access

Story coverage: US3, US4

Build:

- Accept a valid nurse code and create or update the shift nurse access record for the signed-in profile.
- Mark the invite used when appropriate.
- Navigate to the joined nurse live assignment after successful join.
- Keep access scoped to one nurse in one active shift.
- Added `acceptShiftNurseInviteCode` as the app-side server boundary for consuming a valid nurse code.
- Added `accept_shift_nurse_invite_code` setup notes so access linking and invite consumption happen together on the server.
- Updated the join screen to switch from validation to `Join shift`, refresh joined nurse access, and navigate to the existing nurse-scoped assignment workspace.
- Added a Home screen return path for already joined nurses so reopening the app can resume the joined nurse workspace.
- Changed the joined nurse workspace exit action to return Home without signing out.

Validation check:

- Signed-in user can join from a valid nurse code.
- Joined user sees only their own nurse assignment.
- Joined user cannot load the full charge nurse board.
- Reusing a consumed code behaves according to the documented invite rules.

## Joined Nurse Live View

### Task 4.1: Add Joined Nurse Realtime Subscription Boundary

Story coverage: US4, US7

Build:

- Start a nurse-scoped realtime listener when a signed-in user has linked nurse access.
- Refetch only the joined nurse assignment view after relevant server change signals.
- Stop the listener when the user signs out, access is removed, or the shift ends.
- Keep the subscription scoped so it cannot expose the full active shift.

Validation check:

- Joined nurse assignment updates when the charge nurse changes patient, acuity, assignment, request, or break data.
- Signing out stops the joined nurse listener.
- Server authorization still blocks full shift reads.

### Task 4.2: Add Live Status UI to Joined Nurse Assignment

Story coverage: US4

Build:

- Add a compact live status chip to the joined nurse assignment screen.
- Show disconnected or reconnecting states without promising offline edits.
- Show shift ended or access removed state when applicable.
- Keep assignment content readable on phone screens.

Validation check:

- Joined nurse sees live status.
- Connection loss is visible.
- Shift end moves the nurse to a safe ended state.

### Task 4.3: Replace Local Simulation Entry With Real Joined Nurse Path Where Appropriate

Story coverage: US3, US4, US7

Build:

- Make the real invite-based joined nurse path the main nurse-facing route.
- Remove simulated nurse entry points from the normal charge nurse product flow.
- Delete simulated nurse screens only if the real joined nurse path fully replaces their manual testing value.
- If any simulation screens remain for development testing, keep them clearly labeled as local simulation and outside the main user flow.
- Do not imply simulated screens provide real multi-device joined nurse access.

Validation check:

- Invited nurse uses the real joined nurse route.
- The normal charge nurse product flow no longer points users to simulated nurse screens.
- Any remaining simulated route is clearly labeled as local development/testing only and does not imply real multi-device access.
- Previous request and assignment display behavior still works.

## Live Requests

### Task 5.1: Make Nurse Issue Submission Live

Story coverage: US5

Build:

- Save issue flags from joined nurse devices to the server active shift/request source.
- Let charge nurse screens receive the update through realtime.
- Keep request records tied to the active shift and requesting nurse.
- Prevent blank or duplicate issue submits.

Validation check:

- Submit an issue from a joined nurse device.
- Confirm the charge nurse request view updates while open.
- Confirm invalid issue text does not create a request.

### Task 5.2: Make Nurse Swap Requests Live

Story coverage: US5

Build:

- Save swap requests from joined nurse devices to the server active shift/request source.
- Validate the source bed belongs to the joined nurse.
- Let charge nurse screens receive the update through realtime.
- Keep assignment changes out unless an existing accepted-swap workflow already changes status only.

Validation check:

- Submit a swap request from a joined nurse device.
- Confirm the charge nurse request view updates while open.
- Confirm a stale or unassigned source bed is rejected safely.

### Task 5.3: Make Request Resolution Live

Story coverage: US5

Build:

- Let the charge nurse accept or decline pending swap requests using the existing request resolution behavior.
- Save the resolution to the server.
- Let the requesting nurse see the status update live.
- Keep accepted or declined requests from showing duplicate active decision controls.

Validation check:

- Resolve a swap request from the charge nurse device.
- Confirm the joined nurse device sees accepted or declined status.
- Confirm resolved requests do not show active controls again.

## Shift End and Cleanup

### Task 6.1: Expire Invites When Shift Ends

Story coverage: US2, US3, US6, US7

Build:

- Expire or revoke active invite records when the charge nurse ends a shift.
- Stop active realtime listeners for that shift.
- Move connected joined nurses to a shift ended state.
- Preserve previous-shift snapshot behavior from Phase 5.

Validation check:

- End a shift with active invites.
- Confirm invite codes no longer allow joining.
- Confirm joined nurse screens show shift ended.
- Confirm carry-over suggestions still work for the next shift.

### Task 6.2: Cleanup Realtime Listeners on Sign Out and Navigation

Story coverage: US1, US4, US7

Build:

- Ensure charge nurse and joined nurse subscriptions stop on sign out.
- Ensure subscriptions do not duplicate after app navigation or Fast Refresh during development.
- Keep retry and refresh behavior understandable.

Validation check:

- Sign out from charge workspace and confirm no active shift listener remains.
- Sign out from joined nurse workspace and confirm no nurse listener remains.
- Navigate away and back without creating duplicate updates.

## Manual Testing Pass

### Task 7.1: Realtime Board Manual Test

Build:

- No new feature work.
- Validate live board updates across two foreground sessions.

Validation check:

- Change acuity, patients, assignments, breaks, and flags from one session.
- Confirm another connected session updates without manual refresh.

### Task 7.2: Invite Link Manual Test

Build:

- No new feature work.
- Validate invite generation, copy/share, regeneration, and expiration.

Validation check:

- Generate and use a nurse invite code.
- Regenerate the code and confirm the old one fails.
- End the shift and confirm all codes fail.

### Task 7.3: Joined Nurse Manual Test

Build:

- No new feature work.
- Validate real joined nurse access.

Validation check:

- Join as a nurse from a link.
- Confirm only the nurse-scoped assignment is visible.
- Confirm assignment, break, patient, acuity, request, and resolution updates appear live.

### Task 7.4: Authorization Manual Test

Build:

- No new feature work.
- Validate charge nurse ownership and joined nurse access boundaries.

Validation check:

- Charge Nurse A cannot manage invites for Charge Nurse B's shift.
- Joined nurse cannot read the full active shift.
- Signed-out user cannot join without authenticating.
- User already in another active shift sees a safe participation conflict state.

### Task 7.5: Scope Test

Build:

- No new feature work.
- Review implementation for Phase 6 scope leaks.

Validation check:

- There are no Phase 6 screens, dependencies, data fields, or service calls for push notifications, offline write queues, conflict resolution systems, drag-and-drop assignment override, board snapshot sharing, tablet layout, or AI.

### Task 7.6: Beginner Readability Pass

Build:

- Refactor only small confusing boundaries found during the manual pass.
- Update service or route documentation if it helps explain realtime and invite responsibilities.
- Keep code understandable before moving to Phase 7.

Validation check:

- A beginner can explain how a charge nurse creates an invite, how a nurse joins, how live updates reach screens, and why push/offline behavior is still deferred.

## Later, Not Phase 6

Save these for future phases:

- Push notifications.
- Background alerts.
- Offline read/write resilience beyond simple disconnected UI.
- Offline write queue and conflict handling.
- Drag-and-drop assignment override.
- Board snapshot sharing.
- Tablet layout.
- AI-assisted staffing or acuity suggestions.
- Hospital or organization admin tools.

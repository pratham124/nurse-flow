# Phase 7 Implementation Tasks

This task list plans push notifications and lightweight connection resilience in small, testable steps.

Phase 7 adds background push notifications, notification tap routing, cached read-only views during brief disconnects, and clear reconnect/disabled-action states. Do not add offline write queues, drag-and-drop assignment override, board snapshot sharing, tablet layout, request threads, global chat, AI, production assignment optimization, or advanced break scheduling optimization.

Each task should be small enough for one focused Codex session. Each task includes a manual validation check that should be tested before moving on.

Status legend:

- Done
- No marker means not done yet.

## Build Order Summary

1. Confirm Phase 7 scope guardrails.
2. Confirm notification and cached-view touchpoints.
3. Review current Expo notification guidance before implementation.
4. Add notification permission and device token state.
5. Register and disable device push tokens.
6. Add server notification event boundary.
7. Send request notifications to charge nurses.
8. Send assignment and break update notifications to affected joined nurses.
9. Send admission, discharge, imbalance, and unassigned-bed notifications where useful.
10. Add notification tap routing and recovery states.
11. Cache the latest charge board and joined nurse views.
12. Add disconnected-state UI and disabled-action helpers.
13. Run a full manual Phase 7 test pass.

## Setup Tasks

### Done Task 0.1: Create Phase 7 Planning Docs

Story coverage: US1, US2, US3, US4, US5, US6, US7

Build:

- Add Phase 7 planning docs for user stories, data model, mobile design, screens, and implementation tasks.
- Confirm Phase 7 is revised to focus on push notifications and lightweight connection resilience.
- Preserve Phase 1 assignment behavior, Phase 2 persistence/carry-over behavior, Phase 3 request behavior, Phase 4 break scheduling, Phase 5 auth/server persistence, and Phase 6 realtime/invite behavior.
- Keep offline write queues, drag-and-drop, board sharing, tablet layout, request threads, global chat, AI, production assignment optimization, and advanced break optimization out of Phase 7.

Validation check:

- You can point to `docs/phase-7/` and explain what Phase 7 includes and excludes before writing feature code.
- No app implementation code is written in this task.

### Done Task 0.2: Confirm Existing App Touchpoints

Story coverage: US1, US2, US3, US4, US5, US6, US7

Build:

- Review current routes, screens, services, server workspace context, realtime connection state, invite flow, request flow, active shift save flow, and local persistence helpers.
- Identify where notification permission state should live.
- Identify where push token registration service functions should live.
- Identify where cached charge and joined nurse views should be stored.
- Identify where disconnected states should disable server-required actions.
- Document compatibility risks before changing runtime code.

Validation check:

- You can list the likely files affected by Phase 7 before coding starts.
- Existing Phase 1-6 behavior is not changed in this task.

### Done Task 0.3: Review Current Notification Docs

Story coverage: US1, US2, US3, US4, US7

Build:

- Review current official Expo Notifications guidance before implementing permission or token code.
- Confirm the expected permission, token, platform, and development-build requirements.
- Document any required setup notes for iOS, Android, and Expo development builds.
- Keep the documentation beginner-readable.

Validation check:

- You can explain why notification setup may need device/build configuration.
- No notification code is written until the implementation requirements are clear.

## Push Notification Foundation

### Done Task 1.1: Add Notification Permission State

Story coverage: US1, US7

Build:

- Add simple permission state values for unknown, granted, denied, provisional, and unavailable if needed.
- Keep permission state separate from active shift data.
- Add a small UI place to show notification permission status.
- Do not block the app when permission is denied.

Validation check:

- Signed-in user can see notification status.
- Denied permission leaves the connected app usable.
- TypeScript and lint pass.

### Done Task 1.2: Add Device Push Token Registration Boundary

Story coverage: US1, US7

Build:

- Add a focused service/repository boundary for registering this device's push token with the server.
- Tie tokens to signed-in profiles.
- Store platform, permission status, token status, and last-seen metadata.
- Do not store patient data or active shift snapshots with the token.

Validation check:

- Granted permission can produce a token in a supported environment.
- Token registration failure shows a readable error.
- TypeScript and lint pass.

### Done Task 1.3: Disable Device Token on Sign Out

Story coverage: US1, US7

Build:

- Disable or disassociate the local device token when the user signs out.
- Avoid sending future notifications to a signed-out device for protected shift data.
- Keep sign-out behavior from previous phases intact.

Validation check:

- Sign out and confirm the app no longer treats the device token as active for that profile.
- Signing back in can refresh registration.
- TypeScript and lint pass.

### Done Task 1.4: Add Notification Settings UI

Story coverage: US1, US7

Build:

- Add a simple notification settings or status screen/card.
- Show permission status, registration status, and supported Phase 7 notification categories.
- Add retry registration when token sync fails.
- Use named component prop types when UI components are added.

Validation check:

- User can understand whether notifications are on, off, or blocked.
- Raw tokens are never displayed.
- TypeScript and lint pass.

## Notification Events

### Task 2.1: Add Server Notification Event Model

Story coverage: US2, US3, US4, US7

Build:

- Add a server-side notification event concept for important active shift events.
- Include recipient profile, optional nurse access, event type, route target, status, and safe title/body.
- Keep notification event records separate from active shift snapshots.
- Avoid unnecessary patient detail in payloads.
- Added shared notification event types and a server-only Supabase outbox
  model that records ineligible recipients as skipped.

Validation check:

- A notification event can represent a request, assignment update, break update, admission, discharge, imbalance, or unassigned-bed alert.
- The model can skip ended shifts and disabled recipients.

### Task 2.2: Notify Charge Nurses About Issue Flags

Story coverage: US2, US7

Build:

- Create a charge nurse notification event when a joined nurse submits an issue.
- Keep existing Phase 6 foreground realtime request updates intact.
- Route notification taps to request detail or requests list.

Validation check:

- Submit an issue from a joined nurse.
- Charge nurse receives or can route from the issue notification in a supported environment.
- If notifications are disabled, the request still appears in-app.
- TypeScript and lint pass.

### Task 2.3: Notify Charge Nurses About Swap Requests

Story coverage: US2, US7

Build:

- Create a charge nurse notification event when a joined nurse submits a swap request.
- Keep swap request status behavior unchanged.
- Route notification taps to request detail or requests list.

Validation check:

- Submit a swap request from a joined nurse.
- Charge nurse receives or can route from the swap notification in a supported environment.
- Opening an already-resolved request shows the current status.
- TypeScript and lint pass.

### Task 2.4: Notify Joined Nurses About Assignment Updates

Story coverage: US3, US7

Build:

- Detect which joined nurses are affected by assignment changes.
- Notify only affected nurses.
- Route notification taps to the joined nurse assignment screen.
- Do not expose full board details in the payload.

Validation check:

- Rerun assignment or update assignment data.
- Only affected joined nurses are targeted.
- A nurse without access does not receive the assignment notification.
- TypeScript and lint pass.

### Task 2.5: Notify Joined Nurses About Break Updates

Story coverage: US3, US7

Build:

- Notify joined nurses when their own break time changes.
- Keep the charge nurse break schedule screen behavior unchanged.
- Route notification taps to the joined nurse assignment break section or screen.

Validation check:

- Update a break schedule.
- The affected joined nurse is targeted.
- Other nurses are not targeted unless their break changed.
- TypeScript and lint pass.

### Task 2.6: Notify Charge Nurses About Floor Events and Safety Flags

Story coverage: US4, US7

Build:

- Create notification events for admissions, discharges, newly unassigned beds, and meaningful imbalance changes.
- Avoid repeated notifications for unchanged existing flags.
- Route taps to the floor board or flags screen.

Validation check:

- Admission event can target the charge nurse.
- Discharge event can target the charge nurse.
- New unassigned-bed or imbalance event can target the charge nurse.
- Repeated unchanged flags do not spam notifications.
- TypeScript and lint pass.

### Task 2.7: Add Notification Tap Routing and Recovery

Story coverage: US2, US3, US4, US7

Build:

- Handle notification taps by loading current server state before opening the target screen.
- Route to request detail, flags, floor board, or joined nurse assignment when access is valid.
- Show safe recovery for ended shifts, removed access, missing requests, signed-out users, or malformed payloads.

Validation check:

- Tap a request notification and land on the current request state.
- Tap an assignment notification after shift end and see a safe ended state.
- Signed-out notification tap asks for sign-in before protected data is shown.
- TypeScript and lint pass.

## Read-Only Connection Resilience

### Task 3.1: Add Connection and Cached-View Status UI State

Story coverage: US5, US6, US7

Build:

- Add simple online, reconnecting, offline, viewing-cached-copy, and refresh-failed status values.
- Keep these states separate from saved active shift data.
- Show the status on charge board and joined nurse assignment screens.
- Do not add pending-sync or queued-write states.

Validation check:

- Disconnect network and confirm the UI shows offline/reconnecting.
- Reconnect and confirm the UI refreshes.
- TypeScript and lint pass.

### Task 3.2: Cache the Latest Charge Floor Board View

Story coverage: US5, US7

Build:

- Save the latest successfully loaded charge board view for the signed-in charge nurse.
- Scope cached data to the profile and active shift.
- Show a cached/stale banner when offline.
- Clear or lock protected cache on sign out.
- Keep cached board data read-only.

Validation check:

- Load a floor board, turn off network, and confirm the last board remains visible.
- Sign out and confirm protected cached board data is not shown to the next user.
- TypeScript and lint pass.

### Task 3.3: Cache the Latest Joined Nurse Assignment View

Story coverage: US5, US7

Build:

- Save the latest successfully loaded joined nurse assignment view.
- Scope cached data to the signed-in profile, shift, and nurse access record.
- Show cached/stale copy when offline.
- Do not expose the full charge board through the nurse cache.
- Keep cached nurse data read-only.

Validation check:

- Load a joined nurse assignment, turn off network, and confirm the nurse-scoped view remains visible.
- Confirm another nurse's assignment is not visible.
- TypeScript and lint pass.

### Task 3.4: Disable Server-Required Actions While Disconnected

Story coverage: US6, US7

Build:

- Disable charge nurse write actions while disconnected.
- Disable joined nurse issue and swap request submission while disconnected.
- Disable invite generation/regeneration while disconnected.
- Show plain helper copy such as `Reconnect to save changes`.
- Do not create hidden queued local changes.

Validation check:

- Disconnect network and confirm charge write actions do not silently save.
- Disconnect network and confirm joined nurse request actions do not silently queue.
- Reconnect and confirm actions become available again after current server data loads.
- TypeScript and lint pass.

### Task 3.5: Refresh Server Data After Reconnect

Story coverage: US5, US6, US7

Build:

- Refresh the charge board after reconnecting.
- Refresh the joined nurse assignment after reconnecting.
- Keep stale labels until current server data is loaded.
- Show a readable refresh-failed state when reconnect refresh fails.

Validation check:

- Turn network off and on while viewing the board and confirm the board refreshes.
- Turn network off and on while viewing the joined nurse assignment and confirm the nurse view refreshes.
- Force a refresh failure and confirm the stale view remains readable.
- TypeScript and lint pass.

## Compatibility and Manual Testing Pass

### Task 4.1: Notification Manual Test

Build:

- No new feature work.
- Validate notification permission, token registration, request notifications, assignment/break notifications, floor-event notifications, and notification tap routing.

Validation check:

- Permission granted, denied, and retry states are tested.
- Issue, swap, assignment, break, admission, discharge, imbalance, and unassigned-bed notification paths are tested where supported by the environment.
- Notification taps land on current server data or safe recovery states.

### Task 4.2: Cached View Manual Test

Build:

- No new feature work.
- Validate cached charge board and joined nurse assignment behavior.

Validation check:

- Charge board remains visible offline with stale copy label.
- Joined nurse assignment remains nurse-scoped offline.
- Protected cached data is cleared or locked on sign out.
- Reconnect refreshes from server state.

### Task 4.3: Disconnected Actions Manual Test

Build:

- No new feature work.
- Validate disabled-action behavior while disconnected.

Validation check:

- Charge nurse write actions are disabled while disconnected.
- Joined nurse issue and swap submissions are disabled while disconnected.
- Invite generation/regeneration is disabled while disconnected.
- No hidden local writes or queued actions are created.

### Task 4.4: Previous Phase Regression Pass

Build:

- No new feature work.
- Confirm Phase 1-6 workflows still work after notification and cached-view changes.

Validation check:

- Floor setup, assignment, board flags, carry-over, break scheduling, auth, server persistence, realtime updates, invites, joins, and live requests still work.
- Notification failure does not break connected app behavior.
- Cached view failure does not break server reads.

### Task 4.5: Scope Test

Build:

- No new feature work.
- Review implementation for Phase 7 scope leaks.

Validation check:

- There are no Phase 7 screens, dependencies, data fields, or service calls for offline write queues, drag-and-drop assignment override, board snapshot sharing, tablet layout, request threads, global chat, AI, production assignment optimization, or advanced break scheduling optimization.

### Task 4.6: Beginner Readability Pass

Build:

- Refactor only small confusing boundaries found during the manual pass.
- Update service or route documentation if it helps explain notification, cached-view, or reconnect responsibilities.
- Keep code understandable before moving to the next phase.

Validation check:

- A beginner can explain why notifications are background awareness, why cached views are not server truth, and why writes require a connection in this phase.

## Later, Not Phase 7

Save these for future phases only if real hospital testing proves they are worth the complexity:

- Offline write queues.
- Queued write sync on reconnect.
- Drag-and-drop assignment override.
- Board snapshot sharing.
- Tablet layout.
- Request-thread conversations.
- Global chat.
- AI-assisted staffing or acuity suggestions.
- Production assignment optimizer.
- Advanced break scheduling optimizer.
- EHR or EMR integration.
- Multi-hospital admin tools.

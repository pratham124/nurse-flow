# Phase 7 App Touchpoints

Task: Phase 7 Task 0.2, Confirm Existing App Touchpoints

This note maps the existing app before Phase 7 runtime work starts. It is
documentation only and does not change Phase 1-6 behavior.

## Scope Reminder

Phase 7 adds push notifications and short, read-only cached views during a
temporary connection loss. It does not add offline write queues, drag and drop,
board sharing, tablet layouts, request threads, chat, AI, or a new assignment
optimizer. The server remains the source of truth.

## Route And Screen Touchpoints

Expo Router routes in `src/app/` stay thin and point to `src/screens/`.

- `src/app/_layout.tsx` nests auth, server workspace, workflow draft, and
  session gate providers. A future focused notification provider belongs here
  only if it is needed.
- `src/app/floor-board.tsx` and `src/screens/FloorBoardScreen.tsx` are the
  future charge-board cache/status touchpoint.
- `src/app/regular-nurse-workspace.tsx` and
  `src/screens/RegularNurseWorkspaceScreen.tsx` are the future nurse-scoped
  cache/status touchpoint.
- `src/app/flags.tsx`, `src/screens/FlagsScreen.tsx`,
  `src/app/request-detail.tsx`, and `src/screens/RequestDetailScreen.tsx` are
  likely notification-tap targets.
- `src/app/nurse-invites.tsx` and `src/screens/NurseInvitesScreen.tsx` contain
  server-required invite actions that a later disconnected state must disable.

## State Boundaries

`src/store/AuthSessionContext.tsx` owns session restoration, signed-in profile
state, and sign-out. Future device permission/token state should be meaningful
only for a signed-in profile and must be cleared or disabled on sign-out.

`src/store/ServerWorkspaceContext.tsx` owns server-backed workspace loading,
active-shift saves, joined-nurse assignment loading, requests, and Phase 6
realtime connection state. Future connection-display state should live here or
in a small adjacent provider; it must not be stored in the active-shift
snapshot because it is UI state, not clinical shift data.

`src/store/WorkflowDraftContext.tsx` is only for unsaved template draft input
and legacy simulation state. It is not the place for notifications, cache, or
connection state. Keeping it separate prevents an accidental offline-write
queue.

## Service Boundaries

- `src/services/serverWorkspaceRepository.ts` is the server persistence
  boundary. Screens do not call Supabase tables directly.
- `src/services/realtimeWorkspaceRepository.ts` owns charge and joined-nurse
  Phase 6 subscriptions.
- `src/services/shiftInviteRepository.ts` owns invite generation, validation,
  regeneration, and joining.
- `src/services/authRepository.ts` owns sign-in and local Supabase sign-out.
- `src/services/supabaseClient.ts` owns configured-client setup and secure
  session-storage checks.

A future focused push-token repository should register/disable device tokens
for a signed-in profile. It should not be placed in a screen or mixed into the
general workspace repository.

## Current Flows And Cache Write Points

- Charge realtime refreshes server state after an active-shift change signal.
- Joined-nurse realtime refreshes only the nurse-scoped assignment view.
- Joined nurse issue/swap requests go through `ServerWorkspaceContext` and then
  reload the nurse-scoped view.
- Charge `saveActiveShift` writes through `saveServerActiveShift` and reloads
  the workspace.

Phase 7 notifications must complement these flows: a notification prompts a
current server load, not a second save or sync path.

Future safe cache write points are successful `loadServerWorkspace` / active
shift refreshes for the charge board and `loadJoinedNurseAssignmentView` for
the joined nurse. Cache keys must include `profileId` and `shiftId`; nurse
caches must also include `accessId`. There is no existing protected cached-view
store. The current secure storage is for Supabase sessions, while workflow
drafts are memory-only.

## Disconnected Actions And Compatibility Risks

Later Phase 7 connection state must disable server-required charge writes,
joined-nurse issue/swap submissions, and invite generation/regeneration, with
copy such as `Reconnect to save changes`. It must not hide a later queued write.

Risks to preserve:

- Do not overwrite unsaved screen-local input on a reconnect refresh.
- Clean up subscriptions on sign-out, shift end, access removal, and Fast
  Refresh.
- Do not put permission, tokens, cached views, or connection state inside an
  active-shift snapshot.
- Do not register before sign-in; disable/disassociate the device token on sign
  out.
- Do not put patient details or full-board data in notification payloads.
- Do not let a joined nurse read a charge-board cache or a prior user's cache.
- Do not change Phase 6 realtime, invite, join, request, or save behavior.

## Likely Files Affected Later

- `src/app/_layout.tsx`
- `src/store/AuthSessionContext.tsx`
- `src/store/ServerWorkspaceContext.tsx`
- New focused push-token and protected cache helpers under `src/services/` or
  `src/helpers/`
- `src/services/serverWorkspaceRepository.ts`
- `src/services/realtimeWorkspaceRepository.ts`
- `src/services/authRepository.ts`
- `src/types/models.ts`
- `src/screens/HomeScreen.tsx`, `FloorBoardScreen.tsx`,
  `RegularNurseWorkspaceScreen.tsx`, `FlagsScreen.tsx`,
  `RequestDetailScreen.tsx`, and `NurseInvitesScreen.tsx`
- `app.json`, only when the later notification config plugin is introduced.

## Task 0.2 Guardrail

This task adds no package, app config, runtime state, schema, cache, realtime
behavior, disconnected UI, or write gating.

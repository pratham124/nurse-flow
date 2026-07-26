# Phase 7 Screens

This document describes the revised Phase 7 mobile screens for push notifications and lightweight connection resilience. It is planning and design only, not React Native implementation code.

Each screen should be simple enough to build and test independently. Existing Phase 1-6 screens should be updated only where notification setup, notification routing, cached read-only views, or reconnect states require it.

## Screen Map

| Screen | Main Stories |
| --- | --- |
| Charge Nurse Account Workspace | US1, US7 |
| Floor Board | US4, US5, US6, US7 |
| Joined Nurse Assignment | US3, US5, US6, US7 |
| Flags and Requests | US2, US4, US6, US7 |
| Notification Settings | US1, US7 |
| Notification Tap Recovery | US2, US3, US4, US7 |

## 1. Charge Nurse Account Workspace

### Purpose

Show the signed-in charge nurse's server-backed workspace, notification status, active shift entry, and connection health.

### Layout

- Account header with display name.
- Active shift card when one exists.
- Existing live status when connected.
- Notification permission/status card.
- Floor template list.
- Sign out action.

### Components

- Account header.
- Active shift card.
- Live status chip from Phase 6.
- Notification permission card.
- Notification status row.
- Floor template rows.
- Empty workspace state.

### User Actions

- Continue active shift.
- Open notification settings.
- Retry device notification registration.
- Create or edit floor templates through existing flows.
- Start a shift through existing flows.
- Sign out.

### Navigation Targets

- Existing floor template setup.
- Existing shift setup.
- Floor Board.
- Notification Settings.
- Login after sign out.

### Validation and Error States

- Notification permission denied.
- Push token registration failed.
- Server load failed.
- Signed-out user attempts to open workspace.

### Exclusions

- No organization-wide notification settings.
- No offline write queue.
- No request-thread inbox.
- No tablet-specific workspace layout.

## 2. Floor Board

### Purpose

Keep the charge nurse board useful while connected, background-notified, offline, or reconnecting.

### Layout

- Board header with floor name, census, live/offline status, and cache banner when needed.
- Existing doctor-side and nurse grouping.
- Existing nurse cards, room coverage, assigned beds, acuity, patient info, and flags.
- Entry points to Flags and Requests and Nurse Invites where already appropriate.

### Components

- Live status chip from Phase 6.
- Connection status chip.
- Cached view banner.
- Existing board sections.
- Existing flag chips.
- Disabled-action helper for server-required actions while disconnected.

### User Actions

- Review the live or cached board.
- Open Flags and Requests.
- Use existing connected edit and assignment actions already supported by previous phases.
- Retry or refresh after reconnect failure.

### Navigation Targets

- Flags and Requests.
- Nurse Invites.
- Existing setup or edit screens where already supported.
- Notification Tap Recovery when opened from a stale notification.

### Validation and Error States

- Active shift ended while board is open.
- Offline cached board is stale.
- Server refresh failed after reconnect.
- Notification tap opens a missing or already-resolved target.
- User attempts a server-required action while disconnected.

### Exclusions

- No offline write queue.
- No drag-and-drop reassignment.
- No board snapshot sharing.
- No tablet layout.
- No local production assignment optimizer.

## 3. Joined Nurse Assignment

### Purpose

Show a joined nurse their nurse-scoped assignment with notification routing and safe disconnected states.

### Layout

- Joined nurse header.
- Floor name and nurse name.
- Live/offline status.
- Cached view banner when needed.
- Assigned rooms and beds.
- Patient info and acuity.
- Issue and swap request actions.
- Request history.

### Components

- Nurse live header.
- Connection status chip.
- Cached view banner.
- Bed rows.
- Break summary row.
- Issue button.
- Swap request button.
- Request history rows.
- Disabled-action helper for disconnected request submission.
- Access removed or shift ended state.

### User Actions

- Review assignment.
- Submit issue flag while connected.
- Submit swap request while connected.
- Review request status.
- Refresh after reconnect.
- Sign out.

### Navigation Targets

- Issue request form.
- Swap request form.
- Request detail when useful.
- Login after sign out.
- Notification Tap Recovery when access is no longer valid.

### Validation and Error States

- No linked nurse access.
- Access removed.
- Shift ended.
- Realtime disconnected.
- Cached nurse view is stale.
- Server load failed.
- Assignment references stale bed or nurse data.
- User attempts request submission while disconnected.

### Exclusions

- No full board.
- No other nurses' assignment details.
- No offline request queue.
- No request threads.

## 4. Flags and Requests

### Purpose

Let the charge nurse review assignment flags, live nurse requests, and notification-routed request or flag events.

### Layout

- Existing flag and request filters.
- Live/offline status near the header.
- Assignment-generated flags section.
- Nurse requests section.
- Request rows with current server status.

### Components

- Live status chip.
- Connection status chip.
- Existing severity filters.
- Existing request type and status filters.
- Request rows.
- Request detail view.
- Accept and decline controls where already supported and connected.
- Disabled-action helper for disconnected resolution actions.

### User Actions

- Review requests.
- Filter requests.
- Open request detail.
- Accept or decline swap requests if already supported and connected.
- Refresh after notification tap or reconnect.

### Navigation Targets

- Request detail.
- Floor Board.
- Notification Tap Recovery when target is no longer available.

### Validation and Error States

- Notification opens a request that is already resolved.
- Request references a stale bed or nurse.
- Realtime reconnect requires a refresh.
- User attempts request resolution while disconnected.

### Exclusions

- No request threads.
- No global chat.
- No offline resolution queue.
- No drag-and-drop reassignment.
- No automated AI recommendation.

## 5. Notification Settings

### Purpose

Let a signed-in user understand and manage this device's push notification state.

### Layout

- Permission summary.
- Device registration summary.
- Short list of active notification categories.
- Primary action to request permission or retry registration.
- Helper text for denied permission.

### Components

- Notification permission card.
- Notification status row.
- Category summary rows.
- Retry action.
- Device settings helper action when supported.

### User Actions

- Request notification permission.
- Retry token registration.
- Learn which notification types Phase 7 supports.
- Return to workspace.

### Navigation Targets

- Charge Nurse Account Workspace.
- Joined Nurse Assignment when opened from nurse context.

### Validation and Error States

- Permission denied.
- Permission granted but token registration failed.
- Token registered but server refresh failed.
- Signed-out user tries to open settings.

### Exclusions

- No raw token display.
- No organization admin settings.
- No notification history inbox.

## 6. Notification Tap Recovery

### Purpose

Show a safe recovery state when a push notification target cannot be opened directly.

### Layout

- Short recovery title.
- Plain explanation.
- Primary action to refresh or return to workspace.
- Secondary sign-in action when needed.

### Components

- Recovery card.
- Refresh action.
- Return home action.
- Sign-in prompt.

### User Actions

- Refresh current server state.
- Return to workspace.
- Sign in if needed.
- Open current floor board or joined nurse assignment if access still exists.

### Validation and Error States

- User is signed out.
- Shift ended.
- Nurse access removed.
- Request already resolved or missing.
- Notification payload malformed.
- Server authorization denies access.

## Build Order Recommendation

1. Add Phase 7 planning and scope guardrails.
2. Confirm notification and cached-view touchpoints.
3. Add notification permission and token model.
4. Add notification registration UI.
5. Add server notification event boundary.
6. Add request notifications.
7. Add assignment and safety flag notifications.
8. Add notification tap routing and recovery states.
9. Add cached charge board and joined nurse views.
10. Add disconnected-state UI and disabled-action helpers.
11. Run a full Phase 7 manual test pass.

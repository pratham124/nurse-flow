# Phase 7 Mobile Design

This document defines the mobile-first design direction for the revised Phase 7 scope: push notifications and lightweight connection resilience.

Phase 7 should make NurseFlow feel safer when the app is backgrounded or temporarily disconnected. It should not add offline write sync, drag-and-drop, board snapshot sharing, tablet layouts, request threads, or AI.

## Design Goals

- Make notification permission feel useful and optional.
- Make background alerts route users back to current server data.
- Keep disconnected states calm and readable.
- Keep the most recent board or nurse assignment visible during brief disconnects.
- Make server-required actions clearly unavailable while disconnected.
- Preserve the existing phone-first NurseFlow visual system.
- Keep resilience behavior explainable: cached views are read-only saved copies.

## Visual Direction

Reuse the existing NurseFlow visual system:

- Compact cards.
- Sticky summaries.
- Status chips.
- Plain form rows.
- Bottom action bars where already used.
- Board-context tabs for board, flags, requests, breaks, and invites.
- Clear empty, offline, reconnecting, stale-copy, and refresh-failed states.

Phase 7 labels can include:

- `Notifications`
- `Notifications on`
- `Notifications off`
- `Permission needed`
- `Offline`
- `Viewing saved copy`
- `Reconnect to save changes`
- `Reconnecting`
- `Refresh failed`

Avoid later-phase labels:

- Do not use `Pending sync`.
- Do not use `Offline queue`.
- Do not use `Drag to assign`.
- Do not use `Manual override`.
- Do not use `Share board snapshot`.
- Do not use `Tablet layout`.
- Do not use `Request thread`.
- Do not use `AI suggestion`.

## Layout Rules

- Keep the phone layout single-column.
- Keep touch targets at least 44 px tall.
- Use native stack headers through Expo Router where possible.
- Use `contentInsetAdjustmentBehavior="automatic"` on root scroll views when implementation reaches scrollable screens.
- Put notification setup near account or active-shift context, not in a hidden admin area.
- Keep offline status chips close to the data they describe.
- Show cached-data banners above cached board or nurse assignment content.
- Disable server-required actions while disconnected with plain helper copy.
- Do not add tablet-specific layouts in Phase 7.

## New or Updated Components

These are design components, not implementation code.

### Notification Permission Card

Purpose:

Explain and request push notification permission.

Content:

- Short benefit statement.
- Current permission status.
- Primary action such as `Turn on notifications`.
- Secondary text explaining that the app still works without permission.

Rules:

- Ask only when signed in.
- Do not show patient details in permission copy.
- Do not repeatedly nag after denial.

### Notification Status Row

Purpose:

Show whether this device can receive background alerts.

Content:

- Permission state.
- Last registration or refresh time when helpful.
- Retry action for failed token registration.

Rules:

- Keep the row small.
- Separate device permission from server registration problems.
- Signing out should remove the row from protected workspace content.

### Connection Status Chip

Purpose:

Show connection and cache state for the current screen.

Content:

- `Online`
- `Offline`
- `Viewing saved copy`
- `Reconnecting`
- `Refresh failed`

Rules:

- Keep the chip calm and near the screen header.
- Do not imply cached data is current.
- Do not imply offline edits will sync later.
- Pair with a retry or refresh action only when useful.

### Cached View Banner

Purpose:

Tell the user that board or nurse assignment content is from the most recent saved copy.

Content:

- Last saved time.
- Simple stale warning.
- Refresh state when reconnecting.
- Copy such as `Reconnect to update this view`.

Rules:

- Keep cached content readable.
- Do not hide important floor data behind the banner.
- Do not allow edits from a cached-only view in Phase 7.

### Disabled Offline Action Helper

Purpose:

Explain why a write action is unavailable while disconnected.

Content:

- Short reason, such as `Reconnect to submit this request`.
- Optional retry/refresh action.

Rules:

- Keep the helper near the disabled action.
- Avoid technical networking language.
- Do not create a hidden queued action.

## Updated Navigation Model

Phase 7 can keep the existing Expo Router stack and add notification/recovery routes around the Phase 6 workspace:

1. Session Loading
2. Login
3. Signup
4. Charge Nurse Account Workspace
5. Existing Floor Template Setup and Shift Setup
6. Existing Floor Board with live and cached-view status
7. Nurse Invites
8. Joined Nurse Assignment with live and cached-view status
9. Flags and Requests
10. Notification Settings or Permission Card
11. Notification Tap Recovery

Notification taps should route into existing screens whenever possible. A separate recovery screen is useful only when the target shift, request, nurse access, or permission state is no longer valid.

## Updated Screens

### Charge Nurse Account Workspace

Purpose:

Show account status, active shift entry, notification status, and connection health.

Layout:

- Account header.
- Active shift card.
- Notification permission/status card.
- Floor template list.
- Sign out action.

Rules:

- Do not show notification setup before sign-in.
- Do not add hospital admin notification settings.
- Keep the workspace readable if notification registration fails.

### Floor Board

Purpose:

Keep the charge nurse board useful while online, offline, or reconnecting.

Updated behavior:

- Show live status from Phase 6 when connected.
- Show cached-view status when disconnected.
- Keep the most recent board visible when offline.
- Disable server-required edit, invite, assignment, and request-resolution actions while disconnected.

Rules:

- Do not add drag-and-drop reassignment.
- Do not add board snapshot sharing.
- Do not add tablet-specific board layout.
- Do not silently save offline edits.
- Do not silently rerun assignment locally while offline.

### Joined Nurse Assignment

Purpose:

Show the joined nurse's current assignment and safe disconnected states.

Updated behavior:

- Show live status when connected.
- Show cached assignment banner when offline.
- Disable issue and swap request submission while disconnected.
- Route notification taps to the current server-backed nurse assignment when possible.

Rules:

- Show only this nurse's assignment.
- Do not expose full board data in cached nurse views.
- Do not allow offline assignment or request actions.

### Flags and Requests

Purpose:

Let the charge nurse review requests, assignment flags, and notification-routed events.

Updated behavior:

- Opening a notification can route to a request detail or this list.
- The screen refreshes from server state after notification tap or reconnect.
- Disconnected state keeps the last loaded list readable when safe.

Rules:

- Do not add request threads.
- Do not add a global notification inbox.
- Do not change swap acceptance into assignment movement.
- Do not allow request resolution while disconnected.

### Notification Settings

Purpose:

Let the signed-in user understand and manage this device's notification state.

Layout:

- Permission status.
- Device registration status.
- Short list of Phase 7 notification types.
- Retry registration action.
- Link to device settings when permission is denied, if platform supports it.

Rules:

- Keep this device-scoped.
- Do not add organization-wide notification policy management.
- Do not show raw push tokens.

### Notification Tap Recovery

Purpose:

Provide a safe landing state when a notification target is no longer available.

Examples:

- Shift ended.
- Request already resolved.
- Nurse access removed.
- User signed out.
- Permission/token no longer active.

Rules:

- Fetch current server state before deciding the recovery copy.
- Route back to Home or the correct workspace after explanation.

## Manual Testing Checks

- Turn notifications on for a signed-in charge nurse and confirm status changes.
- Deny notification permission and confirm the app still works while connected.
- Submit an issue from a joined nurse and confirm the charge nurse can receive or route from a notification.
- Update a joined nurse assignment or break time and confirm only affected nurse notification routing is planned/testable.
- Background the app, open a notification, and confirm the target screen refreshes current server data.
- Turn off network while viewing the floor board and confirm the cached board stays visible with stale copy.
- Turn off network while viewing the joined nurse assignment and confirm the cached nurse view stays scoped.
- Confirm charge nurse write actions are disabled while disconnected with clear copy.
- Confirm joined nurse issue and swap submission are disabled while disconnected with clear copy.
- Reconnect and confirm the board or nurse assignment refreshes from server data.
- Confirm the UI does not mention offline queues, drag-and-drop, board snapshot sharing, tablet layout, request threads, or AI.

## Phase 7 Exclusions In UI

Do not design Phase 7 UI for:

- Offline write queues.
- Queued write sync.
- Drag-and-drop assignment override.
- Board snapshot sharing.
- Tablet-specific layout.
- Request-thread conversations.
- Global chat.
- AI suggestions.
- Production assignment optimizer controls.
- Advanced break scheduling optimizer controls.
- Hospital or organization admin management.

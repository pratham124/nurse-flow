# Phase 6 Mobile Design

This document defines the mobile-first design direction for Phase 6: realtime collaboration and nurse invite links.

Phase 6 should make NurseFlow feel live during an active shift without adding push notifications, offline queue language, drag-and-drop, board sharing, tablet layout, or AI.

## Design Goals

- Make live collaboration visible but calm.
- Help the charge nurse invite the right nurse to the right active shift.
- Keep joined nurses focused on only their own assignment.
- Make expired, revoked, missing, or wrong-account invite states understandable.
- Preserve the existing phone-first NurseFlow visual system.
- Keep realtime behavior explainable: server truth changes, connected screens update.

## Visual Direction

Reuse the existing NurseFlow visual system:

- Compact cards.
- Sticky summaries.
- Status chips.
- Plain form rows.
- Bottom action bars where already used.
- Board-context tabs for board, flags, requests, breaks, and invites.
- Clear empty and recovery states.

Phase 6 labels can include:

- `Live shift`
- `Live`
- `Connecting`
- `Reconnecting`
- `Disconnected`
- `Invite nurse`
- `Copy link`
- `Share link`
- `Regenerate link`
- `Joined`
- `Not joined`
- `Link expired`
- `Shift ended`

Avoid later-phase labels:

- Do not use `Push enabled`.
- Do not use `Notification permission`.
- Do not use `Offline queue`.
- Do not use `Sync conflict`.
- Do not use `Background alerts`.
- Do not use `Drag to assign`.
- Do not use `Share board snapshot`.
- Do not use tablet-specific layout copy.

## Layout Rules

- Keep the phone layout single-column.
- Keep touch targets at least 44 px tall.
- Use native stack headers through Expo Router where possible.
- Use `contentInsetAdjustmentBehavior="automatic"` on root scroll views when implementation reaches scrollable screens.
- Keep live status chips small and close to the active shift or nurse assignment they describe.
- Prefer in-place status updates over large blocking modals.
- Use confirmation before regenerating an invite link because old links stop working.
- Keep invite link actions near each nurse row, not buried in settings.
- Do not add tablet-specific layouts in Phase 6.

## New or Updated Components

These are design components, not implementation code.

### Live Status Chip

Purpose:

Show whether the current active shift or nurse assignment is receiving live updates.

Content:

- `Connecting`
- `Live`
- `Reconnecting`
- `Disconnected`
- Optional last refreshed time after reconnect.

Rules:

- Keep the chip secondary and calm.
- Do not promise offline changes while disconnected.
- Provide a retry or refresh action when useful.

### Invite Nurse Row

Purpose:

Let the charge nurse manage one nurse's invite link from the active shift.

Content:

- Nurse name.
- License and experience when available.
- Joined status.
- Invite status.
- `Copy link`, `Share link`, or `Regenerate link`.

Rules:

- Show one nurse per row.
- Regenerate should explain that the old link stops working.
- Avoid showing raw technical token values.

### Invite Link Result

Purpose:

Give the charge nurse immediate access to the generated link.

Content:

- Short success message.
- `Copy link`.
- `Share link`.
- Link expiration note.

Rules:

- Do not require the charge nurse to manually select a long URL.
- Do not send SMS automatically.
- Do not mention push notifications.

### Join Invite Gate

Purpose:

Handle a nurse opening an invite link.

Content:

- Validating state.
- Sign-in or signup prompt if needed.
- Join confirmation.
- Expired or invalid link state.
- Already participating state.

Rules:

- The screen should not show patient data before validation and account linking.
- If signed out, keep the copy direct: sign in first, then join this shift.
- Do not expose full shift details in the pre-join state.

### Joined Nurse Live Header

Purpose:

Give the nurse confidence they are viewing their current assignment.

Content:

- Nurse name.
- Floor name.
- Live status.
- Shift ended or access removed state when applicable.

Rules:

- Keep the header compact.
- Show only nurse-scoped assignment data below it.
- If disconnected, keep the last loaded view visible but make the connection state clear.

### Charge Request Live Inbox

Purpose:

Show issue flags and swap requests as they arrive in-app.

Content:

- Existing request filters.
- New request count or subtle live indicator.
- Pending, accepted, and declined states.
- Request detail and resolution actions from previous phases.

Rules:

- This is in-app live updating, not push notifications.
- Do not add notification permission prompts.

## Updated Navigation Model

Phase 6 can keep the existing Expo Router stack and add live/invite routes around the Phase 5 workspace:

1. Session Loading
2. Login
3. Signup
4. Charge Nurse Account Workspace
5. Existing Floor Template Setup and Shift Setup
6. Existing Floor Board with Live Status
7. Nurse Invites
8. Invite Link Join Gate
9. Joined Nurse Live Assignment
10. Access Denied / Expired Invite / Shift Ended Recovery

The existing local simulated nurse screens can be removed from the main path only when real joined nurse screens fully replace their testing purpose. If kept temporarily, they should stay clearly labeled as local simulation.

## Updated Screens

### Charge Nurse Account Workspace

Purpose:

Show the signed-in charge nurse's server-backed workspace and active live shift entry.

Layout:

- Account header.
- Active shift card with live status when connected.
- Continue active shift action.
- Floor template list.
- Sign out action.

Rules:

- Do not show nurse invite controls when no active shift exists.
- Do not add push or offline settings.

### Floor Board

Purpose:

Keep the charge nurse's main board current while the shift is active.

Updated behavior:

- Show live status near the board header.
- Reflect updates from nurse joins, requests, assignment changes, break changes, patient changes, and acuity changes.
- Keep existing census, flags, and unassigned-bed display.
- Provide navigation to Nurse Invites.

Rules:

- Do not add drag-and-drop assignment override.
- Do not add board snapshot sharing.
- Keep the board phone-first.

### Nurse Invites

Purpose:

Let the charge nurse generate, copy, share, regenerate, and monitor nurse invite links.

Layout:

- Active shift header.
- Link expiration note.
- Nurse rows grouped or listed in the same order as the shift nurse list.
- Each row shows joined status and invite actions.

Empty, Loading, Error:

- No active shift.
- No nurses in shift.
- Invite generation failed.
- Realtime invite status failed and can be refreshed.

Rules:

- Do not create invite links for nurses outside the active shift.
- Do not show full token strings.
- Keep actions per nurse.

### Invite Link Join Gate

Purpose:

Validate an invite link and link the signed-in user to the invited nurse access.

Layout:

- Validating state.
- Sign-in/signup prompt if signed out.
- Join confirmation with nurse name and floor name after validation.
- Primary action: `Join shift`.
- Recovery state for expired, revoked, malformed, already used, wrong participation, or ended shift.

Rules:

- Do not show the full floor board.
- Do not show patient data before join succeeds.
- Do not bypass auth.

### Joined Nurse Live Assignment

Purpose:

Show the joined nurse their live assignment on their own device.

Layout:

- Nurse live header.
- Assigned room and bed list.
- Patient info already allowed by previous phases.
- Acuity color per bed.
- Own break time.
- Issue and swap request actions.
- Request history.

Rules:

- Show only this nurse's assignment.
- Update in place when charge nurse changes assignment, breaks, acuity, patients, or request status.
- Show safe ended or access-removed state if the shift changes.

### Flags and Requests

Purpose:

Let the charge nurse see in-app live issue flags and swap requests.

Updated behavior:

- Existing local request rows become server/live request rows where applicable.
- New requests appear while the app is open.
- Resolution updates appear for the requesting nurse.

Rules:

- No background push notifications.
- No new reassignment behavior unless it already exists.

## Manual Testing Checks

- Start an active shift on one signed-in charge nurse device.
- Open the same active shift on another signed-in charge nurse session if supported and confirm live board updates.
- Generate an invite link for one nurse and copy or share it.
- Open the invite link on a signed-out device and confirm sign-in/signup is required before join.
- Join successfully and confirm the nurse sees only their own assignment.
- Update acuity or assignment from the charge nurse device and confirm the joined nurse view updates while open.
- Submit an issue from the nurse device and confirm it appears in the charge nurse request view without manual refresh.
- Resolve a swap request from the charge nurse device and confirm the nurse sees the updated status.
- Regenerate a nurse invite link and confirm the old link fails while the new link works.
- End the shift and confirm existing invite links stop working.
- Disconnect network briefly and confirm the UI shows disconnected or reconnecting without promising offline writes.
- Confirm the UI does not mention push notifications, offline queues, drag-and-drop, board snapshot sharing, tablet layout, or AI.

## Phase 6 Exclusions In UI

Do not design Phase 6 UI for:

- Push notification permission prompts.
- Background notification delivery.
- Offline write queue status.
- Conflict resolution screens.
- Drag-and-drop reassignment.
- Board snapshot sharing.
- Tablet-specific layout.
- AI suggestions.
- Hospital or organization admin management.

# Phase 5 Mobile Design

This document defines the mobile-first design direction for Phase 5: backend, auth, and server-side persistence.

Phase 5 should make NurseFlow feel account-backed without making it feel live or multi-device collaborative yet. Use clear server-save language, but avoid realtime, invite, deep link, push notification, offline queue, drag-and-drop, sharing, tablet, or AI language.

## Design Goals

- Add account entry points without burying the existing charge nurse workflow.
- Make the signed-in workspace feel like the same app, now saved to an account.
- Keep server save and error states visible but calm.
- Keep joined nurse access guarded and intentionally limited.
- Preserve the existing phone-first visual system from Phases 1-4.
- Keep auth and server setup understandable for a beginner.

## Visual Direction

Reuse the existing NurseFlow visual system:

- Compact cards.
- Sticky summaries.
- Status chips.
- Plain form rows.
- Bottom action bars where already used.
- Board-context tabs for board-adjacent views.

Phase 5 labels can include:

- `Sign in`
- `Create account`
- `Signed in`
- `Saved to account`
- `Saving`
- `Save failed`
- `Retry save`
- `Server workspace`
- `Account data`
- `Access required`

Avoid future-phase labels:

- Do not use `Live`.
- Do not use `Connected devices`.
- Do not use `Invite nurse`.
- Do not use `Open invite link`.
- Do not use `Realtime`.
- Do not use `Push enabled`.
- Do not use `Offline queue`.
- Do not use `Sync conflict`.

## Layout Rules

- Keep the phone layout single-column.
- Keep touch targets at least 44 px tall.
- Use native stack headers through Expo Router where possible.
- Use `contentInsetAdjustmentBehavior="automatic"` on root scroll views when implementation reaches scrollable screens.
- Use concise inline validation under auth fields.
- Show one primary action per auth screen.
- Keep server status chips small and close to the thing being saved.
- Do not add tablet-specific layouts in Phase 5.

## New or Updated Components

These are design components, not implementation code.

### Session Gate

Purpose:

Decide whether the user sees auth screens, Home, or joined nurse access.

Content:

- Loading state while checking session.
- Signed-out auth entry.
- Signed-in users land on Home.
- Future Home entry: `Join active session`.
- Setup error if backend configuration is missing.

Rules:

- Keep the loading state short and plain.
- Do not show floor board data before the session and account are known.

### Auth Form

Purpose:

Let a user create an account or log in.

Content:

- Email field.
- Password field.
- Display name field on signup.
- No role selection on signup.
- Primary action.
- Link between login and signup.
- Inline error area.

Rules:

- Do not add social login, password reset, MFA, or organization setup in Phase 5.
- Use readable error messages instead of backend jargon.

### Server Save Status

Purpose:

Show whether account-backed data is saved.

Content:

- `Saving`.
- `Saved to account`.
- `Save failed`.
- `Retry save`.
- Last saved time if it is helpful.

Rules:

- This is not realtime presence.
- This is not offline queue status.
- Keep the status calm and secondary.

### Account Workspace Header

Purpose:

Give the signed-in charge nurse confidence about whose workspace they are editing.

Content:

- Display name or email.
- Account chip.
- Sign out action.
- Server save status when relevant.

Rules:

- Do not add hospital, organization, or admin switchers.

### Joined Nurse Access Empty State

Purpose:

Explain why a signed-in account may not show joined shift access yet.

Content:

- `No shift access yet`.
- Short explanation that shift access will be connected through a future join-code flow.
- Sign out action.

Rules:

- Do not show invite link prompts in Phase 5.
- Do not imply realtime nurse joining is implemented.

## Updated Navigation Model

Phase 5 can keep the existing Expo Router stack and add an auth/session gate:

1. Session Loading
2. Login
3. Signup
4. Charge Nurse Account Workspace
5. Existing Floor Template Setup and Template Review
6. Existing Start Shift and Carry-Over Review
7. Existing Nurses, Patients, Acuity, Assignment Review
8. Existing Floor Board, Breaks, and Flags
9. Joined Nurse Access Empty State
10. Joined Nurse Assignment View when a linked server access record exists

The existing local simulated nurse screens can remain available for charge nurse testing until the real Phase 6 invite flow replaces that simulation.

## Updated Screens

### Login

Purpose:

Let an existing user enter the server workspace.

Layout:

- App name.
- Email field.
- Password field.
- Primary button: `Sign in`.
- Secondary link: `Create account`.
- Inline error area.

Empty, Loading, Error:

- Loading button state during sign-in.
- Plain error for invalid credentials or network failure.
- Backend setup error if configuration is missing.

### Signup

Purpose:

Create the first server-backed account.

Layout:

- Display name.
- Email.
- Password.
- No role selector.
- Primary button: `Create account`.
- Secondary link: `I already have an account`.

Rules:

- Default new product workflow should favor charge nurse signup.
- Joining a shift is a separate future flow from signup.

### Charge Nurse Account Workspace

Purpose:

Show the signed-in charge nurse their server-backed workspace.

Layout:

- Account header.
- Server save status.
- Floor template list.
- Active shift card when one exists.
- Empty state for a new account.
- Existing actions for creating templates and starting shifts.

Rules:

- Keep the screen focused on continuing existing workflows.
- Do not show connected devices or live collaboration status.

### Existing Workflow Screens

Purpose:

Reuse the existing Phase 1-4 workflow screens with server persistence behind them.

Updated behavior:

- Show server save status where useful.
- Show retry after save failure.
- Keep existing local validation and board layout.
- Preserve floor board, flags, breaks, and simulated nurse testing flows.

Rules:

- Do not redesign the product around backend state.
- Do not add realtime update banners.

### Joined Nurse Workspace

Purpose:

Keep joined nurse access safely scoped.

Layout:

- If no linked access exists: `No shift access yet`.
- If linked access exists: nurse assignment summary, assigned beds, own break time, and own request history.
- Sign out action.

Rules:

- Show only the joined nurse assignment linked to the signed-in account.
- Do not expose the full charge nurse board.
- Do not add invite link handling or realtime updates in Phase 5.

## Manual Testing Checks

- Create a charge nurse account and confirm the workspace loads.
- Close and reopen the app and confirm the session restores.
- Sign out and confirm server workspace screens are protected.
- Create a floor template and confirm it appears after app reload.
- Start a shift, run assignment, and confirm the active shift restores after app reload.
- Submit local nurse requests through the existing simulated flow and confirm request records persist with the active shift.
- Generate breaks and confirm break schedule state persists with the active shift.
- Link a signed-in test account to one shift nurse and confirm the full charge nurse board is not visible from joined nurse access.
- Confirm a new account with no data shows an empty workspace, not a crash.
- Confirm the UI does not mention realtime, invite links, deep links, push notifications, offline queueing, drag-and-drop, tablet layout, or AI.

## Phase 5 Exclusions In UI

Do not design Phase 5 UI for:

- Realtime connected-device status.
- Nurse invite links.
- Deep link join screens.
- Push notification prompts.
- Offline queue or conflict screens.
- Drag-and-drop reassignment.
- Board snapshot sharing.
- Tablet-specific layout.
- AI suggestions.
- Hospital or organization admin management.

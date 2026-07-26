# Phase 6 Screens

This document describes the Phase 6 mobile screens for realtime collaboration and nurse invite links. It is planning and design only, not React Native implementation code.

Each screen should be simple enough to build and test independently. Existing Phase 1-5 screens should be updated only where live shift updates, invite links, deep link joins, or nurse-scoped access require it.

## Screen Map

| Screen | Main Stories |
| --- | --- |
| Charge Nurse Account Workspace | US1, US7 |
| Floor Board | US1, US4, US5, US7 |
| Nurse Invites | US2, US6 |
| Invite Link Join Gate | US3 |
| Joined Nurse Live Assignment | US3, US4, US5 |
| Flags and Requests | US1, US5 |
| Access Denied / Expired Invite / Shift Ended | US2, US3, US4, US6, US7 |

## 1. Charge Nurse Account Workspace

### Purpose

Show the signed-in charge nurse's server-backed workspace and make active live shifts clear.

### Layout

- Account header with display name.
- Active shift card when one exists.
- Live status chip when an active shift subscription is connected.
- Continue active shift action.
- Floor template list.
- Sign out action.

### Components

- Account header.
- Active shift card.
- Live status chip.
- Floor template rows.
- Empty workspace state.

### User Actions

- Continue active shift.
- Create or edit floor templates through existing flows.
- Start a shift through existing flows.
- Sign out.
- Retry workspace load.

### Navigation Targets

- Existing floor template setup.
- Existing shift setup.
- Floor Board.
- Login after sign out.

### Validation and Error States

- Server load failed.
- No active shift.
- Realtime connection failed.
- Signed-out user attempts to open workspace.

### Exclusions

- No push notification setup.
- No offline queue status.
- No tablet-specific workspace layout.

## 2. Floor Board

### Purpose

Keep the charge nurse board current while connected devices update the active shift.

### Layout

- Board header with floor name, census, and live status.
- Existing doctor-side and nurse grouping.
- Existing nurse cards, room coverage, assigned beds, acuity, patient info, and flags.
- Entry point to Nurse Invites.
- Entry point to Flags and Requests.

### Components

- Live status chip.
- Existing board sections.
- Existing flag chips.
- Invite action button.
- Request indicator or tab.

### User Actions

- Review the live board.
- Navigate to Nurse Invites.
- Navigate to Flags and Requests.
- Use existing edit and assignment actions already supported by previous phases.
- Retry or refresh after realtime reconnect failure.

### Navigation Targets

- Nurse Invites.
- Flags and Requests.
- Existing setup or edit screens where already supported.

### Validation and Error States

- Active shift ended while board is open.
- Realtime disconnected.
- Server refresh failed after reconnect.
- Joined nurse request arrives while viewing board.

### Exclusions

- No drag-and-drop reassignment.
- No board snapshot sharing.
- No push notification prompts.
- No offline write queue.

## 3. Nurse Invites

### Purpose

Let the charge nurse generate, copy, share, regenerate, and monitor invite links for nurses in the active shift.

### Layout

- Active shift header.
- Short expiration note.
- List of active shift nurses.
- Each nurse row shows name, role details, joined status, invite status, and link actions.
- Bottom or inline retry state for invite generation failures.

### Components

- Nurse invite row.
- Joined status chip.
- Invite status chip.
- Copy link action.
- Share link action.
- Regenerate link action.
- Regenerate confirmation dialog.

### User Actions

- Generate a link for a nurse.
- Copy a generated link.
- Share a generated link through the device share sheet.
- Regenerate a link.
- Refresh invite status.

### Navigation Targets

- Back to Floor Board.

### Empty State

- `No active shift.`
- `Add nurses before creating invite links.`

### Validation and Error States

- No active shift.
- No nurses in active shift.
- Nurse no longer exists.
- Invite generation failed.
- Invite status cannot load.
- Shift ended while invite screen is open.

### Exclusions

- No automatic SMS sending.
- No push notification delivery.
- No hospital user directory.
- No permanent staff management.

## 4. Invite Link Join Gate

### Purpose

Validate an invite link and guide the user into a nurse-scoped joined shift.

### Layout

- Validating state.
- Signed-out state with sign-in and signup actions.
- Valid invite preview after server validation.
- Primary action: `Join shift`.
- Recovery state for invalid, expired, revoked, ended, malformed, or already-used links.

### Components

- Invite validation state.
- Auth-required state.
- Join confirmation card.
- Recovery message.
- Primary and secondary actions.

### User Actions

- Sign in.
- Create account.
- Join shift after validation.
- Return home after invalid or expired link.

### Navigation Targets

- Login.
- Signup.
- Joined Nurse Live Assignment.
- Home or Account Workspace after recovery.

### Validation and Error States

- Link token missing or malformed.
- Invite expired.
- Invite revoked by regeneration.
- Shift ended.
- Target nurse no longer exists.
- User already owns or participates in another active shift.
- Join request denied by server authorization.

### Exclusions

- No patient data before join succeeds.
- No full charge nurse board.
- No push notification setup.

## 5. Joined Nurse Live Assignment

### Purpose

Show a joined nurse their nurse-scoped live assignment on their own device.

### Layout

- Joined nurse live header.
- Floor name and nurse name.
- Live status chip.
- Assigned rooms and beds.
- Patient info and acuity.
- Issue and swap request actions.
- Request history.

### Components

- Nurse live header.
- Bed rows.
- Break summary row.
- Issue button.
- Swap request button.
- Request history rows.
- Access removed or shift ended state.

### User Actions

- Review assignment.
- Submit issue flag.
- Submit swap request.
- Review request status.
- Refresh after reconnect.
- Sign out.

### Navigation Targets

- Issue request form.
- Swap request form.
- Request detail when useful.
- Login after sign out.

### Validation and Error States

- No linked nurse access.
- Access removed.
- Shift ended.
- Realtime disconnected.
- Server load failed.
- Assignment references stale bed or nurse data.

### Exclusions

- No full board.
- No other nurses' assignment details.
- No push notification permission prompt.
- No offline write queue.

## 6. Flags and Requests

### Purpose

Let the charge nurse review assignment flags plus live issue flags and swap requests from joined nurses.

### Layout

- Existing flag and request filters.
- Live status near the header.
- Assignment-generated flags section.
- Nurse requests section.
- Request rows with status.

### Components

- Live status chip.
- Existing severity filters.
- Existing request type and status filters.
- Request rows.
- Request detail view.
- Accept and decline controls where already supported.

### User Actions

- Review live requests.
- Filter requests.
- Open request detail.
- Accept or decline swap requests if already supported by previous phase behavior.
- Retry after server or realtime error.

### Navigation Targets

- Request detail.
- Back to Floor Board.

### Validation and Error States

- New request arrives while screen is open.
- Request is resolved from another connected charge nurse session.
- Request references a stale bed or nurse.
- Realtime reconnect requires a refresh.

### Exclusions

- No background push notifications.
- No drag-and-drop reassignment.
- No automated AI recommendation.

## 7. Access Denied / Expired Invite / Shift Ended

### Purpose

Show safe recovery when a user cannot access a live shift, invite, or nurse assignment.

### Layout

- Short title such as `Link expired`, `Shift ended`, `Access removed`, or `This screen is not available`.
- Plain explanation.
- Primary action to return to the right workspace.
- Sign out action when useful.

### Validation and Error States

- Signed-out user opens protected joined nurse route.
- Invite token is expired, revoked, or malformed.
- Active shift ended.
- User already participates in another active shift.
- Joined nurse access no longer exists.
- Backend authorization denies a read or write.

## Build Order Recommendation

1. Add Phase 6 planning and scope guardrails.
2. Add realtime connection planning boundary.
3. Add active shift realtime subscription for charge nurse screens.
4. Add nurse invite records and generation flow.
5. Add copy/share/regenerate invite UI.
6. Add deep link join gate.
7. Link signed-in users to shift nurse access from valid invites.
8. Add joined nurse live assignment subscriptions.
9. Add live issue and swap request updates.
10. Add invite expiration on shift end.
11. Run a full Phase 6 manual test pass.

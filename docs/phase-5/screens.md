# Phase 5 Screens

This document describes the Phase 5 mobile screens for backend, auth, and server-side persistence. It is planning and design only, not React Native implementation code.

Each screen should be simple enough to build and test independently. Existing Phase 1-4 screens should be updated only where auth, server loading, server saving, or role boundaries require it.

## Screen Map

| Screen | Main Stories |
| --- | --- |
| Session Loading | US2, US5 |
| Login | US2 |
| Signup | US2, US5 |
| Charge Nurse Account Workspace | US3, US4, US6 |
| Join Active Session Shell | US5 |
| Existing Workflow Screens | US3, US4, US6 |
| Joined Nurse Workspace | US5 |
| Access Denied / Recovery | US2, US5, US6 |

## 1. Session Loading

### Purpose

Check whether a backend auth session already exists before choosing the starting screen.

### Layout

- Centered NurseFlow title or small loading mark.
- Short text: `Checking session`.

### Components

- Loading indicator.
- Optional setup error message.

### User Actions

- None during normal loading.
- If backend configuration is missing, show a recovery path to the setup notes.

### Navigation Targets

- Signed out goes to Login.
- Signed in charge nurse goes to Charge Nurse Account Workspace.
- Signed-in users go to Home.
- A future `Join active session` entry can open Joined Nurse Workspace after access is linked.

### Validation and Error States

- Missing backend configuration.
- Failed session restore.
- Profile missing for authenticated backend user.

## 2. Login

### Purpose

Let an existing account enter the server-backed app.

### Layout

- Header: `Sign in`.
- Email field.
- Password field.
- Primary action: `Sign in`.
- Secondary action: `Create account`.
- Inline error area.

### Components

- Auth form fields.
- Primary button.
- Secondary text button.
- Inline validation message.

### User Actions

- Enter email and password.
- Submit login.
- Navigate to Signup.

### Navigation Targets

- Successful charge nurse login opens Charge Nurse Account Workspace.
- Successful login opens Home.
- Signup link opens Signup.

### Validation and Error States

- Missing email.
- Missing password.
- Invalid credentials.
- Network or backend error.

## 3. Signup

### Purpose

Create a server-backed account.

### Layout

- Header: `Create account`.
- Display name field.
- Email field.
- Password field.
- No role selector in Phase 5 signup.
- Primary action: `Create account`.
- Secondary action: `I already have an account`.
- Inline error area.

### Components

- Auth form fields.
- No role segmented control.
- Primary button.
- Secondary text button.

### User Actions

- Enter account details.
- Submit signup.
- Navigate back to Login.

### Navigation Targets

- Successful charge nurse signup opens Charge Nurse Account Workspace.
- Successful signup opens Home.
- Login link opens Login.

### Validation and Error States

- Missing display name.
- Invalid email.
- Weak password.
- Duplicate account.
- Backend setup or network error.

## 4. Charge Nurse Account Workspace

### Purpose

Show the signed-in charge nurse's server-backed workspace.

### Layout

- Account header with display name.
- Sign out action.
- Server save/load status.
- Active shift card if one exists.
- Floor template list.
- Primary action: create floor template or continue active shift.

### Components

- Account header.
- Save status chip.
- Active shift summary card.
- Floor template rows.
- Empty workspace state.

### User Actions

- Create a floor template.
- Edit a floor template.
- Start a shift from a template.
- Continue an active shift.
- Sign out.
- Retry load or save after an error.

### Navigation Targets

- Existing floor template setup.
- Existing template review.
- Existing shift setup.
- Existing floor board.
- Login after sign out.

### Empty State

- `No floor templates yet.`
- `Create your first floor template.`

### Validation and Error States

- Server load failed.
- Server save failed.
- Active shift references missing template.
- User profile cannot load the signed-in account safely.

## 5. Existing Workflow Screens

### Purpose

Keep Phase 1-4 workflows intact while saving to the server.

### Updated Screens

- Floor Template Setup.
- Template Review.
- Start Shift.
- Carry-Over Review.
- Nurses.
- Patients and Acuity.
- Assignment Review.
- Floor Board.
- Breaks.
- Flags and Requests.
- Simulated Nurse screens used by charge nurse for testing.

### New Screen Behavior

- Show save status when server writes happen.
- Show retry action after save failure.
- Keep existing local validation messages.
- Keep existing board, break, and flags layouts.

### Validation and Error States

- Signed-out user attempts to access server workflow.
- Server save fails after a valid local edit.
- Active shift data cannot be loaded.
- Existing Phase 1-4 empty states still work.

### Exclusions

- No realtime update indicators.
- No invite links.
- No deep link handling.
- No push notification prompts.
- No offline queue or conflict screens.

## 6. Join Active Session Shell

### Purpose

Show the future entry point for joining an active shift by nurse code without implementing code verification yet.

### Layout

- Title: `Join active session`.
- Disabled nurse code field.
- Disabled `Join shift` action.
- Plain helper copy that code verification comes later.

### User Actions

- Return to Home.

### Exclusions

- No code generation.
- No code validation.
- No access-record creation.
- No invite links or deep links.

## 7. Joined Nurse Workspace

### Purpose

Provide a safe joined nurse access boundary before a future join-code or invite flow.

### Layout

- Account header with display name.
- If no access exists:
  - Empty state: `No shift access yet`.
  - Short supporting text.
  - Sign out action.
- If access exists:
  - Nurse assignment summary.
  - Assigned room and bed list.
  - Own break time.
  - Own request history.

### Components

- Role header.
- Empty access state.
- Nurse assignment summary.
- Bed rows.
- Break summary row.
- Request history rows.

### User Actions

- Review own assignment when access exists.
- Sign out.

### Navigation Targets

- Login after sign out.

### Validation and Error States

- No linked shift access.
- Access record points to a missing shift.
- Access record points to a missing nurse in the shift snapshot.
- Server load failed.

### Exclusions

- No joining by invite link.
- No deep link handling.
- No realtime updates.
- No push notifications.

## 7. Access Denied / Recovery

### Purpose

Show safe recovery when the session, role, or authorization state does not match the requested screen.

### Layout

- Short title: `Access required` or `This screen is not available`.
- Plain explanation.
- Primary action to return to the right workspace.
- Sign out action when useful.

### Validation and Error States

- Signed-out user opens protected route.
- A user opens joined nurse access without an access-linked nurse context.
- A user tries to access another nurse's joined assignment data.
- Backend authorization denies a read or write.

## Build Order Recommendation

1. Add Phase 5 planning and scope guardrails.
2. Choose and document the backend approach.
3. Add auth/session planning boundary.
4. Add server profile and role model.
5. Add charge nurse login/signup screens.
6. Add session restore and sign out.
7. Add server floor template persistence.
8. Add server active shift persistence.
9. Add previous-shift snapshot persistence.
10. Add joined nurse workspace boundary.
11. Add authorization checks and manual role testing.
12. Run a full Phase 5 manual test pass.

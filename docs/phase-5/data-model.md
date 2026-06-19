# Phase 5 Data Model

This document defines the planning model for Phase 5 backend, auth, and server-side persistence. The TypeScript-like shapes below are documentation examples, not implementation code.

Phase 5 builds on the Phase 1 model in `docs/phase-1/data-model.md`, the Phase 2 persisted local model in `docs/phase-2/data-model.md`, the Phase 3 local nurse simulation model in `docs/phase-3/data-model.md`, and the Phase 4 break schedule model in `docs/phase-4/data-model.md`.

## Modeling Rules

- Preserve the existing local domain shapes where possible.
- Use one normal `id` field per persisted backend entity.
- Treat backend-generated IDs as the IDs used by fetched app data.
- Keep Phase 5 request/response based. Do not add realtime subscriptions yet.
- Treat the backend response as the source of truth after server-backed changes.
- Keep account roles simple: every signed-in Phase 5 profile is `charge_nurse`.
- Treat regular nurse access as a shift-specific participation state, not a permanent account role.
- Store reusable floor templates separately from active shifts.
- Store active shift data as the source of truth for shift-specific nurses, patients, acuity, assignments, requests, and breaks.
- Use server authorization rules so joined-shift nurse views cannot read full charge nurse data.
- Keep old local IDs and old local persisted app state out of the normal Phase 5 app model.
- Do not add invite tokens, deep link records, realtime channel metadata, push tokens, offline queue records, drag-and-drop override records, tablet layout fields, or AI fields.

## Server Mutation Pattern

For Phase 5, server-backed create, update, and delete actions should follow a simple request-then-refresh pattern:

1. The user submits a focused action, such as adding a nurse to the current shift.
2. The app sends the matching server request, such as `POST /shifts/:shiftId/nurses`.
3. After the request succeeds, the app reloads the relevant server-owned data for that scope.
4. The UI fills from the refreshed server data.

### Rules

- Adding nurses should create nurse records for the current active shift on the backend, then fetch the current shift's nurses or active shift snapshot before showing the next screen.
- Adding patients, updating acuity, changing max loads, resolving local requests, and generating or saving break schedules should follow the same pattern.
- Local screen state can hold temporary form input before submit.
- After submit, avoid treating the temporary form state as saved truth.
- If a request fails, keep the user on the current screen with a readable retry path.
- Do not add realtime subscriptions or offline write queues to solve refresh in Phase 5.

## Backend Approach Boundary

Phase 5 should include a backend decision task before implementation starts.

The planned default is:

- Auth: email/password auth from the chosen backend provider.
- Database: server tables for profiles, floor templates, active shifts, previous-shift snapshots, and nurse access records.
- Client access: small service/repository functions that screens call indirectly.
- Realtime: explicitly off until Phase 6.

If Supabase is chosen, Phase 5 should use Supabase Auth and normal Postgres reads/writes only. Supabase Realtime should remain disabled until Phase 6.

## Shared Types

```ts
type Id = string;

type UserRole = 'charge_nurse';

type AuthStatus = 'checking' | 'signed_out' | 'signed_in';

type ServerSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type ShiftAccessStatus = 'pending_link' | 'linked' | 'removed';
```

## Auth Session

The auth session represents whether the app has a signed-in backend user.

```ts
interface AuthSessionState {
  status: AuthStatus;
  profile?: UserProfile;
  errorMessage?: string;
}
```

### Rules

- Session state is not the floor board state.
- The app should show a loading state while checking a stored session.
- Signed-out users can see auth screens but should not save server data.
- The backend provider owns secure password storage. The app never stores raw passwords.

## User Profile

`UserProfile` stores app-specific account details for the authenticated backend user.

```ts
interface UserProfile {
  id: Id;
  authUserId: Id;
  displayName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}
```

### Rules

- `authUserId` comes from the backend auth system.
- `role` remains charge-capable for every signed-in account in Phase 5.
- Shift-specific nurse access is controlled by `ShiftNurseAccess`, not by changing the profile role.
- Phase 5 does not need organizations, hospitals, teams, or multi-hospital admin roles.
- A signed-in profile does not get nurse-facing shift access unless it has a linked `ShiftNurseAccess` record.

## Floor Template Record

The server floor template record stores the reusable floor structure with backend-generated IDs.

```ts
interface FloorTemplateRecord {
  id: Id;
  ownerProfileId: Id;
  name: string;
  templateSnapshot: FloorTemplate;
  createdAt: string;
  updatedAt: string;
}
```

### Rules

- `templateSnapshot` stores reusable structure only: floor name, doctor sides, rooms, and beds.
- IDs inside `templateSnapshot` should be backend IDs after the template is fetched from the server.
- Patient data, acuity, nurses, assignments, requests, and breaks do not belong on the template.
- Only the owning charge nurse can create, edit, or delete the template in Phase 5.

## Active Shift Record

The server active shift record stores the current Phase 1-4 shift shape with backend-generated IDs.

```ts
interface ActiveShiftRecord {
  id: Id;
  chargeProfileId: Id;
  floorTemplateId: Id;
  status: ShiftStatus;
  shiftSnapshot: Shift;
  saveStatus?: ServerSaveStatus;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}
```

### Rules

- `shiftSnapshot` keeps the existing active shift model understandable.
- The snapshot can include copied floor structure, nurses, bed states, assignment result, flags, nurse requests, and break schedule.
- IDs inside `shiftSnapshot` should be backend IDs after the shift is fetched from the server.
- `floorTemplateId` identifies which server template started the shift.
- Phase 5 can use a simple foreground save and manual retry. It should not add offline write queues or conflict resolution yet.

## Previous Shift Snapshot

Phase 5 moves Phase 2 carry-over snapshots to the server.

```ts
interface ServerPreviousShiftSnapshot {
  id: Id;
  chargeProfileId: Id;
  floorTemplateId: Id;
  completedAt: string;
  nurseSuggestions: NurseCarryOverSuggestion[];
  patientSuggestions: PatientCarryOverSuggestion[];
}
```

### Rules

- Store only the carry-over data needed to start the next shift.
- Keep the snapshot tied to one charge nurse account and one floor template.
- This is not a full audit log or analytics model.
- Break schedules and nurse request history do not need to carry over unless a later phase explicitly adds that history.

## Shift Nurse Access

`ShiftNurseAccess` gives a signed-in profile permission to see one nurse assignment for one active shift.

```ts
interface ShiftNurseAccess {
  id: Id;
  shiftId: Id;
  nurseId: Id;
  nurseName: string;
  nurseProfileId?: Id;
  nurseEmail?: string;
  status: ShiftAccessStatus;
  createdAt: string;
  updatedAt: string;
}
```

### Rules

- `nurseId` points to a nurse inside `ActiveShiftRecord.shiftSnapshot.nurses`.
- `nurseProfileId` is optional because the future join-code flow belongs to a later explicit task.
- In Phase 5, this record exists to prove authorization and prepare for nurse joins.
- A signed-in user can see only nurse-scoped assignment data for access records linked to their profile.
- A profile should have at most one active shift participation at a time. If it is linked as a nurse for an active shift, it should leave before starting a charge shift or joining another shift.
- The charge nurse can still use the existing local/simulated nurse flow while real linking is incomplete.

## Server Workspace View

The signed-in charge nurse workspace can be loaded as a small app-level view model.

```ts
interface ServerWorkspace {
  profile: UserProfile;
  floorTemplates: FloorTemplateRecord[];
  activeShift?: ActiveShiftRecord;
  previousShiftSnapshots: ServerPreviousShiftSnapshot[];
}
```

### Rules

- Charge nurse screens should use this workspace after login.
- Empty arrays are valid for a new account.
- Screens should derive board, nurse assignment, request, and break display from `activeShift.shiftSnapshot`, not duplicate those models.

## Joined Nurse Assignment View

Joined nurse screens should receive only the nurse-scoped view they are allowed to see.

```ts
interface JoinedNurseAssignmentView {
  access: ShiftNurseAccess;
  shiftId: Id;
  floorName: string;
  nurseName: string;
  assignedBeds: NurseAssignedBed[];
  breakTimeLabel?: string;
  requestHistory: NurseRequest[];
}
```

### Rules

- This view is derived from the active shift snapshot and the nurse's access record.
- It must not expose the full charge nurse board to joined nurses.
- Phase 5 can load this view from a manually created access record. A later join-code task can create access records from `Join active session`.

## Local Storage Removal

The normal Phase 5 app model should not carry both local and server IDs, and it should not keep the old local storage-backed app state as a second source of truth.

### Rules

- Old Phase 1-4 locally saved testing data can be discarded when Phase 5 server persistence takes over.
- Fetched app data should use normal backend `id` values.
- Do not keep `serverId` and `localId` pairs in normal screen state, domain records, or task plans.
- Do not keep the old local storage repository or local storage-backed state context in the Phase 5 runtime path.
- Temporary screen state is still allowed for unsaved form input.
- Keep assignment and break scheduling helpers focused on fetched shift data.

## Authorization Summary

- Charge nurses can read and write their own profiles, templates, active shifts, snapshots, and nurse access records.
- Signed-in users can read their own profile.
- Joined-shift users can read only nurse-scoped assignment data for linked access records.
- Joined-shift users cannot read full `ActiveShiftRecord.shiftSnapshot` records.
- Unauthenticated users cannot read or write server workspace data.

## Supports Phase 5 Stories

This model supports:

- Backend decision documentation.
- Email/password signup and login.
- Persistent sessions.
- Server floor templates.
- Server active shifts.
- Server carry-over snapshots.
- Real charge-capable profiles and nurse-scoped shift access.
- Basic authorization boundaries.
- Compatibility with Phase 1-4 local workflow models.

## Future Phase Notes

These are intentionally not part of the Phase 5 model:

- Realtime subscription records.
- Nurse invite tokens.
- Deep link routes or universal/app link records.
- Push notification tokens or notification jobs.
- Offline write queue and conflict records.
- Drag-and-drop override history.
- Board snapshot sharing records.
- Tablet-specific layout preferences.
- AI-generated recommendations.

# Phase 6 Data Model

This document defines the planning model for Phase 6 realtime collaboration and nurse invite links. It documents data changes and relationships only; it is not implementation code.

Phase 6 builds on the Phase 5 server-backed model in `docs/phase-5/data-model.md`. The server remains the source of truth for profiles, floor templates, active shifts, previous-shift snapshots, and shift nurse access records.

## Modeling Rules

- Preserve Phase 5 server-owned IDs and entity boundaries.
- Keep active shift data server-backed.
- Add realtime subscriptions around server records instead of adding a second local sync store.
- Keep invite links tied to one active shift and one nurse inside that shift.
- Treat regular nurse access as shift-specific participation, not as a permanent profile role.
- Store only safe invite metadata on the server. Do not store raw invite links in normal app state.
- Expire invites when the shift ends.
- Regenerating an invite invalidates the previous active invite for that nurse.
- Keep joined nurse reads scoped through the existing nurse assignment boundary.
- Do not add push notification tokens, notification jobs, offline write queues, conflict logs, drag-and-drop override records, board snapshot records, tablet layout fields, or AI fields.

## Server Truth and Realtime Reads

Phase 6 keeps the Phase 5 server mutation pattern:

1. A user performs a focused action, such as updating acuity or submitting a request.
2. The app sends the server write.
3. The server accepts or rejects the write using authorization rules.
4. Connected clients receive a realtime signal for the affected active shift or access view.
5. The app refreshes or patches the relevant server-owned view.

### Rules

- A realtime event is a signal that server data changed.
- The app should be able to refetch the current shift after reconnecting.
- Direct user actions can still use request-then-refresh for clarity.
- If realtime is disconnected, the UI should say so plainly.
- Disconnected Phase 6 users should not keep editing as if an offline queue exists.

## Updated Existing Records

### Active Shift Record

Phase 6 adds collaboration behavior around the existing active shift record. It may need small metadata fields to support live coordination.

Planned fields or derived values:

| Field | Purpose |
| --- | --- |
| `id` | Existing active shift ID. |
| `status` | Existing setup, active, or ended state. Invites are valid only while active. |
| `shiftSnapshot` | Existing source of truth for floor, nurses, beds, assignments, and requests. |
| `updatedAt` | Existing or backend-maintained timestamp used to recognize fresh server data. |
| `endedAt` | Existing end time. If present, invite links and live participation should stop. |

Rules:

- Active shift snapshots remain the main Phase 1-4 workflow data.
- Realtime listeners should subscribe only to the relevant active shift.
- Joined nurses should not receive the full active shift snapshot unless server authorization explicitly permits a reduced nurse-scoped view.

### Shift Nurse Access

Phase 5 introduced shift-specific nurse access. Phase 6 invite joins create or update this record from a valid invite.

Planned fields or derived values:

| Field | Purpose |
| --- | --- |
| `id` | Existing access record ID. |
| `shiftId` | Existing active shift ID. |
| `nurseId` | Existing nurse ID inside the shift snapshot. |
| `nurseProfileId` | Signed-in profile linked through the invite join. |
| `status` | Existing participation state such as pending, linked, or removed. |
| `joinedAt` | When the nurse successfully joined from an invite. |
| `lastSeenAt` | Optional foreground presence timestamp for simple connected-state display. |

Rules:

- `nurseProfileId` should be filled only after a signed-in user successfully joins.
- A joined user can read only their own nurse assignment view.
- A profile should still have at most one active shift participation at a time.
- Presence is helpful but not required for assignment correctness.

## New Invite Record

Phase 6 adds a server invite record for nurse links.

### Shift Nurse Invite

Purpose:

Store the server-side state needed to validate one nurse invite link.

Planned fields:

| Field | Purpose |
| --- | --- |
| `id` | Backend ID for the invite record. |
| `shiftId` | Active shift this invite belongs to. |
| `nurseId` | Nurse inside the active shift this invite is for. |
| `createdByProfileId` | Charge nurse profile that generated the invite. |
| `tokenHash` | Hashed server-side token used to validate the link without storing the raw token. |
| `status` | Active, used, revoked, or expired. |
| `createdAt` | When the invite was generated. |
| `expiresAt` | Expiration time, no later than shift end. |
| `usedAt` | When the invite was accepted, if applicable. |
| `usedByProfileId` | Signed-in profile that accepted the invite, if applicable. |
| `revokedAt` | When the invite was invalidated by regeneration or shift end, if applicable. |

Rules:

- One nurse should have at most one active invite for the same active shift.
- Regenerating a link revokes the old active invite and creates a new one.
- Ending a shift expires or revokes all active invites for that shift.
- The raw invite token should be shown only at generation time or encoded into the link returned to the client.
- The invite record should not contain patient data, full board data, push tokens, or offline queue data.

## Invite Link Payload

The invite link should carry only the minimum information needed to open the app and validate the join.

Planned link meaning:

| Value | Purpose |
| --- | --- |
| Invite token | Secret token checked by the server. |
| Shift hint | Optional non-secret hint to route faster. |
| Nurse hint | Optional non-secret hint to display a friendly join preview after validation. |

Rules:

- The link alone should not grant full board access.
- The server validates the token before creating nurse access.
- If the user is signed out, the app can keep a pending invite route while asking the user to sign in or create an account.
- Expired, revoked, used-by-another-user, or malformed links should show clear recovery states.

## Realtime Subscription Scopes

Phase 6 should keep realtime subscriptions narrow and easy to explain.

### Charge Nurse Scope

The charge nurse subscribes to:

- Their active shift record.
- Nurse invite status for that active shift.
- Shift nurse access records for that active shift.
- Nurse request changes for that active shift if requests are stored separately from the shift snapshot.

Rules:

- Charge nurse listeners start after the workspace loads an active shift.
- Charge nurse listeners stop when the shift ends, the user signs out, or the screen tree leaves the active shift.

### Joined Nurse Scope

The joined nurse subscribes to:

- Their own joined nurse assignment view or a server signal that this view changed.
- Their own shift nurse access record.
- Their own request records if requests are stored separately from the shift snapshot.

Rules:

- Joined nurse listeners must not expose full charge nurse data.
- If access is removed or the shift ends, the joined nurse screen should move to a safe ended/access state.

## Realtime Connection State

Connection state can be app-level or active-shift-level UI state. It does not need to be permanently stored in the database.

Planned values:

| Value | Meaning |
| --- | --- |
| `connecting` | The app is opening the live channel. |
| `live` | Realtime updates are connected. |
| `reconnecting` | The app is trying to restore the live channel. |
| `disconnected` | Live updates are unavailable. |
| `error` | The live channel failed and needs retry or reload. |

Rules:

- Connection state is UI state, not saved shift data.
- After reconnecting, the app should refetch the current active shift or joined nurse view.
- Do not treat this as offline queue state.

## Authorization Summary

- Charge nurses can create, regenerate, revoke, and view invite status for nurses in their own active shifts.
- Signed-in users can accept a valid invite and become linked to the invited nurse's access record.
- Joined nurses can read only their own nurse-scoped assignment data.
- Invite validation should not expose whether unrelated shifts or users exist.
- Ended shifts reject invite joins.
- Revoked and expired invites reject joins.

## Supports Phase 6 Stories

This model supports:

- Realtime active shift updates.
- Nurse invite link generation.
- Deep link join handling.
- Shift-specific nurse access creation.
- Live joined nurse assignment updates.
- In-app live issue and swap request updates.
- Invite regeneration and expiration.
- Compatibility with Phase 1-5 behavior.

## Future Phase Notes

These are intentionally not part of the Phase 6 model:

- Push notification tokens.
- Background notification jobs.
- Offline write queues.
- Conflict resolution logs.
- Local optimistic operation queues.
- Drag-and-drop override history.
- Board snapshot sharing records.
- Tablet layout preferences.
- AI-generated recommendations.

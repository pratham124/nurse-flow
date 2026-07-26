# Phase 7 Data Model

This document defines the planning model for the revised Phase 7 scope: push notifications and lightweight connection resilience. It documents data changes and relationships only; it is not implementation code.

Phase 7 builds on the Phase 6 server-backed realtime and invite model in `docs/phase-6/data-model.md`. The server remains the source of truth for profiles, floor templates, active shifts, previous-shift snapshots, shift nurse access, invite records, assignment data, request data, and break data.

## Modeling Rules

- Preserve Phase 5 and Phase 6 server-owned IDs and authorization boundaries.
- Keep foreground realtime as the connected experience.
- Use push notifications for background awareness, not as the source of truth.
- Keep cached views read-only and clearly labeled as cached or stale.
- Require a server connection for writes in Phase 7.
- Keep notification tokens separate from clinical shift data.
- Do not store raw invite codes, raw notification payload secrets, or unnecessary patient detail in notification records.
- Do not add offline write queues, drag-and-drop override records, board snapshot records, tablet layout fields, request-thread message records, or AI fields.

## Existing Records Updated by Phase 7

### Profile

Purpose:

Identify the signed-in user who owns devices, permissions, and shift participation.

Planned additions or derived values:

| Field | Purpose |
| --- | --- |
| `id` | Existing profile ID. |
| `notificationPreference` | Optional preference such as enabled, disabled, or unknown. |
| `lastNotificationPermissionCheckedAt` | Optional timestamp for UI copy and troubleshooting. |

Rules:

- Device-level permission can differ from profile preference.
- A denied device permission should not block normal app use.
- A profile can have more than one registered device token.

### Active Shift

Purpose:

Continue to hold the server-backed active shift snapshot and freshness metadata.

Planned additions or derived values:

| Field | Purpose |
| --- | --- |
| `id` | Existing active shift ID. |
| `status` | Existing setup, active, or ended state. |
| `updatedAt` | Server timestamp used for cache freshness and notification routing. |
| `lastNotificationEventAt` | Optional derived value for notification diagnostics. |

Rules:

- `updatedAt` should be included with cached views so the UI can say when the saved copy was loaded.
- Ending a shift should stop notification routing for that shift.
- Assignment, request, patient, acuity, invite, and break writes remain server-required in Phase 7.

### Shift Nurse Access

Purpose:

Continue to scope joined nurse reads and notifications to one nurse in one active shift.

Planned additions or derived values:

| Field | Purpose |
| --- | --- |
| `id` | Existing access record ID. |
| `shiftId` | Existing active shift ID. |
| `nurseId` | Existing nurse ID inside the shift snapshot. |
| `nurseProfileId` | Existing linked profile. |
| `status` | Existing participation state. |
| `notificationsEnabled` | Optional shift-specific notification preference. |

Rules:

- Joined nurse notifications should route through this access boundary.
- Removed access should stop assignment and break notifications for that nurse.
- Joined nurses should not receive full-board notification payloads.

## New Server Records

### Device Push Token

Purpose:

Store the safe server-side information needed to send push notifications to a signed-in user's device.

Planned fields:

| Field | Purpose |
| --- | --- |
| `id` | Backend ID for the token record. |
| `profileId` | Signed-in profile that owns the device token. |
| `deviceId` | App-generated or platform-provided stable device identifier when available. |
| `platform` | iOS, Android, or web/dev where applicable. |
| `pushToken` | Provider token used by the notification service. |
| `status` | Active, disabled, expired, or revoked. |
| `permissionStatus` | Granted, denied, provisional, or unknown. |
| `createdAt` | When the token was first registered. |
| `updatedAt` | Last token or permission update. |
| `lastSeenAt` | Last time this device refreshed its registration. |

Rules:

- Tokens are registered only for signed-in users.
- Signing out should disable or disassociate the local device token.
- The token record should not contain patient data or active shift snapshots.
- If the platform token changes, the server should update the existing device record or create a replacement and disable the old one.

### Notification Event

Purpose:

Record server-side notification intent and delivery status for important active shift events.

Planned fields:

| Field | Purpose |
| --- | --- |
| `id` | Backend ID for the notification event. |
| `shiftId` | Active shift related to the event, when applicable. |
| `recipientProfileId` | Profile intended to receive the notification. |
| `recipientAccessId` | Optional shift nurse access ID for nurse-scoped notifications. |
| `type` | Issue, swap, assignment update, admission, discharge, imbalance, or unassigned bed. |
| `targetRoute` | Safe app route or route key to open after tap. |
| `relatedRequestId` | Optional nurse request ID. |
| `relatedBedId` | Optional bed ID for charge-safe routing. |
| `title` | Short notification title. |
| `body` | Short notification body without unnecessary patient detail. |
| `status` | Pending, sent, failed, skipped, or cancelled. |
| `createdAt` | When the event was created. |
| `sentAt` | When delivery succeeded, if known. |
| `failureReason` | Safe troubleshooting message when delivery fails. |

Rules:

- Notification payloads should be minimal and route users back to server-fresh data.
- A notification event is not proof that the app state changed; the server record is the source of truth.
- Duplicate suppression should happen before creating or sending noisy repeated events.
- Ended shifts should cancel or skip shift-related notification events.

## New Local Records

### Cached Shift View

Purpose:

Keep the most recent charge board or joined nurse view readable during temporary connection loss.

Planned fields:

| Field | Purpose |
| --- | --- |
| `cacheKey` | Profile and scope key, such as charge shift or joined nurse access. |
| `profileId` | Signed-in profile that can read this cache. |
| `scope` | Charge board or joined nurse assignment. |
| `shiftId` | Active shift ID. |
| `accessId` | Joined nurse access ID when scoped to one nurse. |
| `snapshot` | Last safe server response for this scope. |
| `serverUpdatedAt` | Server timestamp from the cached response. |
| `cachedAt` | Local time the view was stored. |
| `expiresAt` | Optional local cache expiration time. |

Rules:

- Cached shift views must stay profile-scoped.
- Signing out should clear or lock protected cached views.
- Cached data should be labeled stale while offline.
- Cached data is read-only in Phase 7.
- Reconnect should refresh from the server before removing stale labels.

### Connection Display State

Purpose:

Represent what the user should understand about the current screen's connection and cache state.

Planned values:

| Value | Meaning |
| --- | --- |
| `online` | Current server-backed data is available. |
| `reconnecting` | The app is trying to restore the server connection. |
| `offline` | The app cannot reach the server. |
| `viewingCachedCopy` | The screen is showing the last saved server response. |
| `refreshFailed` | The app could not refresh current server data. |

Rules:

- Connection display state is UI state, not saved shift data.
- It should not imply offline edits are being saved.
- Write actions should require `online` server availability in Phase 7.

## Notification Types

Planned notification event types:

| Type | Recipient | Route Target |
| --- | --- | --- |
| `issueSubmitted` | Charge nurse | Request detail or requests list. |
| `swapRequested` | Charge nurse | Request detail or requests list. |
| `swapResolved` | Requesting nurse | Joined nurse assignment or request status. |
| `assignmentUpdated` | Affected joined nurse | Joined nurse assignment. |
| `admissionAdded` | Charge nurse | Floor board or bed detail when available. |
| `patientDischarged` | Charge nurse | Floor board. |
| `imbalanceDetected` | Charge nurse | Flags screen. |
| `bedUnassigned` | Charge nurse | Flags screen. |

Rules:

- Notification payloads should include IDs for routing, not full patient details.
- Opening a notification should fetch current server data before showing final content.
- If routing fails, the app should show a safe recovery state.

## Supports Phase 7 Stories

This model supports:

- Push permission and token registration.
- Push notifications for requests, assignment updates, admissions, discharges, imbalance alerts, and unassigned beds.
- Notification tap routing and safe recovery.
- Read-only access to cached charge and joined nurse views during brief disconnects.
- Clear disabled-action states while disconnected.
- Compatibility with Phase 1-6 behavior.

## Future Phase Notes

These are intentionally not part of the revised Phase 7 model:

- Offline write queues.
- Queued write sync on reconnect.
- Drag-and-drop assignment override history.
- Board snapshot sharing records.
- Tablet layout preferences.
- Request-thread message records.
- AI-generated recommendations.
- Production assignment optimizer records.

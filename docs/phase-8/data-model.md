# Phase 8 Data Model

This document plans Phase 8 data changes for manual assignment overrides, request threads, request lifecycle clarity, and presentation features. It is documentation, not implementation code.

Phase 8 builds on the authenticated, server-backed active shift and nurse-scoped access model from Phases 5-7. The server remains the source of truth. Realtime distributes successful server changes; push payloads and local display state are not authoritative.

## Modeling Rules

- Preserve existing IDs and authorization boundaries.
- Keep the current deterministic `AssignmentResult` as the generated baseline.
- Store manual changes as separate server history records instead of mutating or disguising the generated baseline.
- Give routine app reads a dictionary of current active overrides keyed by bed ID; do not ship or scan superseded history to render the board.
- Derive each bed's effective assignment with a direct dictionary lookup, falling back to the generated baseline when no active override exists.
- Validate every override against current server state before saving it.
- Keep request conversations scoped to one request; do not create a global chat model.
- Keep issue review state separate from swap decision and completion state.
- Generate board snapshots locally and ephemerally; do not add snapshot records to shift data.
- Keep responsive layout, accessibility, focus, and swipe-reveal state as UI state rather than domain data.
- Do not add Phase 9 optimizer fields, AI fields, offline queues, or conflict-merge records.

## Existing Records Extended

### Active Shift

Purpose: continue to own the current shift snapshot and its generated assignment baseline.

Planned derived response addition:

| Field | Purpose |
| --- | --- |
| `activeAssignmentOverridesByBedId` | Dictionary whose key is a bed ID and whose value is that bed's single current active override. Missing means an empty dictionary. |

Rules:

- `activeAssignmentOverridesByBedId` is an app-facing projection from server override records, not the authoritative audit-history store.
- Existing active shifts without `activeAssignmentOverridesByBedId` behave exactly as they do today.
- A bed has zero or one entry in this dictionary, so routine effective-owner lookup is constant time.
- The generated `assignmentResult` is not rewritten when one bed is moved manually.
- A successful assignment rerun creates a new baseline and supersedes prior active server override records only after explicit charge-nurse confirmation; the new active dictionary initially omits those beds.
- Assignment flags and board views are calculated from the effective assignment.

### Assignment Result

No new Phase 8 fields are required.

`generatedTeams`, `roomCoverage`, and `bedAssignments` remain the deterministic output from the current assignment process. Phase 8 consumes this output as a baseline. Phase 9 can later replace the generator without changing the manual-override contract.

### Nurse Request

Purpose: preserve existing issue and swap requests while making their different lifecycles explicit.

Planned optional additions:

| Field | Applies To | Purpose |
| --- | --- | --- |
| `issueReviewStatus` | Issue | `open`, `reviewed`, or `resolved`. Missing on an existing issue is read as `open`. |
| `reviewedAt` | Issue | Server time the charge nurse marked it reviewed. |
| `reviewedByProfileId` | Issue | Charge profile that reviewed it. |
| `issueResolvedAt` | Issue | Server time the issue was resolved. |
| `issueResolvedByProfileId` | Issue | Charge profile that resolved it. |
| `swapCompletedAt` | Swap | Server time an accepted swap's assignment change was completed. |
| `swapCompletedByProfileId` | Swap | Charge profile that completed the assignment change. |
| `completedOverrideId` | Swap | Manual override that proves the accepted swap changed the effective assignment. |

Compatibility rules:

- Existing `status: pending | accepted | declined` remains the swap decision field.
- Accepting a swap does not create a bed assignment change.
- `status: accepted` with no `completedOverrideId` is displayed as `Accepted — assignment change pending`.
- `status: accepted` with a valid linked override is displayed as `Completed`.
- Declined swaps cannot have completion fields.
- Existing issue records do not need migration: missing `issueReviewStatus` derives as `open`.
- Issue review or resolution never changes assignments, patient data, acuity, or flags.

## New Server Record: Manual Assignment Override

Purpose: keep a durable history row for one deliberate bed reassignment layered over the generated baseline. Its lifecycle fields may change from active to superseded, but the row is not deleted or overwritten with a different move. Routine board responses expose only rows whose status is active, grouped into `activeAssignmentOverridesByBedId`.

| Field | Purpose |
| --- | --- |
| `id` | Stable override ID. |
| `shiftId` | Active shift that owns the override. |
| `baselineAssignmentResultId` | Assignment result against which the move was proposed. |
| `bedId` | Bed whose effective nurse assignment changes. |
| `fromNurseId` | Effective nurse immediately before the move. |
| `toNurseId` | Effective nurse after the move. |
| `createdByProfileId` | Charge nurse profile that confirmed the move. |
| `createdAt` | Server timestamp. |
| `status` | `active` or `superseded`. |
| `supersededAt` | Optional time a later override or assignment rerun replaced it. |
| `serverSequence` | Server-assigned ordering value used to make same-bed history deterministic. |
| `relatedSwapRequestId` | Optional accepted swap request explicitly completed by this move. |
| `warningAcknowledgements` | Non-blocking warnings acknowledged for this specific move. |

Rules:

- One server transaction validates and appends the override against current shift state.
- The shift must be active, connected, owned by the acting charge nurse, and still use `baselineAssignmentResultId`.
- `bedId`, `fromNurseId`, and `toNurseId` must still exist in the shift.
- The bed must be occupied and currently assigned to `fromNurseId`.
- `toNurseId` must be different and eligible through current generated room coverage.
- A red bed cannot move to an LPN.
- A later override for the same bed supersedes the earlier active row and inserts a new active row in the same transaction.
- The server enforces at most one active override for each `(shiftId, bedId)` pair.
- Superseded history stays in the server table and is loaded only for an authorized audit or linked-request view, not for normal board rendering.
- Hard validation failures are not stored as overrides.
- Non-blocking workload warnings may be stored only with explicit acknowledgements.
- Joined nurses receive only the effective nurse-scoped result, not the full override audit history.

Recommended indexes and constraint:

- Index `(shiftId, bedId, serverSequence)` for ordered per-bed history.
- Index `relatedSwapRequestId` for request detail.
- Partial unique constraint on `(shiftId, bedId)` where `status = active`.

### App-Facing Active Override Dictionary

Purpose: support efficient effective-assignment reads without duplicating the complete server history in React state.

Conceptual shape:

```text
activeAssignmentOverridesByBedId
  bed-a -> current active override for bed-a
  bed-b -> current active override for bed-b
```

Conceptual type:

```ts
type ActiveAssignmentOverridesByBedId = Record<
  string,
  ManualAssignmentOverride
>;
```

Rules:

- Values are keyed by the same stable bed IDs used by generated bed assignments.
- Superseded rows never appear in this dictionary.
- A new same-bed override replaces that bed's dictionary value after the server transaction succeeds.
- If a rerun supersedes an override without replacing it, that bed key is removed and effective assignment falls back to the new generated baseline.
- The dictionary is derived from authorized server state and is not a second audit-history source of truth.

## Embedded Record: Override Warning Acknowledgement

Purpose: prove which warning was shown and acknowledged for one confirmed override without hiding the resulting active flag.

| Field | Purpose |
| --- | --- |
| `id` | Stable acknowledgement ID. |
| `warningType` | Existing compatible warning or flag type. |
| `message` | Plain snapshot of the warning shown at confirmation. |
| `nurseId` | Optional affected nurse. |
| `bedId` | Optional affected bed. |
| `acknowledgedByProfileId` | Charge profile that acknowledged it. |
| `acknowledgedAt` | Server timestamp. |

Rules:

- Acknowledgement is scoped to one override and warning snapshot.
- It does not remove current flags or acknowledge future warnings.
- It is not a general-purpose alert-dismissal system.

## New Server Record: Nurse Request Message

Purpose: store one chronological message in one issue or swap request thread.

| Field | Purpose |
| --- | --- |
| `id` | Server message ID. |
| `shiftId` | Active shift owning the request. |
| `requestId` | Existing nurse request that owns the thread. |
| `authorProfileId` | Signed-in author. |
| `authorRole` | `charge_nurse` or `requesting_nurse`. |
| `body` | Trimmed message body within a documented length limit. |
| `createdAt` | Server timestamp used for ordering. |
| `clientMutationId` | Optional short-lived idempotency key to prevent duplicate retries. |

Authorization rules:

- The shift's owning charge profile can read and add messages for that shift's requests.
- A linked nurse profile can read and add messages only when the request's `requestingNurseId` matches that nurse access record.
- Signed-out users, unrelated nurses, and users from another shift cannot read or post.
- Messages are append-only in Phase 8: no editing, deletion, reactions, attachments, mentions, or read receipts.
- Message bodies are not copied into push payloads.
- Posting requires a server connection; Phase 8 does not queue messages offline.

Relationship:

```text
Active Shift
  └─ Nurse Request
       ├─ Request lifecycle fields
       └─ Nurse Request Messages (chronological)
```

## Derived Models

### Effective Assignment

Purpose: give all Phase 8 consumers one consistent view of the current assignment.

Derivation:

1. Start with `assignmentResult.bedAssignments`.
2. For each bed, read `activeAssignmentOverridesByBedId[bedId]`.
3. Use the active override's `toNurseId` when present; otherwise retain the generated nurse ID.
4. Recalculate nurse loads and assignment flags from the result.
5. Scope the result for joined nurses through the existing access boundary.

Performance rule:

- Routine board derivation must not flatten or scan the full override history.
- Historical rows are queried separately only when a request or audit view needs them.

Consumers:

- Charge floor board.
- Joined nurse assignment.
- Assignment flags.
- Board snapshot.
- Swap completion display.

### Proposed Override Preview

Purpose: show the charge nurse what a move would do before it is saved.

Planned fields:

| Field | Purpose |
| --- | --- |
| `bedId` | Bed being moved. |
| `fromNurseId` | Current effective owner. |
| `toNurseId` | Proposed owner. |
| `blockingReasons` | Eligibility or stale-state failures that prevent confirmation. |
| `warnings` | New or worsened non-blocking flags requiring acknowledgement. |
| `resultingLoadSummary` | Before/after load for affected nurses. |

Rules:

- This is temporary screen state, not saved shift state.
- The server repeats validation when the move is confirmed.

### Swap Completion Display State

Derived from existing and new request fields:

| Condition | Display |
| --- | --- |
| `status = pending` | Pending |
| `status = declined` | Declined |
| `status = accepted` and no linked override | Accepted — assignment change pending |
| `status = accepted` and linked override exists | Completed |

## Presentation-Only State

The following remain local UI state and are not stored in server models:

- Revealed bed-row action and selected move bed ID.
- Move-picker open/closed state for the accessible alternative.
- Override confirmation and warning acknowledgement state before save.
- Selected nurse or doctor side in tablet split view.
- Current window width, orientation, and layout breakpoint.
- Share preview open/closed, capture progress, and temporary image URI.
- Screen-reader focus targets.
- List measurement or performance diagnostics.
- Superseded override history that has not been explicitly requested by an authorized detail view.

## Board Snapshot Data Boundary

- The snapshot renders from the current effective charge board already authorized on the device.
- It is a temporary local image used by the native share sheet.
- NurseFlow does not upload it, add a database record, add thread attachments, or store a share history.
- The OS or chosen destination may retain a shared file after the user confirms sharing; the preview must explain this boundary.
- Temporary capture cleanup is an implementation detail, not shift state.

## Realtime and Notification Effects

- A successful override updates the active shift and refreshes affected charge and joined-nurse views through the existing realtime boundary.
- A successful issue-state, swap-completion, or thread-message write refreshes only authorized request consumers.
- Existing notification routing may add safe generic event types for a new thread message, issue state change, or completed swap if implementation confirms they are useful.
- Notification payloads contain routing IDs and generic copy, never message bodies or patient details.
- Push events remain background awareness; opening them reloads server-fresh state.

## Migration and Compatibility

- Missing `activeAssignmentOverridesByBedId` means an empty dictionary.
- Existing shifts begin with no server override rows.
- Missing `issueReviewStatus` on an issue means `open`.
- Existing swap statuses retain their meanings.
- Existing requests begin with an empty thread unless prior request text is intentionally displayed as the request's original message, not duplicated as a thread message.
- Existing assignment results remain valid and do not require conversion.
- Existing app reads fall back to generated assignments until active override rows exist.
- Existing joined-nurse authorization continues to return only nurse-scoped data.

## Explicitly Not Modeled in Phase 8

- Production optimizer jobs, objective weights, or solver traces.
- AI suggestions.
- Offline write queues or conflict-merging logs.
- Global chat conversations, channels, attachments, reactions, or read receipts.
- Persisted board snapshots or share history.
- Tablet preferences in shift, profile, or floor-template records.
- EHR/EMR, automated acuity, multi-hospital, or handoff-note records.

# Phase 8 App and Server Touchpoints

Task: Phase 8 Task 0.2, Confirm Existing App and Server Touchpoints

This note maps the existing NurseFlow code and server setup before Phase 8 runtime work begins. It is documentation only. No component, route, state, schema, dependency, or runtime behavior changes in this task.

## Scope Reminder

Phase 8 adds charge-nurse bed assignment overrides, request-scoped threads and lifecycle clarity, a local board snapshot share flow, responsive tablet layouts, accessibility work, and measured large-floor performance cleanup.

Phase 8 preserves the Phase 1 assignment generator, Phase 5 server-owned active shift, Phase 6 nurse-scoped access and realtime behavior, and Phase 7 notification routing. It does not add the Phase 9 production assignment optimizer, global chat, an offline write queue, AI, EHR/EMR integration, automated acuity, multi-hospital tools, or handoff notes.

## Current Authoritative Data Boundaries

### Active Shift Snapshot

`src/types/models.ts` defines `Shift`. Its current assignment-related fields are:

- `assignmentResult`, containing generated teams, generated room coverage, and generated bed assignments.
- `flags`, currently generated from that assignment result.
- `nurseRequests`, currently stored as an optional array inside the shift snapshot.

`ActiveShiftRecord` wraps that `Shift` as `shiftSnapshot`. The Supabase `active_shifts` table in `docs/phase-5/supabase-auth-setup.md` stores the snapshot in one `jsonb` column.

`src/services/serverWorkspaceRepository.ts` currently:

- Maps `active_shifts.shift_snapshot` into `ActiveShiftRecord.shiftSnapshot`.
- Serializes the complete `Shift` object through `getActiveShiftPayload`.
- Uses `saveServerActiveShift` for broad charge-nurse snapshot saves.

Compatibility rule:

- Phase 8 override history must not be inserted into `shift_snapshot`.
- `activeAssignmentOverridesByBedId` is a derived server response beside the snapshot, not a field that `getActiveShiftPayload` should write back.
- Task 1.1 should extend `ActiveShiftRecord` or the server workspace response with the active dictionary, and `ServerWorkspaceContext` should expose it separately from the persisted `Shift` snapshot.
- Keeping the projection separate prevents a later broad `saveActiveShift` call from accidentally overwriting or persisting server-owned override history.

### Override History

There is no current override table, repository, RPC, or context action.

The future Phase 8 boundary should be:

```text
manual_assignment_overrides server rows
  -> authorized active-row query
  -> activeAssignmentOverridesByBedId
  -> effective assignment helper
  -> charge and joined-nurse views
```

The focused server transaction belongs in a new Phase 8 Supabase setup note and a focused repository function. It must not be implemented as a screen calling Supabase directly or as a client rewrite of the entire active shift snapshot.

### Request Data and Thread Data

Current issue and swap requests remain inside `shift_snapshot.nurseRequests`:

- `docs/phase-6/supabase-request-setup.md` appends joined-nurse issue and swap requests to the JSON array through focused RPCs.
- The same setup note updates pending swap status through `resolve_shift_nurse_swap_request`.
- `src/services/serverWorkspaceRepository.ts` wraps those RPCs.
- `src/store/ServerWorkspaceContext.tsx` refreshes charge or joined-nurse state after successful request writes.

Phase 8 issue lifecycle and swap completion fields extend those existing request objects for compatibility.

Request thread messages are different. They should be append-only rows in a new server table, loaded through request-scoped functions. They must not be appended to the active-shift JSON array and must not be mixed into the global workspace payload.

## Assignment Generation and Effective Assignment

### Generator That Must Stay Unchanged

`src/utils/assignmentTeams.ts` owns the current deterministic local generator:

- `generateBalancedTeams`
- `generateRoomCoverage`
- `generateBedAssignments`
- `generateLocalAssignmentResult`

Phase 8 must not change these rules. The returned `AssignmentResult` remains the generated baseline.

### New Effective-Assignment Boundary

There is no existing shared helper for applying manual overrides. Current consumers read `assignmentResult.bedAssignments` directly.

Task 1.1 should add one small pure helper, likely under `src/utils/`, that accepts:

- The generated `AssignmentResult`.
- `activeAssignmentOverridesByBedId`.

It should return or expose effective bed ownership without mutating the generated result. Every consumer below must use this boundary rather than independently reimplementing override lookup.

Likely new file:

- `src/utils/effectiveAssignment.ts`

Compatibility rules:

- A missing dictionary means no active overrides.
- A missing bed key falls back to the generated nurse assignment.
- Generated teams and generated room coverage remain unchanged.
- Routine reads never load or scan superseded history.

## Current Effective-Assignment Consumers

| Consumer | Current behavior | Phase 8 touchpoint |
| --- | --- | --- |
| `src/screens/FloorBoardScreen.tsx` | `getBedAssignmentNurseName` and `getNurseWorkloads` read generated `bedAssignments` directly. | Read effective ownership for bed labels and nurse loads; keep generated team and room coverage display unchanged. |
| `src/utils/assignmentFlags.ts` | Generates capacity, coverage, RN, understaffed, and imbalance flags from an `AssignmentResult`. | Receive an effective assignment result or effective bed assignments so override warnings and current flags agree. |
| `src/screens/FlagsScreen.tsx` | Reads persisted `activeShift.flags`. | Display current effective-assignment flags without confusing them with request lifecycle states. |
| `src/utils/nurseAssignmentView.ts` | Local/development helper filters generated `bedAssignments`. | Use the shared effective boundary if this helper remains in use. |
| `get_joined_nurse_assignment_view` in `docs/phase-5/supabase-auth-setup.md` | Builds `assignedBeds` from `shift_snapshot.assignmentResult.bedAssignments`. | Overlay the authorized active override rows before returning one nurse's beds. Never return the full dictionary or history to the joined nurse. |
| `submit_joined_nurse_swap_request` in `docs/phase-6/supabase-request-setup.md` | Validates that `sourceBedId` belongs to the nurse by scanning generated bed assignments. | Validate against effective ownership so a nurse cannot request a swap for a bed moved away, and can request one for a bed moved to them. |
| `docs/phase-7/supabase-notification-event-setup.md` | Detects assignment changes by diffing generated bed-assignment arrays in old/new shift snapshots. | Override completion must enqueue affected-nurse assignment events from the successful focused transaction or an override-table hook; the unchanged baseline snapshot cannot prove the move. |
| Board snapshot preview | Does not exist. | Render the effective board, not the generated baseline or override history. |

## Assignment Rerun Touchpoint

`src/screens/AssignmentReviewScreen.tsx` currently performs one broad flow:

1. Calls `generateLocalAssignmentResult`.
2. Generates flags.
3. Saves the complete next `Shift` through `saveActiveShift`.

Once active override rows exist, that broad client save cannot safely supersede them by itself. Task 1.8 needs a focused charge-nurse server action that atomically:

- Confirms the expected current assignment baseline and shift ownership.
- Saves the newly generated assignment and flags snapshot.
- Supersedes active override rows tied to the old baseline.
- Returns the refreshed snapshot and an empty/rebuilt active override dictionary.

The rerun screen must warn first when active overrides exist. Cancelling preserves both the baseline and active overrides.

## Flags and Warning Touchpoints

`src/utils/assignmentFlags.ts` is the existing pure flag generator and should remain the shared source for charge-facing assignment warnings where its rules apply.

Risks:

- Persisted `shift.flags` can become stale when an override is stored outside the shift snapshot.
- The charge board and Flags screen must not use different effective-assignment calculations.
- A client preview cannot be the final authority because another session may change the bed before confirmation.
- The server must repeat hard eligibility and current-owner checks, while the app repeats the effective flag calculation after refreshed server state returns.
- Warning acknowledgement records explain why charge proceeded; they do not remove a still-active flag.

Task 1.2 must choose one explicit view boundary for effective flags so derived app-only flags are not accidentally written back as override history.

## Charge Board and Drag Touchpoints

`src/screens/FloorBoardScreen.tsx` currently:

- Uses `WorkflowListScreen` with one outer item per doctor side.
- Builds all rooms and beds inside each side with nested array mapping.
- Builds the nurse workload summary in the list header.
- Has no move mode, selected bed, drop target, share action, or responsive split view.

Phase 8 likely changes this screen and may extract focused components or view-model helpers. Named prop types should be used for new component boundaries.

Existing packages already include:

- `react-native-gesture-handler`
- `react-native-reanimated`

Task 1.5 should verify that the existing versions and app root are sufficient before adding anything. The accessible move picker from Task 1.4 remains required even when drag gestures work.

## Request Screen and Route Touchpoints

### Charge Flow

- `src/screens/FlagsScreen.tsx` lists requests and opens `/request-detail?requestId=...`.
- `src/screens/RequestDetailScreen.tsx` reads the selected request from the charge `activeShift` and currently offers Accept/Decline only for pending swaps.
- `src/utils/nurseRequestDisplay.ts` derives the current request labels and bed context.
- `src/utils/nurseRequests.ts` contains local compatibility helpers for request lists and status changes.

Phase 8 adds issue lifecycle labels, accepted-versus-completed swap labels, linked override summaries, and the charge thread composer here.

### Joined-Nurse Flow

`src/screens/RegularNurseWorkspaceScreen.tsx` currently:

- Displays nurse-scoped `assignedBeds` and `requestHistory`.
- Lets the nurse select one currently assigned source bed and submit a message-only swap request.
- Does not ask the nurse to nominate a destination nurse.
- Displays request rows as static content rather than opening a detail route.

Phase 8 should make those nurse-owned rows open a nurse-scoped request detail/thread view. It must not reuse the charge screen in a way that exposes `activeShift`, charge-only actions, the full board, or another nurse's thread.

Route decision for Task 2.4:

- Either make `src/app/request-detail.tsx` role-aware with explicitly separate charge and nurse loaders, or add a dedicated nurse request route.
- Do not infer authorization from a route parameter; the server request-thread function must authorize the signed-in profile.

## Request Thread Service and Realtime Touchpoints

There is no current request-message repository or subscription.

Likely focused additions:

- A request-thread repository under `src/services/` for authorized list/append operations.
- A request-thread state hook or small context scoped to the detail screen.
- A request-message realtime subscription filtered to the selected request, or a refetch signal that cannot expose other threads.

Do not add all thread messages to `ServerWorkspaceContext` or `JoinedNurseAssignmentView`. That would grow routine workspace and nurse assignment payloads with data those screens do not need.

Current `src/services/realtimeWorkspaceRepository.ts` listens only to:

- `active_shifts` updates for the charge shift.
- `active_shifts` and `shift_nurse_access` changes for a joined nurse.

Compatibility choices:

- A successful override can touch `active_shifts.updated_at` so existing charge and joined-nurse listeners refetch their authorized views, while the override table remains server-owned.
- Request-message inserts need a narrow request-thread subscription or explicit refetch; a full workspace refresh is unnecessary.
- Listeners must still clean up on screen exit, sign-out, shift end, access removal, and Fast Refresh.

## Server Workspace Context Touchpoints

`src/store/ServerWorkspaceContext.tsx` currently owns:

- Charge workspace and active-shift loading.
- Broad active-shift saves.
- Joined-nurse scoped assignment loading.
- Request submission and swap decision actions.
- Charge and joined-nurse realtime connection states.
- Shared save status and error text.

Likely Phase 8 additions:

- Expose `activeAssignmentOverridesByBedId` separately from `activeShift`.
- Add a focused charge action for previewing/confirming an override.
- Add focused issue lifecycle and swap-completion actions.
- Refresh the workspace after successful charge writes and the joined-nurse view after relevant realtime signals.

Request thread messages should stay screen/request-scoped unless implementation proves a shared context is necessary.

Connection risk:

- Current context actions validate authentication, role, access, and configured Supabase state, but they do not all explicitly require `realtimeConnectionState === live` before starting a write.
- Phase 8 move and message controls must disable while disconnected and show plain reconnect copy.
- The server remains final authority even if the UI believes it is connected.
- Phase 8 must not create an offline write queue.

## Notification Touchpoints

`src/utils/notificationTap.ts` and `src/store/NotificationTapContext.tsx` already support safe routing to request detail, flags, the floor board, and joined-nurse assignment after current server checks.

Phase 8 compatibility risks:

- The Phase 7 assignment-diff trigger only compares generated snapshot bed assignments, so it will not detect an override stored in a separate table.
- The focused override transaction should enqueue generic assignment-update events for affected linked nurses only after the move succeeds.
- Request-message and lifecycle notifications, if Task 2.7 confirms they are useful, should be created from successful server writes.
- Notification payloads should contain route IDs and generic copy, never message bodies, patient details, the active override dictionary, or override history.
- A joined-nurse thread notification needs a nurse-authorized target path; the current charge request-detail recovery logic reads `activeShift.nurseRequests` and cannot be reused blindly for joined access.

## Board Sharing Touchpoints

The app already uses React Native's native `Share` API in `src/screens/NurseInvitesScreen.tsx`, and a reusable `ShareIcon` exists in `src/components/workflow/Icons.tsx`.

There is no board-capture dependency or preview route. `react-native-view-shot` is not currently installed.

Likely Phase 8 touchpoints:

- `src/screens/FloorBoardScreen.tsx` for the charge-only entry action.
- A new board snapshot preview screen and thin route under `src/app/`.
- A focused static snapshot component that receives an effective board view model rather than capturing interactive scroll chrome.
- `package.json` and Expo dependency installation only after Task 3.1 verifies current official compatibility.

The snapshot remains a temporary local file. No server table, upload service, share-history state, or request attachment belongs in Phase 8.

## Responsive Layout and Performance Touchpoints

`src/components/workflow/WorkflowScreen.tsx` and `WorkflowListScreen.tsx` currently use fixed spacing and do not provide a shared maximum-width or compact/expanded boundary.

`src/screens/HomeScreen.tsx` already demonstrates a small local `useWindowDimensions` breakpoint, which can inform but should not become an unrelated global redesign.

Likely Phase 8 touchpoints:

- Add a small reusable responsive content boundary or hook only after Task 4.1 defines one breakpoint.
- Adapt `FloorBoardScreen`, `RequestDetailScreen`, and `RegularNurseWorkspaceScreen` without changing their authorization boundaries.
- Keep setup routes readable with a centered maximum width rather than redesigning them.

Performance risk:

- The floor board virtualizes doctor-side items, but every room and bed within a side is rendered by nested mapping.
- Nurse workload rows are all built in the list header.
- The current joined-nurse request history uses a nested `ScrollView` and maps all rows.
- A future thread needs an appropriate list boundary for long histories.

Task 5.2 must measure a representative large floor and long thread before Task 5.3 changes list structure or adds a list library. The active bed-keyed override projection prevents override history from becoming part of routine render cost.

## Likely Files and Resources Affected Later

### Existing app files

- `src/types/models.ts`
- `src/store/ServerWorkspaceContext.tsx`
- `src/services/serverWorkspaceRepository.ts`
- `src/services/realtimeWorkspaceRepository.ts`
- `src/utils/assignmentFlags.ts`
- `src/utils/nurseAssignmentView.ts`
- `src/utils/nurseRequestDisplay.ts`
- `src/utils/nurseRequests.ts`
- `src/screens/AssignmentReviewScreen.tsx`
- `src/screens/FloorBoardScreen.tsx`
- `src/screens/FlagsScreen.tsx`
- `src/screens/RequestDetailScreen.tsx`
- `src/screens/RegularNurseWorkspaceScreen.tsx`
- `src/components/workflow/WorkflowScreen.tsx`
- `src/components/workflow/WorkflowListScreen.tsx`
- `src/app/request-detail.tsx` or a new nurse request-detail route

### Likely new focused files

- `src/utils/effectiveAssignment.ts`
- A manual-override repository or focused functions in the existing server workspace repository.
- A request-thread repository and request-scoped subscription helper.
- A board snapshot component, preview screen, and route.
- A small responsive layout helper or primitive if Task 4.1 justifies it.
- A Phase 8 Supabase setup note for override history, request messages, authorization, indexes, transactions, and realtime behavior.

### Existing server documentation that later implementation must reconcile

- `docs/phase-5/supabase-auth-setup.md`
- `docs/phase-6/supabase-request-setup.md`
- `docs/phase-7/supabase-notification-event-setup.md`

## Compatibility Risk Checklist

- Do not mutate the generated `AssignmentResult` when applying an override.
- Do not serialize `activeAssignmentOverridesByBedId` or override history into `shift_snapshot`.
- Do not let broad `saveActiveShift` writes delete or overwrite focused override rows or thread messages.
- Do not let board, workload, flags, joined-nurse view, swap-source validation, notifications, or sharing disagree about effective bed ownership.
- Do not allow more than one active override per shift and bed.
- Do not mark an accepted swap completed until its linked override transaction succeeds.
- Preserve a completed request when its override is later superseded, but label that the assignment changed again.
- Do not expose full override history, full active shift, or another nurse's thread through joined-nurse responses.
- Do not rely on current generic snapshot-diff notifications to detect separate override rows.
- Do not permit move or message writes while disconnected or imply they are queued.
- Do not add drag-only behavior without the accessible move picker.
- Do not capture only the visible board viewport or persist shared images to NurseFlow.
- Do not optimize lists before measuring a representative large floor and thread.
- Do not add Phase 9 optimizer behavior.

## Task 0.2 Validation Result

- Generated assignment ends at `AssignmentResult`; Phase 8 effective assignment begins in one pure helper that combines the generated baseline with the active bed-keyed projection.
- Existing issue/swap request lifecycle data remains in `shift_snapshot.nurseRequests`; new thread messages are append-only server rows loaded only for an authorized request.
- The likely app files, server functions, routes, realtime signals, notification paths, sharing boundary, responsive primitives, and compatibility risks are documented above.
- No runtime implementation, schema migration, dependency, or app configuration was added.

### 2026-07-26 Revalidation

- Rechecked the documented boundaries against `Shift`, `ActiveShiftRecord`, the
  assignment generator and flag helpers, board and joined-nurse consumers,
  request RPC wrappers, realtime subscriptions, and notification routing.
- Confirmed that Phase 8 override, effective-assignment, and request-message
  runtime symbols are still absent, so Tasks 1.1 and 2.1 remain the correct
  implementation starting points.
- Confirmed the existing gesture and animation dependencies are present and
  that no board-capture dependency has been added early.
- Confirmed the break-scheduling removal did not change the generated
  assignment, request, realtime, or notification boundaries described here.
- This revalidation changed documentation only; it added no runtime behavior,
  schema migration, dependency, or app configuration.

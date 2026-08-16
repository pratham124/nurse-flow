# Phase 9 Data Model

This document plans the Phase 9 model changes for the production assignment
optimizer. It describes contracts and persistence only; it is not implementation
code.

Phase 9 changes where and how the generated baseline is calculated. It does not
replace the Phase 8 effective-assignment model: the generated result remains the
baseline, and active manual overrides remain a separate bed-keyed projection.

## Chosen Architecture

Phase 9 uses a separate Python assignment-optimizer service with the official
OR-Tools Python package.

The concrete FastAPI, Cloud Run, authentication, credential, resource,
deadline, benchmark, deploy, and rollback choices are frozen in
`docs/phase-9/python-service-boundary.md`.

```text
Expo app
  -> authenticated Python optimizer endpoint
  -> Supabase user-authorized prepare action
  -> Python input normalization and OR-Tools solve
  -> Supabase service-authorized finalization transaction
  -> active-shift realtime refresh
  -> existing charge and joined-nurse screens
```

Boundaries:

- Python lives in a separately deployable backend service in the repository; it
  is not imported into or executed by the React Native app.
- The app sends the current Supabase access token, shift ID, client mutation ID,
  and concurrency preconditions to the Python endpoint.
- The Python service verifies the Supabase JWT and never stores it as optimizer
  data.
- The prepare action runs with the user's authorization context and proves that
  the caller owns the active shift before releasing calculation input.
- The Python service uses a server-only credential for finalization. That
  credential is stored only in the deployed service environment and never in an
  `EXPO_PUBLIC_` variable or mobile bundle.
- The finalization action is not executable as a normal mobile-user write. This
  prevents a modified client from bypassing OR-Tools and submitting invented
  assignments.
- Supabase remains the source of truth and transaction owner. The Python service
  owns calculation, not long-term shift persistence.

## Modeling Rules

- The active shift snapshot remains the authoritative source of optimizer input.
- The phone sends an action request and concurrency preconditions, not a trusted
  precomputed assignment result.
- Normalize and validate all solver input on the backend.
- Keep the existing `AssignmentResult` fields so Phase 1-8 consumers remain
  compatible.
- Give every successful run a new server-generated result ID.
- Keep optimizer coordination metadata outside `shiftSnapshot`.
- Store no duplicate patient details, diagnosis text, full shift snapshot, or
  solver input payload in optimizer run metadata.
- Atomically commit the new baseline, generated flags, run status, and manual
  override supersession.
- Never persist a partial, stale, timed-out, or invalid optimizer result.
- Treat UI loading, progress, modal, and retry state as presentation state.

## Existing Domain Records Preserved

### Shift

No new Phase 9 field is required on the shift snapshot.

The optimizer reads the existing fields:

- shift ID and status;
- admitting doctor side and side-based load limits;
- doctor sides, rooms, beds, and their IDs and relationships;
- nurses, license types, experience levels, and max patient loads;
- occupied bed states and acuity.

Patient initials, age, sex, and diagnosis remain display information. Phase 9
must not infer acuity or staffing suitability from diagnosis or other free text.

### Assignment Result

The saved output keeps these established fields:

| Field | Phase 9 rule |
| --- | --- |
| `id` | New opaque server-generated ID for every successful run. It is immutable and becomes the manual-override baseline ID. |
| `generatedTeams` | Existing stable array contract with team ID, label, and nurse IDs. |
| `roomCoverage` | Existing stable array contract with coverage ID, room ID, and eligible nurse IDs. |
| `bedAssignments` | Existing stable array contract with assignment ID, occupied bed ID, and eligible nurse ID. Unassigned beds are omitted and inferred for flags. |

Compatibility rules:

- Existing readers do not need an `optimizerResult` alternative.
- The result ID must change on rerun even when the final assignment happens to
  be identical.
- Team, coverage, and bed-assignment IDs are generated on the server and stable
  within one immutable result.
- Output arrays use canonical floor and nurse order rather than incidental query
  order.
- The result contains no solver variables, candidate matrix, logs, or joined
  nurse authorization data.

### Flags

The existing `Flag[]` contract is preserved.

- Flags are calculated from the same committed baseline that is saved to the
  shift.
- Existing types such as `unassigned_bed`, `rn_required`,
  `no_eligible_coverage`, `over_side_load_limit`, `team_imbalance`, and
  `understaffed` remain supported.
- Flag calculation must not disagree with the optimizer output at commit time.
- Phase 8 continues to recalculate effective flags after manual overrides.

### Manual Assignment Overrides

No Phase 9 history shape is required.

- `baselineAssignmentResultId` points to the new server-generated result ID.
- A successful rerun supersedes active override rows in the same finalization
  transaction that saves the new result.
- A failed or stale run does not supersede active overrides.
- Completed swap history keeps its existing linked override and lifecycle rules.

## New Optimizer Action Contract

The app request should contain only the minimum action data:

| Field | Purpose |
| --- | --- |
| Shift ID | Identifies the active shift to optimize. |
| Client mutation ID | Makes a retry idempotent. |
| Expected shift revision | Prevents a result calculated from an older shift snapshot from committing. Prefer the server record's current revision or `updatedAt` precondition rather than a client-generated counter. |
| Expected baseline result ID | Optional on the first run; required on rerun so a stale rerun cannot replace a newer baseline. |

The authenticated profile ID, shift ownership, current snapshot, Python/OR-Tools
optimizer version, run time, and result IDs are server-derived.

The client must not send `nextShift`, `generatedTeams`, `roomCoverage`,
`bedAssignments`, flags, author profile ID, or optimizer objective values as
trusted write input.

## End-to-End Assignment Flow

### 1. Mobile preflight

- The charge nurse reviews assignment inputs on the existing Assignment Review
  screen.
- Existing client validation catches obvious missing data before making a
  request.
- The app requires a connected, signed-in charge session and creates one client
  mutation ID.
- Initial assignment sends no expected baseline ID. Rerun sends the current
  baseline ID and preserves the Phase 8 clear-moves confirmation.

### 2. Python endpoint authentication

- The Expo app calls the Python HTTPS endpoint with its Supabase bearer token
  and minimal action fields.
- The service verifies token signature, issuer, audience, expiry, and subject
  using Supabase's published signing keys or supported server verification
  method.
- An invalid or expired session stops here without starting OR-Tools.

### 3. Supabase prepare action

- The Python service forwards the user's authorization context to the prepare
  action.
- Supabase derives the charge profile, verifies active-shift ownership, checks
  the expected baseline, captures the current shift revision, and enforces
  idempotency.
- Supabase creates or reuses the optimizer run record and returns the authorized
  current snapshot for that run.
- Joined nurses and unrelated charge accounts are rejected here even if they
  reach the Python endpoint.

### 4. Normalize and solve in Python

- Python converts the authorized snapshot into the canonical solver input.
- Validation rejects broken IDs, invalid relationships, missing acuity, invalid
  loads, or unsupported floor size before solving.
- OR-Tools applies the hard constraints and lexicographic objective stages.
- Python converts the optimal decisions into the established assignment result
  and flag contracts, then independently validates them.
- Timeout or invalid output becomes a failed run result; it is never treated as
  a partial assignment save.

### 5. Service-authorized finalization

- Python calls the protected finalization action with the run ID and validated
  result using its server-only credential.
- Supabase locks the run and active shift, then rechecks the owner, active
  status, input fingerprint, shift revision, expected baseline, result IDs, and
  hard constraints.
- If anything changed during the solve, Supabase marks the run stale and changes
  no assignment, flags, or overrides.
- On success, one transaction saves the new baseline and matching flags, marks
  the run succeeded, and supersedes active manual overrides only for a rerun.

### 6. Refresh existing app views

- The Python endpoint returns only the typed saved, stale, invalid, timed-out,
  unavailable, or failed outcome needed by the app.
- The app reloads the Supabase workspace instead of trusting result data from
  its request body.
- A successful commit triggers the existing realtime and generic notification
  paths.
- The charge board consumes the normal assignment result plus active overrides;
  joined nurses continue to receive only nurse-scoped effective assignments.

### 7. Retry and recovery

- Repeating the same client mutation ID with identical input returns the same
  committed outcome.
- Reusing the ID for different input is rejected.
- A stale run reloads current shift state and requires review before a fresh
  mutation.
- Failed, timed-out, or unavailable runs leave the previous baseline and manual
  overrides unchanged.

## Normalized Optimizer Input

The calculation service builds a temporary normalized model from the current
server shift. This model is not stored as a second shift record.

| Input group | Required normalized data |
| --- | --- |
| Floor order | Stable doctor-side, room, and bed indices. |
| Nurses | Stable nurse index, ID, license, experience rank, and hard max load. |
| Occupied beds | Bed ID, room ID, doctor-side ID, stable index, acuity, and integer acuity weight. |
| Teams | Dynamic stable team count from the frozen optimizer rules: one team for one nurse; otherwise `max(2, ceil(nurse count / 4))`, with alphabetical identities and evenly bounded membership sizes. |
| Side guidance | Admitting side and current admitting/non-admitting load ranges used for compatible preferences and flags, not as a replacement for hard max load. |

Normalization rules:

- Reject duplicate or missing IDs and broken room, bed, side, or nurse
  relationships.
- Reject occupied beds without acuity through the existing assignment validation
  path before invoking the solver.
- Exclude empty beds from candidate variables.
- Use a documented integer acuity scale, proposed as green `1`, yellow `2`, red
  `3`, solely for workload comparison.
- Sort by stable IDs only after preserving the app's intentional doctor-side,
  room, bed, and nurse order.

## Constraint and Objective Contract

### Hard constraints

- Every participating occupied bed has exactly one nurse assignment or one
  explicit internal unassigned choice.
- Empty beds have no assignment.
- A nurse's assigned-bed count never exceeds `maxPatientLoad`.
- Red beds can be assigned only to RNs.
- Every occupied room is covered by exactly one generated team.
- A saved bed assignment implies generated room coverage for the same nurse and
  room, and that nurse belongs to the room's one selected team.
- Every nurse appears in exactly one generated team.
- Generated team and room-coverage relationships use only IDs from the current
  shift.

The internal unassigned choice keeps understaffed models solvable. It is not a
saved `BedAssignment`; it is converted into the existing unassigned and
understaffed flags.

### Lexicographic objectives

Solve priorities must be applied in this order, with an exact staged solve or
mathematically proven weights:

1. Minimize unassigned occupied beds.
2. Minimize the highest weighted acuity load assigned to any nurse.
3. Minimize the highest patient count assigned to any nurse.
4. Apply deterministic experience and stable-order tie-breaks, including the
   experienced-RN, mid-RN, new-grad-RN order for otherwise equal red-bed choices.

Later objectives may never worsen an earlier optimum. Exact team-balance,
including equal distribution of the three experience categories without a
combined strength score, room-to-team coverage, and side-guidance tie-break
details must be frozen in the
Phase 9 optimizer rules task before implementation; they may refine only equal
solutions and may not outrank the four roadmap priorities.

## New Assignment Optimizer Run Record

A small server record coordinates retries and safe finalization without
duplicating the shift snapshot.

| Field | Purpose |
| --- | --- |
| ID | Server-generated run identifier. |
| Shift ID | Active shift being optimized. |
| Requested-by profile ID | Authorized charge profile derived from the session. |
| Client mutation ID | Idempotency key; unique for the requester and action scope. |
| Expected shift revision | Revision used to build the normalized input. |
| Expected baseline result ID | Missing for an initial run; prior baseline for rerun. |
| Input fingerprint | One-way canonical fingerprint used to reject key reuse with different input; it is not the input payload. |
| Optimizer version | Exact rules/runtime version used for reproducibility. |
| Status | `running`, `succeeded`, `failed`, or `stale`. |
| Result ID | Present only after a successful commit. |
| Outcome summary | Non-sensitive counts such as assigned and unassigned beds plus a stable error code when needed. |
| Timing fields | Server start/completion times and duration for operational checks. |

Rules:

- Do not store patient initials, diagnosis, the full candidate matrix, or the
  shift snapshot in this record.
- Retrying an identical succeeded mutation returns the existing committed
  result.
- Reusing the same mutation ID with a different fingerprint fails safely.
- A stale or failed record cannot become the shift's assignment baseline.
- Joined nurses cannot read optimizer run records.
- Run records are operational coordination, not an analytics feature or a new
  user-facing history screen.

## Safe Finalization Transaction

Finalization must lock and recheck current server state before writing:

1. The shift still exists, is active, and belongs to the requesting charge
   profile.
2. The shift revision still equals the run's expected revision.
3. The current baseline still equals the expected result ID, including the
   no-baseline initial-run case.
4. Every optimizer output ID and relationship is valid for that current input.
5. Hard constraints and objective summary validation pass independently of the
   client.
6. The new assignment result and matching generated flags replace the snapshot
   baseline.
7. Existing active manual overrides are superseded only for a successful rerun.
8. The run is marked succeeded with its result ID in the same transaction.

If any precondition fails, the run becomes stale or failed and no assignment,
flag, or active-override state changes.

## App-Facing Result States

The repository boundary should distinguish:

| State | Meaning |
| --- | --- |
| Saved | A new baseline committed and refreshed shift data is available. |
| Stale | Shift inputs or the prior baseline changed before finalization. |
| Invalid input | Existing assignment validation or server normalization rejected the shift. |
| Timed out | No proven acceptable result committed within the supported limit. |
| Service unavailable | The optimizer could not be reached; current state remains authoritative. |
| Failed | An internal or output-validation error occurred; nothing committed. |

These are transport/service states. They do not need to be persisted inside the
mobile `Shift` model.

## Realtime, Notifications, and Nurse Scope

- A successful commit updates the existing active shift record so current
  realtime listeners refresh normally.
- Assignment-update notifications reuse Phase 7 generic payloads and contain no
  optimizer input, patient detail, objective values, or run logs.
- The joined-nurse RPC derives only the nurse's beds from the newly committed
  baseline plus active overrides.
- Joined nurses cannot read the full assignment result, optimizer run table, or
  optimization endpoint.

## Explicitly Not Added

- A second `OptimizerAssignmentResult` domain model.
- Client-trusted assignment payloads.
- Solver settings, weights, or strategy preferences in shift/profile records.
- AI prompts, recommendations, confidence scores, or diagnosis interpretation.
- Offline optimizer requests or write queues.
- EHR/EMR, automated acuity, multi-hospital, handoff-note, or advanced analytics
  records.

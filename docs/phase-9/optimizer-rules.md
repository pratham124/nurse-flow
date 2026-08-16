# Phase 9 Frozen Optimizer Rules

Task: Phase 9 Task 0.2, Freeze the Optimizer Rules

This document is the implementation authority for the NurseFlow assignment
optimizer. It removes rule ambiguity before Python, OR-Tools, schema, endpoint,
or mobile integration code is added.

Phase 9 changes how the generated assignment baseline is calculated. It does
not change the existing `AssignmentResult`, flag, manual-override, realtime,
notification, or joined-nurse boundaries.

## Frozen Scope

The optimizer calculates these decisions together:

- which nurse owns each participating occupied bed, or whether the bed must
  remain unassigned;
- which of the existing generated teams contains each nurse;
- which single generated team covers each occupied room;
- which nurses cover each room through membership in that selected team.

The optimizer does not use patient initials, age, sex, diagnosis, request
history, manual-override history, or notification data. It does not infer
clinical meaning and is not AI.

## Supported Input Envelope

One optimizer run supports:

| Input | Supported value |
| --- | --- |
| Doctor sides | Exactly 2 |
| Rooms | 1 to 200 |
| Total beds | 1 to 400 |
| Participating occupied beds | 0 to 400 |
| Nurses | 1 to 40 |
| Nurse max patient load | Whole number from 1 to 12, and no higher than the existing validated side-based maximum |
| Acuity | `green`, `yellow`, or `red` |
| Generated teams | 1 to 10, derived from nurse count |

These are service contract ceilings, not suggested hospital floor sizes. Task
0.3 must benchmark the representative maximum input in the production-like
Python runtime before dependencies or deployment settings are accepted. A
request above a ceiling is `infeasible_input`; the service must not start a
larger best-effort solve or silently truncate data.

## Participating Beds

A bed participates only when all of these statements are true:

1. The bed belongs to a current room and doctor side.
2. Its current bed state belongs to that bed.
3. It is occupied under the existing app rule: trimmed patient initials are
   non-empty.
4. It has one valid acuity.

Every participating bed has exactly one solver choice: one eligible current
nurse or the internal unassigned choice.

Empty beds produce no assignment variable and no `BedAssignment`. An occupied
bed with missing acuity is invalid input; it is not treated as empty or silently
left unassigned. Free-text patient fields never change participation,
eligibility, objective values, or ordering after occupancy is established.

## Canonical Input Order

Normalization captures the intentional ordinal from each authoritative shift
snapshot array before building maps or joining other records. Incidental query,
map, or dictionary order must not replace these ordinals.

The canonical orders are:

1. Doctor sides: snapshot ordinal, then side ID as the defensive tie-break.
2. Rooms: canonical doctor-side ordinal, snapshot room ordinal, then room ID.
3. Beds: canonical room ordinal, numeric `bedNumber`, snapshot bed ordinal,
   then bed ID.
4. Nurses: snapshot nurse ordinal, then nurse ID.
5. Acuity processing: red, yellow, green, then canonical bed order when a
   rule explicitly needs acuity order.
6. Teams: alphabetical label order, from Team A through at most Team J.

The normalizer must attach these ordinals to the temporary normalized model.
Later code may shuffle its collections for a test, but sorting by the captured
keys must restore the same canonical model and fingerprint. Duplicate IDs,
duplicate ordinals, broken relationships, or a record that conflicts with its
captured parent are invalid input.

## Acuity Weights

Weighted workload uses integers only:

| Acuity | Weight |
| --- | ---: |
| Green | 1 |
| Yellow | 2 |
| Red | 3 |

The same scale is used for nurse workload, team workload, objective summaries,
and independent result validation. It is a comparison scale, not a clinical
score. OR-Tools CP-SAT operates on integer models, which fits this contract
without floating-point rounding.

## Hard Constraints

Every accepted result must satisfy all of these constraints:

1. Every participating bed has exactly one eligible nurse or one internal
   unassigned choice.
2. An empty bed has neither a nurse choice nor a saved assignment.
3. Each nurse's assigned-bed count is at most `maxPatientLoad`.
4. A red bed can be owned only by a nurse whose license is `RN`.
5. Every occupied room is covered by exactly one generated team.
6. Every saved bed owner belongs to the one team covering that bed's room and
   appears in the room's generated nurse coverage.
7. Every current nurse belongs to exactly one generated team.
8. Every generated team contains either `floor(nurse count / team count)` or
   `ceil(nurse count / team count)` nurses, so no team is empty and team sizes
   differ by at most one.
9. All nurse, side, room, bed, and relationship IDs come from the same
   authorized normalized input.

The internal unassigned choice is required so a valid but understaffed floor
remains solvable. It is omitted from `bedAssignments` and becomes the existing
unassigned and staffing flags.

## Generated Teams

Team count scales with staffing instead of being limited to two. The frozen
target is at most four nurses per generated team while preserving at least two
teams whenever two or more nurses exist:

```text
if nurse_count == 1:
  team_count = 1
else:
  team_count = max(2, ceil(nurse_count / 4))
```

Under the supported 40-nurse ceiling this produces at most 10 teams. Team
labels use spreadsheet-style alphabetical order beginning with `Team A`; the
current ceiling therefore uses `Team A` through at most `Team J`. Output uses
the existing `GeneratedTeam[]` shape, so no new result model or team-count field
is required.

Every team must receive either the lower or upper even-share nurse count. For
example, 10 nurses produce 3 teams with sizes 3, 3, and 4 in some order. The
later team objectives decide membership, but they cannot produce a 1/1/8 split.

Team membership may balance RN count, total configured capacity, assigned
patient count, assigned acuity, and the distribution of experienced, mid, and
new-grad nurses only in the late objective stages below.

Experience has exactly two uses:

1. Otherwise-equal red-bed owners prefer experienced RN, then mid RN, then
   new-grad RN.
2. Otherwise-equal team solutions spread each experience category across teams.

The optimizer does not combine license, experience, and capacity into an
invented nurse or team "strength score." Team experience balance counts all
current nurses in their existing category, regardless of RN or LPN license.

## Room and Team Coverage

Room-to-team coverage is an explicit solver decision:

- output contains one `RoomCoverage` entry for every current room;
- every occupied room selects exactly one generated team;
- its `nurseIds` are all nurses in that selected team, in canonical nurse
  order, including team members who ultimately own no bed in the room;
- an empty room has an empty `nurseIds` array;
- an occupied room keeps its selected team's coverage even when all its beds
  are unassigned;
- multiple nurses may split a room only when they belong to that same team;
- nurses from two different teams may never own beds in the same room;
- one team may cover multiple rooms on either or both doctor sides;
- no separate room-to-team record is saved.

The selected team is represented through the existing coverage nurse IDs: all
listed nurses belong to one and only one generated team. This preserves the
product relationship `Nurse -> generated team -> generated room coverage ->
beds`, guarantees assignment-implies-coverage, and still permits nurses within
one team to split a room. Existing readers receive the established
`RoomCoverage[]` contract without a new saved room-team field.

## Side-Based Guidance

Side limits remain soft guidance and flag thresholds. They are never a hard
capacity constraint and never outrank `maxPatientLoad`.

For each nurse:

- if the nurse appears in generated coverage for at least one occupied room on
  the admitting side, the applicable guidance maximum is
  `sideLoadLimits.admitting.max`, even when another teammate owns that room's
  beds;
- otherwise the applicable maximum is
  `sideLoadLimits.nonAdmitting.max`;
- guidance excess is `max(0, assigned patient count - applicable maximum)`;
- the range minimum is retained for input validation and display, but it does
  not force extra assignments or create a solver target;
- the existing `over_side_load_limit` flag is calculated after assignment from
  the same applicable maximum.

The optimizer may prefer lower total guidance excess only after the four
roadmap priorities are fixed. It may not leave another bed unassigned, worsen
the maximum acuity load, worsen the maximum patient count, or defeat the
otherwise-equal red-bed experience preference to stay within side guidance.

## Exact Lexicographic Objective

The optimizer uses exact staged solves. It must not approximate these rules
with guessed weighted coefficients.

For each stage, the solver must:

1. solve the current integer model;
2. require the `OPTIMAL` status;
3. record the proven objective value;
4. add an equality fixing that value;
5. replace the objective with the next stage.

The stages are:

1. **Unassigned count:** minimize the number of participating beds using the
   internal unassigned choice.
2. **Maximum nurse acuity load:** minimize the highest sum of acuity weights
   assigned to any nurse.
3. **Maximum nurse patient count:** minimize the highest assigned-bed count for
   any nurse.
4. **Red-bed experience preference:** minimize the sum of the red-bed owner
   ranks `experienced RN = 0`, `mid RN = 1`, `new-grad RN = 2`, and
   `unassigned = 3`. Because stages 1 through 3 are already fixed, this changes
   only otherwise-equal red-bed choices.
5. **Side guidance:** minimize total guidance excess, then the number of nurses
   above their applicable side maximum.
6. **Team balance:** across all generated teams, in order, minimize the
   max-minus-min gap for weighted assigned acuity, assigned patient count, and
   RN count; then minimize the experience-distribution gap; then minimize the
   max-minus-min gap for total configured max-load capacity. Each value is
   fixed before moving to the next. With one team, every gap is zero.

   For each experience category, its gap is the highest team count minus the
   lowest team count. The experience-distribution gap is the sum of the
   experienced, mid, and new-grad gaps. This treats the three categories
   equally instead of inventing conversions between them.
7. **Canonical room teams:** for each occupied room in canonical room order,
   minimize its selected team rank and fix the result before the next room,
   while retaining every earlier optimum.
8. **Canonical bed owners:** for each participating bed in canonical bed order,
   minimize its owner rank and fix the result before the next bed. Canonical
   nurse ranks come first and the internal unassigned rank comes last. Earlier
   stages already fix the count and aggregate safety/balance results.
9. **Canonical team membership:** for each nurse in canonical nurse order,
   minimize the team rank and fix it before the next nurse, while retaining all
   team-balance optima. Team A ranks before Team B, continuing alphabetically
   through the final generated team.

Coverage nurse IDs are then projected from each room's selected team, and
output arrays are ordered canonically without another objective.

### Why a Later Stage Cannot Worsen an Earlier Stage

Suppose stage 1 proves the best unassigned count is `2`. Before stage 2 starts,
the model receives the equality `unassigned_count == 2`. Every solution
considered by stage 2 therefore has exactly two unassigned beds. The same
equality-fixing step is repeated after every stage and substage.

This is stronger and easier to review than one weighted sum. A later stage is
mathematically unable to trade one earlier objective point for any amount of a
later preference.

The official CP-SAT status contract distinguishes `OPTIMAL` from `FEASIBLE`:
`FEASIBLE` means a solution exists but optimality is not proven. Therefore a
`FEASIBLE` result cannot be used to fix a lexicographic stage or committed as a
NurseFlow baseline.

## Deterministic Decisions and IDs

For the same normalized input, frozen rule version, pinned OR-Tools version,
runtime configuration, and deadline, the decision content must match:

- each bed owner or unassigned choice;
- each nurse's team;
- canonical room coverage;
- all objective values.

Canonical per-bed and per-nurse stages make equal aggregate optima unique. The
future service must also use the pinned solver and deterministic runtime
configuration chosen in Task 0.3.

Opaque database identity is intentionally different from decision content.
Every successful run receives a new assignment result ID and new child IDs,
even when the canonical decisions match a previous run. Determinism tests must
compare normalized decisions and objective summaries rather than expecting
server-generated IDs to be equal across successful runs.

## Solver and Service Outcomes

These outcomes are mutually exclusive:

| Outcome | Exact meaning | Commit allowed? |
| --- | --- | --- |
| `optimal` | Every objective stage and canonical substage returned `OPTIMAL`, the result was built, and independent validation passed. The optimum may still contain unavoidable unassigned beds. | Yes, through protected atomic finalization only. |
| `infeasible_input` | Normalization rejected missing, duplicate, malformed, unrelated, unsupported, or over-ceiling input before solving. | No. |
| `timed_out` | The configured total solve deadline expired before every stage was proven `OPTIMAL`. This includes a stage returning `FEASIBLE` or `UNKNOWN` at the deadline. | No; discard any candidate. |
| `internal_failure` | The solver returned `MODEL_INVALID` or `INFEASIBLE` for a validated model that includes unassigned choices, code raised unexpectedly, a fixed stage became inconsistent, or output validation failed. | No. |

A normalized model with at least one nurse and an unassigned choice for every
participating bed should always be feasible. Consequently, solver-level
`INFEASIBLE` indicates a model or implementation defect; it is not a normal
understaffing result.

Task 0.3 will freeze the numeric service and solver deadlines plus deployment
resource settings. Whatever values it chooses must enforce one total deadline
across all stages rather than restarting a full allowance at each stage.

## Hand-Worked Acceptance Scenarios

### Feasible floor

Inputs:

- one experienced RN with max load 2;
- one LPN with max load 2;
- four occupied beds with weights red 3, yellow 2, green 1, green 1;
- side guidance maxima of 2;
- two occupied rooms, with red plus green in the first and yellow plus green in
  the second.

Expected reasoning:

1. All four beds fit, so stage 1 proves `0` unassigned.
2. The RN must own the red bed. A maximum weighted load of 4 is achievable:
   RN gets red plus green, and LPN gets yellow plus green.
3. Both nurses have 2 patients, so the maximum patient count is 2.
4. The red owner is already the only eligible RN.
5. Neither nurse exceeds side guidance.
6. With two nurses, the minimum-two-team rule gives each team one nurse. The
   red room selects the RN's team and the other room selects the LPN's team, so
   each room still has exactly one team.

### Understaffed floor

Inputs:

- one RN with max load 2;
- three occupied green beds in canonical order;
- side guidance maximum of 2.

Expected reasoning:

1. Capacity is 2 for 3 beds, so no full assignment exists.
2. Stage 1 proves the minimum unassigned count is exactly 1.
3. The RN's weighted acuity load and patient count are both 2.
4. Canonical owner fixing assigns the first two canonical beds and leaves the
   final bed unassigned.
5. The result is `optimal`, not `infeasible_input`; existing flags explain the
   unavoidable unassigned bed and understaffing.

### Red-bed experience tie

Inputs:

- one experienced RN, one mid RN, and one new-grad RN, each with max load 1;
- one occupied red bed;
- otherwise identical eligibility and no other beds.

Expected reasoning:

1. Stage 1 proves `0` unassigned.
2. Stages 2 and 3 tie for every RN at acuity load 3 and patient count 1.
3. Stage 4 ranks the owners `0`, `1`, and `2`, so the experienced RN owns the
   red bed.
4. Experience does not force green/yellow assignment or side coverage. It may
   influence team membership later only through equal category distribution.

## Implementation Guardrails

- Do not write Python, OR-Tools, endpoint, schema, or mobile integration code
  as part of Task 0.2.
- Do not accept a merely feasible or partial candidate.
- Do not let array iteration order stand in for canonical normalized order.
- Do not use one unproven weighted objective for the lexicographic stages.
- Do not convert nurse experience into a general strength score. Use it only
  for the red-bed owner tie and the explicit team category-distribution stage.
- Do not persist solver variables, candidate matrices, patient free text, or
  full normalized input.
- Do not add solver settings to the mobile UI.

## Official References Rechecked

Reviewed on 2026-08-15:

- [OR-Tools assignment with task sizes](https://developers.google.com/optimization/assignment/assignment_cp)
  demonstrates integer assignment variables, exactly-one assignment, and
  worker capacity constraints.
- [OR-Tools CP-SAT solver](https://developers.google.com/optimization/cp/cp_solver)
  documents integer-only modeling and the `OPTIMAL`, `FEASIBLE`, `INFEASIBLE`,
  `MODEL_INVALID`, and `UNKNOWN` statuses used by this outcome contract.
- [OR-Tools solver limits](https://developers.google.com/optimization/cp/cp_tasks)
  documents bounded solver execution; Task 0.3 will freeze NurseFlow's numeric
  limits.

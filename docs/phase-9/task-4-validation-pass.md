# Phase 9 Task 4 Validation Pass

Date: 2026-08-24

Status: in progress. Complex/property checks, the earlier 25/50 pinned-container
warm benchmark, local deterministic 20/80 A/B evidence, authorization and SQL
contract checks, automated Phase 1-8 regressions, TypeScript, lint, and
production export pass. A refreshed pinned 20/80 repeat, Cloud Run cold starts,
live Supabase coordination/signals, and the authenticated native accessibility
pass remain explicit pre-production gates.

## Optimizer scenario and property evidence

The Task 4.1 suite now covers:

- every canonical Phase 9 fixture;
- a generated 18-room complex scenario with uneven room census, both doctor
  sides, mixed RN/LPN licenses, mixed experience, red pressure, and capacity
  ties;
- fresh result and child IDs for repeated output builds;
- one owner per saved bed, occupied-bed-only assignment, nurse hard maximums,
  RN-only red ownership, one-team room coverage, and complete nurse team
  partitioning;
- repeated deterministic solves and changes to incidental bed-state order,
  patient diagnosis text, and prior flags;
- both the full and understaffed supported-maximum shapes.

The deterministic start hint is search guidance only. It does not add a hard
constraint, weaken an objective, accept `FEASIBLE`, or bypass independent output
validation. Existing canonical fixture decisions remain unchanged.

## Supported ceiling decision

The original provisional ceiling of 200 rooms, 400 occupied beds, 40 nurses,
and 10 teams failed the shared 50-second exact solve budget. Before the hint it
timed out during `unassigned_count`; after the hint supplied a complete valid
starting assignment it advanced to `max_nurse_acuity_load` but still timed out.
A 35-room, 70-bed understaffed probe also timed out during canonical owner
fixing, and a 30-room, 60-bed understaffed probe left too little cutoff headroom.

An exploratory local probe on 2026-08-25 tested doubling every supported
dimension to 50 rooms, 100 occupied beds, and 24 nurses without changing the
production guards. With the same 50-second exact-solve budget, both variants
timed out: the full variant reached `team_experience_distribution_gap` with
solver status `UNKNOWN`, while the understaffed variant reached
`max_nurse_acuity_load` with solver status `FEASIBLE`. This single Windows
probe is not pinned-container acceptance evidence, but it is enough to reject
a constant-only doubling. A larger ceiling requires solver work followed by
the full pinned-container repeat benchmark.

After timeout diagnostics were preserved, a second concurrency-one local probe
showed where the doubled workload spent its budget. In the full variant,
`team_patient_count_gap` took 18.840 seconds and
`team_weighted_acuity_gap` took 9.572 seconds. All primary objectives completed,
but only two canonical room decisions completed before the third received the
last 1.505 seconds and returned `UNKNOWN`. In the understaffed variant,
`unassigned_count` completed in 1.195 seconds, then
`max_nurse_acuity_load` consumed 48.761 seconds, explored 1,011,141 branches
with 12,070 conflicts, and returned `FEASIBLE` at objective 8 with a best bound
of 7. Therefore the immediate doubled-size bottlenecks are workload/team-gap
proofs rather than canonical tie-breaking alone; canonical passes remain the
largest cumulative cost at the current supported ceiling.

A room-first team-label value-precedence experiment preserved the supported
decision fingerprints and all frozen fixture outputs. In one doubled full
probe, `team_patient_count_gap` fell from 18.840 to 6.314 seconds and
`team_weighted_acuity_gap` fell from 9.572 to 6.950 seconds. Four canonical
room decisions completed before the fifth ran out of the final 0.153 seconds,
compared with two completed room decisions before the rule. The doubled
understaffed probe did not materially improve: `max_nurse_acuity_load` still
used 46.577 seconds, returned objective 8 with bound 7, and explored 1,018,544
branches. A three-attempt same-runtime supported understaffed A/B also favored
the original model: symmetry enabled measured median/p95 32.362/34.329 seconds,
while disabling only that rule measured 31.180/31.389 seconds. Because the rule
did not improve the critical understaffed path or raise the ceiling and showed
a small supported-case regression, it was rejected and removed. Explicit
acuity-proof strengthening was selected next.

The next experiment added direct, mathematically implied acuity conservation
and capacity constraints across assigned nurses, unassigned beds, and generated
teams. In a same-runtime doubled understaffed A/B, disabling the helper again
timed out in `max_nurse_acuity_load` after 48.976 seconds at feasible objective
8 and bound 7. Enabling it proved the actual optimum 7 in 15.187 seconds,
completed `max_nurse_patient_count` at value 4, and reached
`red_bed_owner_rank_sum` before the shared budget expired. The doubled full
probe completed every primary objective and four canonical room decisions
before timing out on the fifth. Doubling is therefore still unsupported.

The supported understaffed three-attempt local A/B remained favorable and
deterministic: aggregate constraints enabled measured median/p95
22.074/22.637 seconds; disabling only the helper measured
22.790/23.394 seconds. One enabled supported full/understaffed control produced
the unchanged decision fingerprints in 9.343/20.875 seconds. The aggregate
constraints are retained because they materially improved the target doubled
proof without changing decisions or regressing the supported local control.

A following patient-count propagation A/B kept the acuity helper enabled on
both sides and changed only the new patient helper. In the doubled understaffed
control, `max_nurse_patient_count` took 17.640 seconds and the run timed out at
`red_bed_owner_rank_sum`. With patient propagation enabled, the patient-count
proof fell to 5.495 seconds; red-owner rank, both side-guidance objectives, and
team weighted-acuity gap all completed before the run reached
`team_patient_count_gap`. The doubled request still timed out and remains
unsupported, but four additional exact objectives completed in the same budget.

The supported understaffed three-attempt A/B was again deterministic and
favorable: enabled median/p95 was 17.845/21.447 seconds versus
21.579/21.724 seconds with only patient propagation disabled. One enabled
supported full/understaffed control retained the established fingerprints and
completed in 10.227/17.388 seconds. Patient-count propagation is retained.

Room-first team-label value precedence was then retested with both aggregate
helpers active. In the same-runtime doubled understaffed A/B, both sides reached
`team_rn_count_gap`, but symmetry completed the preceding stages in 42.531
seconds versus 48.569 seconds without it. In particular,
`team_weighted_acuity_gap` fell from 14.551 to 8.631 seconds. The RN-gap stage
therefore received 7.474 seconds rather than 1.381 seconds, although the whole
doubled request still timed out.

The expanded supported understaffed A/B completed five attempts per side with
zero timeouts and stable fingerprints. Symmetry enabled measured median/p95
17.158/17.407 seconds; disabling only room-label precedence measured
17.513/20.312 seconds. One enabled supported full/understaffed control retained
the established fingerprints and completed in 10.493/17.181 seconds. Because
the aggregate helpers changed the prior bottleneck and the new A/B no longer
shows the earlier supported regression, room-first value precedence is retained.

The next A/B replaced the original construction hint after every proven stage
with that stage's complete exact solution. In five supported understaffed
attempts per side, rolling hints were optimal and deterministic with the
unchanged fingerprint. Enabled median/p95 was 12.521/17.345 seconds versus
16.998/18.236 seconds disabled. A fully staffed control retained its established
fingerprint and completed in 9.220 seconds.

The doubled understaffed enabled probe completed all eleven primary objectives
in about 23 seconds and nine canonical room decisions before timing out at
`canonical_room_team:room-019`. The disabled control completed only seven
primary objectives and timed out at `team_patient_count_gap`, which began after
47.584 seconds. The doubled request remains unsupported because it still does
not complete the exact canonical sequence inside 50 seconds, but rolling hints
are retained because they materially improve both supported timing and doubled
search progress without changing the model or decisions.

Canonical room tie-breaking was then grouped into exact five-room mixed-radix
chunks while rolling hints stayed enabled on both A/B sides. Five supported
understaffed attempts per side were optimal and deterministic with the unchanged
fingerprint. Chunk size five measured median/p95 7.926/8.791 seconds versus
13.134/16.239 seconds one room at a time. A fully staffed chunked control kept
its established fingerprint and completed in 8.742 seconds.

In the doubled probes, the chunked solver proved the first ten canonical room
ranks in 17.002 seconds versus 20.377 seconds individually. Primary-stage
timing variance meant the individual run entered room tie-breaking 3.750 seconds
earlier and therefore completed one additional room before the shared cutoff.
The chunked run timed out in its third room group, so doubling remains
unsupported. Five-room chunks are retained because they materially improve the
supported contract and reduce the measured canonical work without changing any
decision or clinical objective.

A follow-up chunk-size tuning probe tested three rooms while keeping rolling
hints and every constraint unchanged. The supported understaffed five-attempt
sample remained optimal and deterministic, but median/p95 regressed to
10.041/11.951 seconds from the retained five-room result of 7.926/8.791.
The doubled three-room probe proved nine canonical room ranks before timing out,
versus ten with five-room chunks. Three-room chunks are therefore rejected and
the default remains five.

The next propagation A/B added direct team census-capacity and RN/red-capacity
cuts while retaining rolling hints and five-room chunks on both sides. Five
supported understaffed attempts per side were optimal and deterministic with
the unchanged fingerprint. Cuts enabled measured median/p95 7.823/7.873 seconds
versus 8.296/8.529 disabled. A fully staffed enabled control kept its established
fingerprint and completed in 6.591 seconds.

In the doubled A/B, the enabled run entered canonical solving 2.351 seconds
later because of primary-stage variance, but still proved three complete room
chunks, or 15 room ranks, before timing out in the fourth. The disabled control
proved only two chunks, or 10 ranks, and timed out in the third. In particular,
the hard `room-011..room-019` chunk fell from 17.372 seconds to 8.267 seconds.
The cuts are retained because they improve supported timing and materially
strengthen the measured canonical bottleneck without changing feasibility or
decisions. Doubling remains unsupported because the full canonical sequence
still does not complete inside 50 seconds.

A local internal-concurrency A/B then compared two CP-SAT search workers with
the retained single worker. The model, rolling hints, five-room chunks, and team
feasibility cuts stayed unchanged. Five two-worker supported understaffed runs
were optimal and kept the established fingerprint, but median/p95 regressed to
11.851/13.133 seconds from the one-worker 7.823/7.873. Peak process memory rose
from 106,352,640 to 117,088,256 bytes. The fully staffed two-worker control also
regressed to 7.952 seconds from 6.591 while keeping its fingerprint.

The doubled two-worker probe accelerated the first three canonical chunks and
reached the fourth at 42.652 seconds rather than 48.493, but it still proved
only the same 15 room ranks. Earlier work became less consistent:
`max_nurse_acuity_load` took 11.283 seconds with two workers versus 5.198 with
one. Because supported latency and memory regressed without advancing the
doubled exact sequence, two workers and the associated 2-vCPU deployment change
are rejected. Production remains one CP-SAT worker, one request per instance,
and one vCPU; the benchmark-only worker-count switch preserves the experiment.

A later canonical-search A/B replaced the many post-objective tie-break solves
with one complete fixed-order satisfaction search. An initial version left
presolve enabled and changed canonical assignments in five frozen fixtures;
that version was rejected immediately. Clearing all hints and disabling
presolve only for the final pass restored exact equality across every frozen
fixture and four additional varied synthetic scenarios. All clinical and
balance objectives still run as separate exact stages and are frozen first.

On the local Windows runtime, five supported understaffed candidate attempts
were optimal and deterministic at 5.940-second median / 6.758-second p95,
versus a fresh staged control at 10.140 / 12.461 seconds. This is a 41.4% median
and 45.8% p95 reduction with the same `580f260...49a28b0` fingerprint. The
fully staffed candidate completed in 7.538 seconds versus 8.009 seconds for its
fresh control, a 5.9% reduction with the same `42c6d72...d1437d5` fingerprint.
The fixed pass is retained as the production default; the staged path remains
available as a benchmark control.

The unsupported doubled 50-room, 100-bed, 24-nurse candidate still timed out.
It proved all 11 primary objectives in 22.134 seconds, then exhausted the final
27.870 seconds in `canonical_fixed_search`. This experiment improved the
then-supported ceiling but did not justify raising it at that point; the limits
remained 25 rooms, 50 beds, and 12 nurses until the targeted 20/80 work below.

The single fixed pass was then split at the existing canonical priority
boundaries: rooms, bed owners, and nurse memberships. Each complete fixed search
freezes its tuple before the next pass, so later decisions no longer enlarge the
tree needed to find an earlier canonical prefix. Differential checks matched
the staged and single-pass decisions across every fixture and four varied
synthetic scenarios. A forced split-pass timeout retained all 11 completed
primary stages and named `canonical_fixed_room_search` as the failed pass.

Five-attempt fresh local A/B results favored the split strategy:

| Supported variant | Single fixed median / p95 | Split fixed median / p95 | Median change | Fingerprint |
| --- | ---: | ---: | ---: | --- |
| Understaffed | 7.320 / 11.534 s | 3.352 / 3.399 s | 54.2% faster | `580f260...49a28b0` |
| Full | 8.081 / 8.513 s | 5.563 / 6.618 s | 31.2% faster | `42c6d72...d1437d5` |

Peak memory was effectively unchanged or slightly lower in these process-level
screens: 107,515,904 bytes split versus 109,838,336 single for understaffed,
and 107,044,864 versus 107,159,552 for full. The split strategy is retained as
the production default.

The doubled split strategy still timed out at 50 seconds in the room pass. A
90-second diagnostic run completed the room tuple in 29.962 seconds, reached
the bed-owner pass at 59.327 seconds total, and then exhausted the remaining
30.679 seconds there. A 90-second solver allowance would also have required
increasing the then-current 70-second internal request deadline, 75-second Cloud
Run cutoff, and 90-second retry lease together. Because it still did not
complete the doubled shape, that experiment retained the shared 50-second solve
budget and the 25/50/12 ceiling. The later targeted 20/80 work below coordinates
all four limits.

An exact bed-owner-block experiment then split only the second fixed pass while
leaving room and membership behavior unchanged. Every block was frozen before
the next, and differential tests matched staged, single-fixed, and unblocked
split decisions across all fixtures plus four varied synthetic scenarios.

Performance rejected both screened block sizes. Ten-bed blocks measured
4.888-second median / 7.984-second p95 on the supported understaffed maximum,
versus 3.352 / 3.399 seconds unblocked. Twenty-five-bed blocks improved on ten
but still regressed to 4.376 / 4.564 seconds. On doubled 90-second probes,
neither size completed even its first owner block: the 25-bed pass exhausted
39.587 seconds after entering owners at 50.420 seconds total, while the 10-bed
pass exhausted 43.043 seconds after entering at 46.962 seconds. The optional
block-size switch remains benchmark evidence, but production keeps one complete
bed-owner pass.

The 20-room, 80-occupied-bed, 12-nurse shape was first tested under capacity
pressure with nurse maximums of five and four. Merely increasing the exact
solver allowance to 120 seconds did not work: the original split fixed strategy
completed the 11 primary objectives in 6.511 and 4.994 seconds, then exhausted
the rest of the budget in `canonical_fixed_room_search` for both variants.

An exact fully staged control proved that the model itself could fit. It
completed full in 34.268 seconds and understaffed in 23.177 seconds, producing
fingerprints `082ae9f...d04bb88` and `c954dfe...1ea8a9a`. The retained hybrid
therefore uses presolved five-room mixed-radix proofs only for the room prefix,
then keeps the faster fixed bed-owner and nurse-membership passes. One-shot A/B
results were 24.119 versus 34.268 seconds full and 14.008 versus 23.177 seconds
understaffed, with identical decisions: 29.6% and 39.6% faster respectively.

Further changes were screened one at a time against that hybrid:

| Candidate | Result | Decision |
| --- | --- | --- |
| Four-room chunks | Full regressed to 38.826 s | Rejected |
| Six-room chunks | Full improved to 22.674 s, but understaffed regressed from 14.008 to 18.243 s | Rejected as non-universal |
| Seven-room chunks | Full regressed to 41.220 s | Rejected |
| Two CP-SAT workers | Full regressed from 24.119 to 36.231 s and memory rose to 128,077,824 B | Rejected |
| Exact fixed-sum gap bounds | Full regressed from 24.119 to 25.297 s | Rejected; benchmark switch retained |

Every candidate preserved the established full fingerprint, so rejection is
based on time and memory rather than changed accuracy. The retained five-room,
one-worker hybrid then completed five out of five attempts for each large-floor
variant with deterministic fingerprints and zero timeouts:

| 20-room/80-bed capacity-pressure variant | Median | p95 | Peak RSS | Unassigned |
| --- | ---: | ---: | ---: | ---: |
| Capacity 60 (maximum 5 per nurse) | 22.039 s | 53.586 s | 117,755,904 B | 20 |
| Capacity 48 (maximum 4 per nurse) | 10.445 s | 10.770 s | 116,326,400 B | 32 |

Production now selects the room strategy from occupied-bed count: the original
fixed room pass through 50 occupied beds, and the five-room mixed-radix room
proof above 50. A default-path confirmation selected the hybrid automatically
and completed the 20/80 capacity-60 and capacity-48 cases in 17.139 and 10.401 seconds.
The 25/50 regression selected the original path and completed in 4.754 and
3.964 seconds with its established fingerprints.

Those runs proved support for the input shape and capacity-pressure behavior,
but the capacity-60 case could not assign all 80 beds. The actual fully
assignable worst case was therefore added with a maximum load of seven per
nurse. The original production hybrid reached the fourth objective quickly but
timed out at 120 seconds while proving `red_bed_owner_rank_sum`: incumbent `6`,
best lower bound `4`. Rolling hints off, two workers, direct team rank bounds,
an aggregate red model, descending feasibility probes, fixed experienced-RN
team counts, and CP-SAT core-based optimization each timed out or regressed
memory and were rejected one at a time.

The retained red-rank optimization builds a smaller structural model that keeps
room teams, nurse teams, per-nurse patient/acuity caps, and green/yellow/red
counts. It proved the lower bound `6` in about 2.05 seconds. A full-model
feasibility bridge then found real bed owners at rank `6`, so the production
solver freezes the value only after both the lower-bound proof and a concrete
full-model witness agree. This reached every clinical and balance objective plus
the canonical room prefix in about 10.15 seconds, exposing the next bottleneck:
the single fixed bed-owner pass then used the remaining 109.86 seconds and timed
out.

The initial owner strategy encoded five canonical bed-owner ranks in one exact
mixed-radix objective, solved it with presolve, decoded and froze all five
ranks, then advanced to the next chunk. It completed the first fully assignable
20/80 run in 20.940 seconds with all 80 beds assigned and peak RSS 112,275,456
bytes. Disabling that owner strategy timed out in the old fixed pass, so it is
enabled automatically only when there are more than 50 occupied beds and the
optimal unassigned count is zero.

An instrumented follow-up showed one five-bed owner chunk consuming 15.698 of
32.723 seconds. Owner chunk size was then separated from the retained five-room
size and screened locally, one value at a time. Every result assigned 80/80 and
kept fingerprint `e97521c4...c4c5`:

| Owner ranks per mixed-radix chunk | One-shot duration | Decision |
| ---: | ---: | --- |
| 3 | 27.001 s | Rejected; slower than 4 and 6 |
| 4 | 24.405 s | Improved on 5, but slower than 6 |
| 5 | 32.723 s | Previous default |
| 6 | 16.783 s | Retained |
| 7 | 19.417 s | Rejected; regressed from 6 |
| 8 | 18.809 s | Rejected; regressed from 6 |

Six ranks reduced the measured hotspot from 15.698 to 2.781 seconds while
preserving the exact tuple. Five production-default repetitions with the
retained six-bed chunks then all completed exactly with one stable fingerprint,
`e97521c4...c4c5`:

| Fully assignable 20-room/80-bed run | Result |
| --- | ---: |
| Exact successes | 5 / 5 |
| Median | 18.402 s |
| p95 | 20.658 s |
| Slowest attempt | 20.658 s |
| Peak RSS | 128,593,920 B |
| Assigned / unassigned | 80 / 0 |

This local evidence is comfortably inside the 120-second shared solver budget.
The rejected experiment code was removed after its measurements were recorded;
the benchmark retains switches for the two production strategies so their exact
A/B controls remain repeatable.

The measured supported envelopes are now:

| Input shape | Supported maximum |
| --- | ---: |
| Doctor sides | 2 exactly |
| Standard floor | 25 rooms and at most 50 occupied beds |
| Large floor | 20 rooms and at most 80 occupied beds |
| Total physical beds | 80 |
| Nurses | 12 |
| Generated teams | 3 |

`normalize_shift_snapshot` rejects more than 80 physical or occupied beds and
rejects the unmeasured combination of more than 20 rooms with more than 50
occupied beds. The exact solve budget is 120 seconds, coordinated with a
135-second service deadline, 140-second host cutoff, and 150-second retry lease.

## Pinned-container warm benchmark

Image ID:
`sha256:e7fb411a0b48b29fa919d5b054b0242df338a6afbb5c4d76f2747c589d86646d`

Runtime:

- Linux x86_64 container
- Python 3.13.14
- OR-Tools 9.15.6755
- one solver worker and seed `20260815`
- 50-second shared exact-solve budget

One detailed attempt per variant recorded every objective and canonical-stage
duration. The full attempt took 10.645 seconds; the understaffed attempt took
20.684 seconds. The repeat run then completed twenty warm attempts per variant
at concurrency one:

| Variant | Optimal | Timeouts / failures | Median | Warm p95 | Peak RSS | Decision fingerprint | Unassigned |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Full | 20/20 | 0 / 0 | 9.565 s | 12.865 s | 129,060,864 B | `42c6d72...d1437d5` | 0 |
| Understaffed | 20/20 | 0 / 0 | 25.433 s | 28.055 s | 130,547,712 B | `580f260...49a28b0` | 2 |

Both variants passed the then-frozen warm thresholds: every stage was
`OPTIMAL`, every output passed independent validation, all repeated decisions
matched, p95 was below 60 seconds, each request stayed below the then-current
70-second internal deadline, and peak memory was below 1.5 GiB.

These pinned-container measurements predate the retained aggregate-acuity,
patient-count, room-label precedence, rolling-stage hint, fixed canonical
search, and team feasibility cuts. A refreshed pinned repeat remains required
before using the local A/B as production performance evidence; the local Docker
daemon was not running during these experiments.

Timeout evidence is now preserved instead of discarding the stages completed
before the failure. `OptimizerTimedOutError` retains the completed stage trace,
budget consumed before the failed stage, failed-stage duration, solver wall
time, branches, conflicts, and objective/bound evidence. The benchmark writes
the exact synthetic diagnostics into its JSON result. Private service logging
uses only the opaque run ID and stage categories, stripping canonical entity
IDs; the mobile response and stored failure code remain unchanged.

Remaining benchmark gate:

- Five real Cloud Run cold-start attempts after scale-to-zero or on a new
  revision.
- Production-like Supabase prepare/finalize latency.
- Deployed container digest, request logs, and host-level memory/cutoff evidence.

## Authorization, idempotency, and concurrency evidence

The repeatable Python and SQL contract suites cover:

- missing and expired authentication;
- owner-only prepare behavior and denied prepare outcomes;
- client snapshot rejection;
- identical completed retries, in-progress duplicates, mutation-key conflicts,
  and stale input/baseline preconditions;
- one idempotency index and separate initial/rerun running-run indexes;
- the shared optimizer-run then active-shift lock order;
- service-only finalization and revoked joined/mobile optimizer-run access;
- success-only active-shift writes, override supersession after that write, and
  run success last in the same transaction;
- safe rollback/no-commit outcomes for timeout, invalid input, stale state, and
  failure;
- patient-detail-free public failures and optimizer-run schema;
- no direct optimizer notification insert: the existing post-update
  `active_shifts` trigger observes only a committed successful transaction.

The earlier disposable PostgreSQL execution for the Phase 9 coordination SQL
is recorded in `docs/understanding-checklist.md`. A live disposable Supabase
pass is still required for real RLS identities, simultaneous requests,
Realtime delivery, notification-after-commit, and joined-nurse scoped reads.

## Mobile manual pass

Automated mobile contract/runtime checks pass 12/12 for request fields, bearer
auth, app-facing outcomes, unavailable transport, stale normalization, rerun
baseline preconditions, retired local generation, and stale move dialogs.

The authenticated native pass could not run in this environment because:

- no Android device or emulator is connected;
- the device automation CLI is unavailable;
- `EXPO_PUBLIC_OPTIMIZER_SERVICE_URL` is not configured;
- no disposable authenticated owner/joined-nurse test sessions were supplied.

Therefore no claim is made for first run, rerun success/failure, disconnect and
reconnect, timeout, stale refresh, service unavailable, active-move clearing,
small/large phone, tablet orientation, dynamic type, or VoiceOver/TalkBack in
this Task 4 pass. Screenshots are not recorded because test evidence must come
from the real configured flow.

## Phase 1-8 automated regression

- Node tests: 51 passed, 0 failed.
- Python tests: 88 passed, 0 failed, including the fully assignable 20/80
  regression.
- TypeScript `tsc --noEmit`: pass.
- Expo lint: pass.
- Expo web production export: pass, 22 static routes.
- Assignment-result compatibility: pass for existing board, flag, and
  nurse-facing readers.
- Effective manual overrides and move preview: 8/8 pass.
- Request lifecycle, notification routing, and realtime scoping: 9/9 pass.
- Responsive boundary and large-floor lookup checks: 4/4 pass.

The previous authenticated Phase 1-8 manual workflows remain pending where
they require live accounts, native sessions, notifications, or multi-session
coordination. Automated success is not treated as a substitute for those gates.

## Scope and readability

- No AI, diagnosis interpretation, EHR/EMR, cross-shift analytics, solver
  settings UI, run-history UI, or offline assignment queue was added.
- The phone still sends only one small authenticated action and reloads the
  committed `AssignmentResult`.
- The optimizer owns server-authoritative normalization, exact constraints and
  objective order, deterministic tie-breaking, output validation, and protected
  finalization.
- Manual overrides remain a separate effective-assignment layer and are
  superseded only by a successful protected rerun.
- The final teaching checkpoint remains pending until the learner restates the
  Task 4 problem, solution, and broader boundary in her own words.

# NurseFlow Optimizer Service

This directory is the separately deployable Python boundary for the NurseFlow
assignment optimizer. It is a solver-only service: the Go API loads the shift
snapshot, sends it to `POST /v1/solve`, and saves the result itself. This
service never talks to Supabase, and neither the phone nor Expo imports it.

Task 1.2 adds only the pre-solve boundary:

- validate the server-authoritative shift snapshot;
- remove empty beds and patient free text;
- capture canonical side, room, bed, and nurse ordinals;
- derive immutable normalized records and team count;
- hash canonical solver-relevant JSON with SHA-256.

Task 1.3 adds the first pinned OR-Tools model boundary:

- assign every nurse to exactly one evenly sized generated team;
- assign every occupied room to exactly one generated team;
- derive room coverage from the selected team's complete nurse membership;
- leave empty rooms without solver variables or generated nurse coverage.

Task 1.4 adds occupied-bed hard constraints:

- one eligible nurse or the internal unassigned choice per occupied bed;
- RN-only ownership variables for red beds;
- individual nurse max patient load;
- assignment ownership restricted to the room's selected team;
- no variables for empty beds.

Task 1.5 adds the frozen exact lexicographic solve:

- every stage must return `OPTIMAL`, then its value is fixed as an equality;
- unassigned count, maximum acuity, and maximum patient count remain the first
  three priorities;
- red-owner experience, side guidance, and ordered team-balance gaps follow;
- canonical room teams, bed owners, and team memberships remove final ties;
- one worker, a checked-in seed, exact OR-Tools version, and one shared solve
  budget preserve the deterministic runtime contract.

Task 1.6 adds the established output boundary:

- a fresh opaque result ID and result-scoped stable child IDs;
- existing `generatedTeams`, `roomCoverage`, and `bedAssignments` arrays;
- existing assignment flag types, with unassigned choices omitted from saved
  bed assignments;
- independent ID, relationship, eligibility, capacity, coverage, decision,
  objective-summary, and flag validation before returning output.

The former Supabase-coordinated route (`POST /v1/assignment-runs`, which
verified a Supabase JWT and called prepare/finalize RPCs) was removed together
with its database functions (ticket 23). Every assignment run now goes through
the Go API.

Task 4.1 freezes two measured service envelopes with at most 12 nurses: up to
25 rooms with at most 50 occupied beds, or up to 20 rooms with at most 80
occupied beds. Total physical beds may not exceed 80. Other larger shapes are
rejected during normalization. The earlier provisional 200-room, 400-bed,
40-nurse shape could not prove every exact objective and is not a supported
production claim.

Exact-stage timeouts retain private diagnostics for capacity work: completed
stage values and timings, time remaining when the failed stage began, failed
stage duration, branch/conflict counts, objective/bound evidence, and solver
wall time. Benchmark JSON keeps the exact synthetic stage names. Service logs
keep only stage categories and the opaque run ID, while the HTTP response stays
the coarse patient-free `timed_out` outcome.

The exact model includes redundant aggregate acuity conservation and capacity
constraints. They preserve the feasible set and objective order while helping
CP-SAT propagate tight maximum-acuity candidates across nurse, team, assigned,
and unassigned expressions.

Parallel patient-count conservation and capacity constraints connect occupied,
assigned, unassigned, nurse, and team census directly to the maximum patient
count variable. They preserve the same exact decisions while reducing indirect
bed-owner search for tight census values.

Occupied rooms also use room-first value precedence for generated team labels.
The rule removes equivalent A/B/C label permutations while preserving the
existing room-first canonical output and allowing non-contiguous room coverage.

After each exact objective is proven, the solver replaces its original
construction hint with the complete proven solution. This rolling hint gives
the next stage a valid incumbent that already satisfies every frozen earlier
objective. It changes search guidance only; all stages still require `OPTIMAL`.

On a fully assignable floor above 50 occupied beds, the red-owner objective uses
a smaller structural count model first. That model keeps room teams, nurse
teams, per-nurse patient/acuity caps, and green/yellow/red counts, so it proves a
safe lower bound without choosing 80 individual bed owners. The full model then
checks that bound with the real bed variables before freezing it. This bridge
preserves the exact objective while avoiding the original red-rank proof that
exhausted 120 seconds on the 20-room/80-bed case.

After the clinical and balance objectives are proved and frozen, the production
solver chooses exact canonical tie-break strategies from occupied-bed count. At
50 or fewer occupied beds it uses one fixed room-rank pass. Above 50 it proves
five-room mixed-radix chunks with presolve, then fixes every decoded room rank.
For a fully assigned large floor it also proves bed owners in exact six-bed
mixed-radix chunks; capacity-pressure cases with unassigned beds keep the faster
fixed owner pass. Every path finishes with exact nurse-team membership. These
adaptive choices preserve the same lexicographic decisions while avoiding the
large-floor room and owner searches that exhausted 120 seconds in testing.

The benchmark also accepts an optional legacy fixed bed-owner block size.
Ten- and twenty-five-bed fixed-search blocks preserved exact decisions but
regressed latency. They are distinct from the retained mixed-radix owner chunks,
which keep presolve enabled and encode six ordered owner ranks into one exact
objective.

Direct team feasibility cuts also connect assigned census to configured nurse
capacity and assigned red beds to configured RN capacity. The existing
ownership constraints already imply both limits, so the cuts preserve valid
assignments while letting room proofs reject impossible team choices sooner.

Install the exact service dependencies into an isolated environment:

```text
python -m venv optimizer-service/.venv
optimizer-service/.venv/Scripts/python -m pip install -r optimizer-service/requirements.lock
```

Run the focused tests from the repository root:

```text
optimizer-service/.venv/Scripts/python -m unittest discover -s optimizer-service/tests -p "test_*.py"
```

For local HTTP development, set the shared solver token and run the service
(Go's API uses port 8080 locally, so the solver uses 8090):

```powershell
$env:NURSEFLOW_SOLVER_TOKEN="local-dev-solver-token"
optimizer-service/.venv/Scripts/python -m uvicorn nurseflow_optimizer.runtime:create_app_from_environment --factory --app-dir optimizer-service --host 127.0.0.1 --port 8090 --workers 1 --no-access-log
```

## Solver-only endpoint for the Go API

`POST /v1/solve` is the server-to-server entry point for the Go backend. Go
loads the shift snapshot itself and sends it here; this service only solves.

- Header: `Authorization: Bearer <NURSEFLOW_SOLVER_TOKEN>` (compared in
  constant time). Missing or wrong token: `401 {"status":"unauthorized"}`.
- Body (at most 1 MiB, exactly these two fields):
  `{"runId": "<non-blank text>", "shiftSnapshot": { ... }}`. `runId` is only
  used to correlate private timeout logs.
- `200`: `{assignmentResult, flags, objectives, inputFingerprint, optimizerVersion}`.
  `422 {"status":"invalid_input"}` (bad body or snapshot, `413` when too large),
  `504 {"status":"timed_out"}`, `500 {"status":"failed"}`.
- It normalizes, solves, and validates the output with the default 120-second
  solve budget. Neither the token nor the snapshot is ever logged, and there is
  no CORS: the caller is the Go API, not a browser.

`NURSEFLOW_SOLVER_TOKEN` is the only required setting. If it is missing or
blank the service fails at startup with a clear error instead of running with no
usable route. `/healthz` and `/readyz` need no token. Any other path, including
the retired `/v1/assignment-runs`, answers `404`.

Build the portable production image from the repository root with:

```text
docker build -f optimizer-service/Dockerfile -t nurseflow-optimizer optimizer-service
```

The production runtime is pinned to Python 3.13.14, OR-Tools 9.15.6755, and the
exact transitive packages in `requirements.lock` (FastAPI, Uvicorn, and
OR-Tools with its dependencies; `httpx` is there only for FastAPI's test
client).

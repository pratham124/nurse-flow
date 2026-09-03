# NurseFlow Optimizer Service

This directory is the separately deployable Python boundary for the Phase 9
assignment optimizer. Expo does not import it. The phone calls one authenticated
action endpoint and then reloads the committed board from Supabase.

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

Tasks 2.1-2.4 add the safe server workflow:

- `POST /v1/assignment-runs` accepts only the shift ID, mutation ID, revision,
  and expected baseline ID;
- the service verifies the Supabase JWT before the authorized prepare RPC can
  release the current shift snapshot;
- retries reuse one coordinated run, with a 150-second recovery lease for a
  request interrupted after preparation;
- protected finalization rechecks current state and atomically saves the new
  baseline, flags, run outcome, and rerun override supersession;
- only a successful `active_shifts` update reaches the existing realtime,
  notification, and nurse-scoped read paths.

Tasks 3.3-3.4 complete the mobile cutover:

- initial runs and reruns call the same endpoint, with reruns supplying the
  current committed baseline ID;
- the phone keeps the prior board and active overrides until finalization
  succeeds;
- the client-authored Phase 8 rerun RPC is revoked from mobile roles;
- the retired TypeScript assignment generator is no longer part of the mobile
  runtime.

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

For local HTTP development, set the private values documented in
`docs/phase-9/supabase-optimizer-coordination-setup.md`, then run:

```text
optimizer-service/.venv/Scripts/python -m uvicorn nurseflow_optimizer.runtime:create_app_from_environment --factory --app-dir optimizer-service --host 127.0.0.1 --port 8080 --workers 1 --no-access-log
```

To call the local service from Expo Web, opt in to the exact browser origin in
the optimizer terminal before starting Uvicorn:

```powershell
$env:NURSEFLOW_LOCAL_WEB_ORIGIN="http://localhost:8081"
```

Set the app's public service URL in the repository-root `.env`, then restart
Expo on that same browser port:

```text
EXPO_PUBLIC_OPTIMIZER_SERVICE_URL=http://127.0.0.1:8080
```

```powershell
npm run web -- --port 8081
```

The origin must match the browser address exactly. For example, an Expo page
opened at `http://127.0.0.1:8081` requires that value instead. If the local-web
variable is absent, the service does not add browser CORS access. Keep
`NURSEFLOW_SUPABASE_SECRET_KEY` only in the optimizer process environment; it
must never use an `EXPO_PUBLIC_` name.

Build the portable production image from the repository root with:

```text
docker build -f optimizer-service/Dockerfile -t nurseflow-optimizer optimizer-service
```

The production runtime is pinned to Python 3.13.14, OR-Tools 9.15.6755, and the
exact transitive HTTP/auth packages in `requirements.lock`. Deployment and the
maximum-floor benchmark remain separate later Phase 9 work.

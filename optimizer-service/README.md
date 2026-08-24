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
- retries reuse one coordinated run, with a 90-second recovery lease for a
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

Build the portable production image from the repository root with:

```text
docker build -f optimizer-service/Dockerfile -t nurseflow-optimizer optimizer-service
```

The production runtime is pinned to Python 3.13.14, OR-Tools 9.15.6755, and the
exact transitive HTTP/auth packages in `requirements.lock`. Deployment and the
maximum-floor benchmark remain separate later Phase 9 work.

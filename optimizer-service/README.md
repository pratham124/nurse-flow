# NurseFlow Optimizer Service

This directory is the separately deployable Python boundary for the Phase 9
assignment optimizer. It is not imported by Expo and currently has no HTTP
adapter.

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

Install the exact service dependencies into an isolated environment:

```text
python -m venv optimizer-service/.venv
optimizer-service/.venv/Scripts/python -m pip install -r optimizer-service/requirements.lock
```

Run the focused tests from the repository root:

```text
optimizer-service/.venv/Scripts/python -m unittest discover -s optimizer-service/tests -p "test_*.py"
```

The production runtime remains pinned to Python 3.13.14 and OR-Tools 9.15.6755
by `docs/phase-9/python-service-boundary.md`. FastAPI, the container, and
deployment belong to later tasks.

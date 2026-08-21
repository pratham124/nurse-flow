# Phase 9 Canonical Optimizer Fixtures

Task: Phase 9 Task 1.1, Add Canonical Optimizer Fixtures and Expected Outcomes

The machine-readable fixture catalog is
`tests/fixtures/phase9OptimizerFixtures.json`. It contains normalized,
synthetic optimizer inputs only: ordered sides, rooms, occupied beds, nurses,
and side-guidance maxima. It intentionally contains no patient names,
initials, diagnosis text, server records, or solver implementation.

Each fixture records:

- the canonical final teams, room teams, and bed owners;
- every numeric objective value frozen in `optimizer-rules.md`;
- any aggregate-equivalent decision that is valid before the final canonical
  tie-break stages.

`allowedEquivalentChoices` does not weaken the final deterministic contract.
It explains choices that share the aggregate objective values; stages 7-9 must
still select the fixture's canonical `decisions`.

## Manual Review Table

| Fixture | Expected unassigned | Key prediction |
| --- | ---: | --- |
| Empty census | 0 | Rooms have empty coverage and the one nurse remains in Team A. |
| One nurse | 0 | The nurse owns the yellow and green beds at her exact max load. |
| RN and LPN mix | 0 | The RN owns red plus green; the LPN owns yellow plus green. |
| Red-bed eligibility | 0 | The RN owns the red bed even though the LPN is first in nurse order. |
| Exact capacity | 0 | Both nurses receive exactly two green beds. |
| Understaffed floor | 1 | The first two canonical beds are assigned and the final bed is unassigned. |
| Split room | 0 | The experienced RN and LPN share one room from the same team. |
| Both doctor sides | 0 | One team covers its nurse's rooms on both sides. |
| Active-side guidance | 0 | One covered nurse exceeds the admitting maximum by exactly one. |
| Stable ties | 0 | Aggregate-equivalent nurse swaps exist, then canonical stages choose nurse 1 first. |
| Greedy room-capacity failure | 0 | The one-capacity team covers the small room, preserving the four-capacity team for the large room. |

## Objective Field Glossary

The catalog uses the frozen lexicographic vocabulary directly:

1. `unassignedCount`
2. `maxNurseAcuityLoad`
3. `maxNursePatientCount`
4. `redBedOwnerRankSum`
5. `sideGuidanceTotalExcess`, then `sideGuidanceNurseCount`
6. the five ordered `team...Gap` values

The focused test recomputes these values from each expected decision. It also
checks team sizes, current IDs, max loads, room-team coverage, and RN-only red
ownership. This proves the fixture oracles are internally consistent; it does
not search for solutions or implement the future OR-Tools optimizer.

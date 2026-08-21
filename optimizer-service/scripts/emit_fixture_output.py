"""Emit one synthetic optimized shift for cross-language compatibility tests."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = SERVICE_ROOT.parent
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(SERVICE_ROOT / "tests"))

from tests.fixture_helpers import build_shift_snapshot, load_fixture_catalog  # noqa: E402
from nurseflow_optimizer import normalize_shift_snapshot  # noqa: E402
from nurseflow_optimizer.optimizer import solve_optimizer  # noqa: E402
from nurseflow_optimizer.output import build_assignment_output  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Emit one solved fixture in the existing TypeScript Shift shape."
    )
    parser.add_argument("fixture_id", help="Fixture ID from phase9OptimizerFixtures.json")
    args = parser.parse_args()

    # Find the requested small, deterministic test scenario.
    fixture = None
    for candidate in load_fixture_catalog()["fixtures"]:
        if candidate["id"] == args.fixture_id:
            fixture = candidate
            break
    if fixture is None:
        parser.error(f"unknown fixture ID: {args.fixture_id}")

    # Run the same normalize -> solve -> output pipeline used by the service.
    shift = build_shift_snapshot(fixture)
    normalized = normalize_shift_snapshot(shift).model
    solution = solve_optimizer(normalized)
    output = build_assignment_output(
        normalized,
        solution,
        result_id_factory=lambda: f"compatibility-{args.fixture_id}",
    )
    # Add the generated assignment to a Shift-shaped object so the existing
    # TypeScript readers can prove cross-language compatibility.
    shift.update(
        {
            "assignmentResult": output.assignment_result.to_dict(),
            "flags": [flag.to_dict() for flag in output.flags],
            "floorTemplateId": "synthetic-template",
            "status": "assigned",
        }
    )
    print(json.dumps({"shift": shift}, separators=(",", ":")))


if __name__ == "__main__":
    main()

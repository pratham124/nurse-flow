from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
import statistics
import sys
import time
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
TEST_ROOT = SERVICE_ROOT / "tests"
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(TEST_ROOT))

import ortools  # noqa: E402
import nurseflow_optimizer.normalization as normalization_module  # noqa: E402

from nurseflow_optimizer import normalize_shift_snapshot  # noqa: E402
from nurseflow_optimizer.optimizer import (  # noqa: E402
    DEFAULT_CANONICAL_BED_OWNER_CHUNK_SIZE,
    OptimizerSolveError,
    OptimizerTimedOutError,
    _resolve_mixed_radix_room_search,
    solve_optimizer,
)
from nurseflow_optimizer.output import build_assignment_output  # noqa: E402
from scenario_helpers import (  # noqa: E402
    build_maximum_shift_snapshot,
    build_synthetic_shift_snapshot,
)


def build_probe_snapshot(
    *,
    room_count: int,
    bed_count: int,
    nurse_count: int,
    understaffed: bool,
    max_patient_load: int | None,
) -> dict[str, object]:
    """Build a custom benchmark shape without changing production limits."""

    beds_per_room, rooms_with_extra_bed = divmod(bed_count, room_count)
    room_bed_counts = [
        beds_per_room + (1 if room_index < rooms_with_extra_bed else 0)
        for room_index in range(room_count)
    ]
    return build_synthetic_shift_snapshot(
        scenario_id=(
            "custom-understaffed" if understaffed else "custom-full"
        ),
        room_bed_counts=room_bed_counts,
        nurse_count=nurse_count,
        max_patient_load=(
            max_patient_load
            if max_patient_load is not None
            else 4 if understaffed else 5
        ),
        understaffed=understaffed,
    )


def peak_resident_bytes() -> int | None:
    """Return the process peak resident memory using only the standard library."""

    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        class ProcessMemoryCounters(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("page_fault_count", wintypes.DWORD),
                ("peak_working_set_size", ctypes.c_size_t),
                ("working_set_size", ctypes.c_size_t),
                ("quota_peak_paged_pool_usage", ctypes.c_size_t),
                ("quota_paged_pool_usage", ctypes.c_size_t),
                ("quota_peak_non_paged_pool_usage", ctypes.c_size_t),
                ("quota_non_paged_pool_usage", ctypes.c_size_t),
                ("pagefile_usage", ctypes.c_size_t),
                ("peak_pagefile_usage", ctypes.c_size_t),
            ]

        counters = ProcessMemoryCounters()
        counters.cb = ctypes.sizeof(counters)
        get_current_process = ctypes.windll.kernel32.GetCurrentProcess
        get_current_process.restype = wintypes.HANDLE
        get_process_memory_info = ctypes.windll.psapi.GetProcessMemoryInfo
        get_process_memory_info.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(ProcessMemoryCounters),
            wintypes.DWORD,
        ]
        get_process_memory_info.restype = wintypes.BOOL
        process = get_current_process()
        ok = get_process_memory_info(
            process,
            ctypes.byref(counters),
            counters.cb,
        )
        return counters.peak_working_set_size if ok else None

    try:
        import resource

        maximum_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        multiplier = 1 if sys.platform == "darwin" else 1024
        return int(maximum_rss * multiplier)
    except (ImportError, OSError):
        return None


def decision_fingerprint(solution) -> str:
    decisions = {
        "teams": {
            team.label: list(team.nurse_ids) for team in solution.team_coverage.teams
        },
        "roomTeams": {
            room.room_id: room.team_label for room in solution.team_coverage.rooms
        },
        "bedOwners": {bed.bed_id: bed.nurse_id for bed in solution.bed_owners},
    }
    encoded = json.dumps(decisions, separators=(",", ":"), sort_keys=True).encode()
    return hashlib.sha256(encoded).hexdigest()


def percentile_95(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * 0.95) - 1)]


def run_variant(
    *,
    understaffed: bool,
    attempts: int,
    budget_seconds: float,
    include_stage_timings: bool,
    room_count: int | None,
    bed_count: int | None,
    nurse_count: int | None,
    max_patient_load: int | None,
    use_rolling_stage_hints: bool,
    canonical_room_chunk_size: int,
    canonical_bed_owner_chunk_size: int,
    use_team_feasibility_cuts: bool,
    search_worker_count: int,
    use_fixed_canonical_search: bool,
    split_fixed_canonical_search: bool,
    fixed_bed_owner_block_size: int | None,
    use_mixed_radix_room_search: bool | None,
    use_fixed_gap_bounds: bool,
    use_structural_red_rank_bound: bool | None,
    use_mixed_radix_bed_owner_search: bool | None,
) -> dict:
    if room_count is None or bed_count is None or nurse_count is None:
        snapshot = build_maximum_shift_snapshot(understaffed=understaffed)
    else:
        snapshot = build_probe_snapshot(
            room_count=room_count,
            bed_count=bed_count,
            nurse_count=nurse_count,
            understaffed=understaffed,
            max_patient_load=max_patient_load,
        )
        # This override exists only in this benchmark process. Production
        # normalization continues to enforce its measured safety ceiling.
        normalization_module.MAX_ROOMS = max(
            normalization_module.MAX_ROOMS,
            room_count,
        )
        normalization_module.MAX_BEDS = max(
            normalization_module.MAX_BEDS,
            bed_count,
        )
        normalization_module.MAX_NURSES = max(
            normalization_module.MAX_NURSES,
            nurse_count,
        )
        normalization_module.MAX_LARGE_FLOOR_ROOMS = max(
            normalization_module.MAX_LARGE_FLOOR_ROOMS,
            room_count,
        )
    benchmark_model = normalize_shift_snapshot(snapshot).model
    mixed_radix_room_search_enabled = _resolve_mixed_radix_room_search(
        len(benchmark_model.occupied_beds),
        use_mixed_radix_room_search,
    )
    attempt_results: list[dict[str, object]] = []

    for attempt_number in range(1, attempts + 1):
        started_at = time.monotonic()
        try:
            normalization = normalize_shift_snapshot(snapshot)
            solution = solve_optimizer(
                normalization.model,
                solve_budget_seconds=budget_seconds,
                use_rolling_stage_hints=use_rolling_stage_hints,
                canonical_room_chunk_size=canonical_room_chunk_size,
                canonical_bed_owner_chunk_size=canonical_bed_owner_chunk_size,
                use_team_feasibility_cuts=use_team_feasibility_cuts,
                search_worker_count=search_worker_count,
                use_fixed_canonical_search=use_fixed_canonical_search,
                split_fixed_canonical_search=split_fixed_canonical_search,
                fixed_bed_owner_block_size=fixed_bed_owner_block_size,
                use_mixed_radix_room_search=use_mixed_radix_room_search,
                use_fixed_gap_bounds=use_fixed_gap_bounds,
                use_structural_red_rank_bound=use_structural_red_rank_bound,
                use_mixed_radix_bed_owner_search=use_mixed_radix_bed_owner_search,
            )
            output = build_assignment_output(normalization.model, solution)
        except OptimizerSolveError as error:
            attempt_result = {
                "attempt": attempt_number,
                "status": (
                    "timed_out"
                    if isinstance(error, OptimizerTimedOutError)
                    else "failed"
                ),
                "durationSeconds": round(time.monotonic() - started_at, 3),
                "peakResidentBytes": peak_resident_bytes(),
                "failedStage": error.stage,
                "solverStatus": error.status.name,
            }
            if error.diagnostics is not None:
                attempt_result["failureDiagnostics"] = error.diagnostics.to_dict()
            attempt_results.append(attempt_result)
            continue
        duration_seconds = time.monotonic() - started_at
        attempt_result = {
            "attempt": attempt_number,
            "status": "optimal",
            "durationSeconds": round(duration_seconds, 3),
            "peakResidentBytes": peak_resident_bytes(),
            "decisionFingerprint": decision_fingerprint(solution),
            "assignedBedCount": len(output.assignment_result.bed_assignments),
            "unassignedBedCount": solution.objectives.unassigned_count,
        }
        if include_stage_timings:
            attempt_result["stageTimingsMs"] = {
                    stage.name: round(stage.duration_ms, 3)
                    for stage in solution.stage_trace
            }
        attempt_results.append(attempt_result)

    durations = [float(result["durationSeconds"]) for result in attempt_results]
    successful_attempts = [
        result for result in attempt_results if result["status"] == "optimal"
    ]
    fingerprints = {
        str(result["decisionFingerprint"]) for result in successful_attempts
    }
    peak_values = [
        int(result["peakResidentBytes"])
        for result in attempt_results
        if result["peakResidentBytes"] is not None
    ]
    return {
        "variant": "understaffed" if understaffed else "full",
        "rollingStageHints": use_rolling_stage_hints,
        "canonicalRoomChunkSize": canonical_room_chunk_size,
        "canonicalBedOwnerChunkSize": canonical_bed_owner_chunk_size,
        "teamFeasibilityCuts": use_team_feasibility_cuts,
        "searchWorkerCount": search_worker_count,
        "fixedCanonicalSearch": use_fixed_canonical_search,
        "splitFixedCanonicalSearch": split_fixed_canonical_search,
        "fixedBedOwnerBlockSize": fixed_bed_owner_block_size,
        "mixedRadixRoomSearch": mixed_radix_room_search_enabled,
        "mixedRadixRoomSearchOverride": (
            "auto"
            if use_mixed_radix_room_search is None
            else "enabled" if use_mixed_radix_room_search else "disabled"
        ),
        "fixedGapBounds": use_fixed_gap_bounds,
        "structuralRedRankBound": (
            use_structural_red_rank_bound
            if use_structural_red_rank_bound is not None
            else len(benchmark_model.occupied_beds) > 50
        ),
        "structuralRedRankBoundOverride": (
            "auto"
            if use_structural_red_rank_bound is None
            else "enabled" if use_structural_red_rank_bound else "disabled"
        ),
        "mixedRadixBedOwnerSearch": (
            use_mixed_radix_bed_owner_search
            if use_mixed_radix_bed_owner_search is not None
            else len(benchmark_model.occupied_beds) > 50
            and any(
                result.get("unassignedBedCount") == 0
                for result in successful_attempts
            )
        ),
        "mixedRadixBedOwnerSearchOverride": (
            "auto"
            if use_mixed_radix_bed_owner_search is None
            else "enabled" if use_mixed_radix_bed_owner_search else "disabled"
        ),
        "counts": {
            "doctorSides": len(benchmark_model.doctor_sides),
            "rooms": len(benchmark_model.rooms),
            "occupiedBeds": len(benchmark_model.occupied_beds),
            "nurses": len(benchmark_model.nurses),
            "teams": benchmark_model.team_count,
            "configuredMaxPatientLoad": max(
                nurse.max_patient_load for nurse in benchmark_model.nurses
            ),
        },
        "attempts": attempt_results,
        "summary": {
            "attemptCount": attempts,
            "optimalCount": len(successful_attempts),
            "timedOutCount": sum(
                result["status"] == "timed_out" for result in attempt_results
            ),
            "failedCount": sum(
                result["status"] == "failed" for result in attempt_results
            ),
            "medianSeconds": round(statistics.median(durations), 3),
            "p95Seconds": round(percentile_95(durations), 3),
            "peakResidentBytes": max(peak_values) if peak_values else None,
            "deterministic": len(successful_attempts) == attempts
            and len(fingerprints) == 1,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the Phase 9 synthetic maximum-floor benchmark."
    )
    parser.add_argument("--attempts", type=int, default=1)
    parser.add_argument("--budget-seconds", type=float, default=120.0)
    parser.add_argument("--rooms", type=int)
    parser.add_argument("--beds", type=int)
    parser.add_argument("--nurses", type=int)
    parser.add_argument(
        "--max-patient-load",
        type=int,
        help="Override every synthetic nurse and side maximum for this probe.",
    )
    parser.add_argument(
        "--include-stage-timings",
        action="store_true",
        help="Include every exact objective-stage duration for detailed evidence.",
    )
    parser.add_argument(
        "--rolling-stage-hints",
        choices=("enabled", "disabled"),
        default="enabled",
        help="A/B switch for reusing each proven solution as the next-stage hint.",
    )
    parser.add_argument(
        "--canonical-room-chunk-size",
        type=int,
        default=5,
        help="Number of canonical room ranks proved by one mixed-radix solve.",
    )
    parser.add_argument(
        "--canonical-bed-owner-chunk-size",
        type=int,
        default=DEFAULT_CANONICAL_BED_OWNER_CHUNK_SIZE,
        help="Number of canonical owner ranks proved by one mixed-radix solve.",
    )
    parser.add_argument(
        "--team-feasibility-cuts",
        choices=("enabled", "disabled"),
        default="enabled",
        help="A/B switch for implied team census and RN/red capacity limits.",
    )
    parser.add_argument(
        "--search-workers",
        type=int,
        default=1,
        help="Number of internal CP-SAT search workers used by each solve.",
    )
    parser.add_argument(
        "--fixed-canonical-search",
        choices=("enabled", "disabled"),
        default="enabled",
        help="A/B switch for one complete lowest-rank-first canonical search.",
    )
    parser.add_argument(
        "--split-fixed-canonical-search",
        choices=("enabled", "disabled"),
        default="enabled",
        help="A/B switch for separate exact room, owner, and membership passes.",
    )
    parser.add_argument(
        "--fixed-bed-owner-block-size",
        type=int,
        default=0,
        help="Exact owners per fixed pass; zero keeps one all-owner pass.",
    )
    parser.add_argument(
        "--mixed-radix-room-search",
        choices=("auto", "enabled", "disabled"),
        default="auto",
        help=(
            "A/B switch for presolved exact room chunks before fixed owners; "
            "auto enables it above 50 occupied beds."
        ),
    )
    parser.add_argument(
        "--fixed-gap-bounds",
        choices=("enabled", "disabled"),
        default="disabled",
        help="A/B switch for implied bounds after exact team-gap proofs.",
    )
    parser.add_argument(
        "--structural-red-rank-bound",
        choices=("auto", "enabled", "disabled"),
        default="auto",
        help="A/B switch for the exact structural red-rank lower-bound proof.",
    )
    parser.add_argument(
        "--mixed-radix-bed-owner-search",
        choices=("auto", "enabled", "disabled"),
        default="auto",
        help="A/B switch for exact presolved bed-owner chunks.",
    )
    parser.add_argument(
        "--variant",
        choices=("full", "understaffed", "both"),
        default="both",
    )
    args = parser.parse_args()
    if args.attempts < 1:
        parser.error("--attempts must be at least 1")
    if args.budget_seconds <= 0:
        parser.error("--budget-seconds must be positive")
    if args.canonical_room_chunk_size < 1:
        parser.error("--canonical-room-chunk-size must be at least 1")
    if args.canonical_bed_owner_chunk_size < 1:
        parser.error("--canonical-bed-owner-chunk-size must be at least 1")
    if args.search_workers < 1:
        parser.error("--search-workers must be at least 1")
    if args.fixed_bed_owner_block_size < 0:
        parser.error("--fixed-bed-owner-block-size must be zero or positive")
    if args.max_patient_load is not None and not 1 <= args.max_patient_load <= 12:
        parser.error("--max-patient-load must be between 1 and 12")
    custom_counts = (args.rooms, args.beds, args.nurses)
    if any(value is not None for value in custom_counts) and not all(
        value is not None for value in custom_counts
    ):
        parser.error("--rooms, --beds, and --nurses must be supplied together")
    if all(value is not None for value in custom_counts):
        if args.rooms < 1 or args.beds < args.rooms or args.nurses < 1:
            parser.error(
                "custom counts require positive rooms/nurses and at least one bed per room"
            )

    mixed_radix_room_search_override = (
        None
        if args.mixed_radix_room_search == "auto"
        else args.mixed_radix_room_search == "enabled"
    )
    structural_red_rank_bound_override = (
        None
        if args.structural_red_rank_bound == "auto"
        else args.structural_red_rank_bound == "enabled"
    )
    mixed_radix_bed_owner_search_override = (
        None
        if args.mixed_radix_bed_owner_search == "auto"
        else args.mixed_radix_bed_owner_search == "enabled"
    )

    variants = []
    if args.variant in {"full", "both"}:
        variants.append(
            run_variant(
                understaffed=False,
                attempts=args.attempts,
                budget_seconds=args.budget_seconds,
                include_stage_timings=args.include_stage_timings,
                room_count=args.rooms,
                bed_count=args.beds,
                nurse_count=args.nurses,
                max_patient_load=args.max_patient_load,
                use_rolling_stage_hints=args.rolling_stage_hints == "enabled",
                canonical_room_chunk_size=args.canonical_room_chunk_size,
                canonical_bed_owner_chunk_size=(
                    args.canonical_bed_owner_chunk_size
                ),
                use_team_feasibility_cuts=args.team_feasibility_cuts == "enabled",
                search_worker_count=args.search_workers,
                use_fixed_canonical_search=(
                    args.fixed_canonical_search == "enabled"
                ),
                split_fixed_canonical_search=(
                    args.split_fixed_canonical_search == "enabled"
                ),
                fixed_bed_owner_block_size=(
                    args.fixed_bed_owner_block_size or None
                ),
                use_mixed_radix_room_search=mixed_radix_room_search_override,
                use_fixed_gap_bounds=args.fixed_gap_bounds == "enabled",
                use_structural_red_rank_bound=structural_red_rank_bound_override,
                use_mixed_radix_bed_owner_search=(
                    mixed_radix_bed_owner_search_override
                ),
            )
        )
    if args.variant in {"understaffed", "both"}:
        variants.append(
            run_variant(
                understaffed=True,
                attempts=args.attempts,
                budget_seconds=args.budget_seconds,
                include_stage_timings=args.include_stage_timings,
                room_count=args.rooms,
                bed_count=args.beds,
                nurse_count=args.nurses,
                max_patient_load=args.max_patient_load,
                use_rolling_stage_hints=args.rolling_stage_hints == "enabled",
                canonical_room_chunk_size=args.canonical_room_chunk_size,
                canonical_bed_owner_chunk_size=(
                    args.canonical_bed_owner_chunk_size
                ),
                use_team_feasibility_cuts=args.team_feasibility_cuts == "enabled",
                search_worker_count=args.search_workers,
                use_fixed_canonical_search=(
                    args.fixed_canonical_search == "enabled"
                ),
                split_fixed_canonical_search=(
                    args.split_fixed_canonical_search == "enabled"
                ),
                fixed_bed_owner_block_size=(
                    args.fixed_bed_owner_block_size or None
                ),
                use_mixed_radix_room_search=mixed_radix_room_search_override,
                use_fixed_gap_bounds=args.fixed_gap_bounds == "enabled",
                use_structural_red_rank_bound=structural_red_rank_bound_override,
                use_mixed_radix_bed_owner_search=(
                    mixed_radix_bed_owner_search_override
                ),
            )
        )

    report = {
        "runtime": {
            "platform": platform.platform(),
            "pythonVersion": platform.python_version(),
            "ortoolsVersion": ortools.__version__,
        },
        "solveBudgetSeconds": args.budget_seconds,
        "variants": variants,
    }
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

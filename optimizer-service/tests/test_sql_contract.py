from __future__ import annotations

import re
import unittest
from pathlib import Path


SQL_PATH = Path(__file__).resolve().parents[1] / "sql" / "phase9_optimizer_server.sql"


class SqlContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sql = SQL_PATH.read_text(encoding="utf-8").lower()

    def test_run_table_does_not_store_the_full_snapshot(self) -> None:
        table_sql = self.sql.split("create table if not exists public.optimizer_runs", 1)[1]
        table_sql = table_sql.split(");", 1)[0]
        self.assertNotIn("shift_snapshot", table_sql)
        self.assertNotIn("patient", table_sql)
        self.assertNotIn("diagnosis", table_sql)

    def test_idempotency_and_concurrent_run_indexes_are_present(self) -> None:
        self.assertIn("create unique index if not exists optimizer_runs_idempotency", self.sql)
        self.assertIn("create unique index if not exists optimizer_runs_one_running_initial", self.sql)
        self.assertIn("create unique index if not exists optimizer_runs_one_running_rerun", self.sql)

    def test_identical_retry_is_checked_before_current_preconditions(self) -> None:
        prepare_sql = self.sql.split("create or replace function public.prepare_optimizer_run", 1)[1]
        prepare_sql = prepare_sql.split("revoke all on function public.prepare_optimizer_run", 1)[0]
        retry_lookup = prepare_sql.index("if existing_run_found then")
        stale_check = prepare_sql.index("if not current_preconditions_match then", retry_lookup)
        self.assertLess(retry_lookup, stale_check)

    def test_running_retry_lease_expires_after_the_host_timeout(self) -> None:
        self.assertIn("interval '150 seconds'", self.sql)

    def test_prepare_and_finalize_use_the_same_lock_order(self) -> None:
        prepare_sql = self.sql.split("create or replace function public.prepare_optimizer_run", 1)[1]
        prepare_sql = prepare_sql.split("revoke all on function public.prepare_optimizer_run", 1)[0]
        finalize_sql = self.sql.split("create or replace function public.finalize_optimizer_run", 1)[1]
        self.assertLess(
            prepare_sql.index("from public.optimizer_runs"),
            prepare_sql.index("from public.active_shifts"),
        )
        self.assertLess(
            finalize_sql.index("from public.optimizer_runs"),
            finalize_sql.index("from public.active_shifts"),
        )

    def test_only_authenticated_can_prepare_and_only_service_can_finalize(self) -> None:
        self.assertRegex(
            self.sql,
            re.compile(r"grant execute on function public\.prepare_optimizer_run\([\s\S]*?to authenticated;"),
        )
        self.assertRegex(
            self.sql,
            re.compile(r"grant execute on function public\.finalize_optimizer_run\([\s\S]*?to service_role;"),
        )
        self.assertNotRegex(
            self.sql,
            re.compile(r"grant execute on function public\.finalize_optimizer_run\([\s\S]*?to authenticated;"),
        )

    def test_legacy_client_authored_rerun_is_revoked(self) -> None:
        self.assertRegex(
            self.sql,
            re.compile(
                r"revoke all on function public\.rerun_active_shift_assignment"
                r"\(uuid, text, jsonb\) from public, anon, authenticated"
            ),
        )

    def test_only_success_path_updates_active_shift(self) -> None:
        finalize_sql = self.sql.split("create or replace function public.finalize_optimizer_run", 1)[1]
        self.assertEqual(finalize_sql.count("update public.active_shifts"), 1)
        success_update = finalize_sql.index("update public.active_shifts")
        validation = finalize_sql.index("validation_error :=")
        self.assertGreater(success_update, validation)

    def test_success_updates_shift_before_superseding_moves_and_completing_run(self) -> None:
        finalize_sql = self.sql.split("create or replace function public.finalize_optimizer_run", 1)[1]
        active_shift_update = finalize_sql.index("update public.active_shifts")
        override_update = finalize_sql.index("update public.manual_assignment_overrides")
        run_success_update = finalize_sql.index("update public.optimizer_runs", override_update)
        self.assertLess(active_shift_update, override_update)
        self.assertLess(override_update, run_success_update)

    def test_optimizer_never_inserts_notifications_or_patient_details(self) -> None:
        self.assertNotIn("insert into public.notification_events", self.sql)
        self.assertNotIn("patient", self.sql.split("create table if not exists public.optimizer_runs", 1)[1].split(");", 1)[0])

    def test_rerun_preconditions_are_rechecked_before_override_supersession(self) -> None:
        finalize_sql = self.sql.split("create or replace function public.finalize_optimizer_run", 1)[1]
        revision_check = finalize_sql.index(
            "shift_row.updated_at is distinct from run_row.expected_shift_revision"
        )
        baseline_check = finalize_sql.index(
            "run_row.expected_baseline_assignment_result_id",
            revision_check,
        )
        override_update = finalize_sql.index("update public.manual_assignment_overrides")
        self.assertLess(revision_check, override_update)
        self.assertLess(baseline_check, override_update)


if __name__ == "__main__":
    unittest.main()

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

    def test_identical_retry_is_checked_before_current_preconditions(self) -> None:
        prepare_sql = self.sql.split("create or replace function public.prepare_optimizer_run", 1)[1]
        prepare_sql = prepare_sql.split("revoke all on function public.prepare_optimizer_run", 1)[0]
        retry_lookup = prepare_sql.index("if existing_run_found then")
        stale_check = prepare_sql.index("if not current_preconditions_match then", retry_lookup)
        self.assertLess(retry_lookup, stale_check)

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

    def test_only_success_path_updates_active_shift(self) -> None:
        finalize_sql = self.sql.split("create or replace function public.finalize_optimizer_run", 1)[1]
        self.assertEqual(finalize_sql.count("update public.active_shifts"), 1)
        success_update = finalize_sql.index("update public.active_shifts")
        validation = finalize_sql.index("validation_error :=")
        self.assertGreater(success_update, validation)


if __name__ == "__main__":
    unittest.main()

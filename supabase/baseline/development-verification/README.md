# Development restore verification

Applied the prepared `restore-development.draft.sql` to **nurseflow-go-dev** (`nmitctyxtjmlakcsmnuj`) on 2026-09-13, through its SQL Editor. The script completed; subsequent read-only queries verified the committed objects. The original script is retained byte-for-byte under its draft filename for traceability; its historical unexecuted comment is superseded by this record and the applied hash in `result.json`.

## Verified against the source capture

- 29 function definitions, identities, owners, settings, and ACLs match (normalizing line endings and ACL array order).
- 11 tables and one sequence match including ownership, RLS flags, and ACLs.
- 108 columns, 27 indexes, seven enabled trigger definitions, 22 policies, sequence metadata, and six default ACL entries match.
- All 65 constraints are present. Two checks on `nurse_request_messages` are deparsed with flatter AND grouping; predicates and meaning are unchanged. Full differences are preserved in `comparison.json`.
- `supabase_realtime` settings and the membership/columns of `active_shifts` and `nurse_request_messages` match.
- Supabase-managed message publication/dated partitions were not copied; they are outside this application restore.
- Every one of the 11 application tables has zero rows, confirmed by SELECT count(*).

This verifies the schema restore, not end-to-end application behavior. Auth configuration, synthetic accounts, application environment setup, cross-user behavior, and a live Realtime walkthrough remain pending. Production was not modified.

The verification queries reuse `capture-catalog.sql` and `capture-functions.sql`, with `SET LOCAL search_path = public` after BEGIN READ ONLY to keep deparsed definitions comparable. Captured results and comparison output are retained here.

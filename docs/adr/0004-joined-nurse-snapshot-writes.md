# Let joined nurses update their shift row; Go limits the change to requests

Accepted on 2026-10-24 for Go migration milestone 5. A joined nurse submits an
issue or swap request by appending to `active_shifts.shift_snapshot ->
nurseRequests`. The existing `SECURITY DEFINER` functions bypass RLS to do this.
Go instead receives a joined-nurse UPDATE policy on `active_shifts`, limited to
unended shifts where `go_private.caller_has_linked_access(id)` is true (the
baseline functions do not check the shift status either).
Go code guarantees that only one new request is appended; a pure function builds
the next snapshot and is unit-tested.

Row-level security cannot restrict which JSON keys change, so the database still
enforces "only a shift you are linked to" while the "append only" rule lives in
Go. This is the same row-level boundary the charge owner already has. A narrow
`go_private` append function would enforce more in the database but would keep
part of the write workflow in PL/pgSQL, which this migration is retiring; calling
the existing functions would not migrate the workflow at all.

Request threads use the same approach: a `go_private.caller_is_thread_actor`
yes/no predicate mirrors `get_nurse_request_thread_actor` (which depends on
`auth.uid()`, unset for the Go role) for the message read and insert policies.

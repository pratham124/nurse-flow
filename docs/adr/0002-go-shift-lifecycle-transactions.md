# Protect shift setup revisions and commit End Shift together

Accepted on 2026-10-18 for Go migration milestone 3. Setup saves must carry the
`updated_at` value from the original draft and reject stale or assigned shifts.
Go merges only setup-owned fields into the locked stored snapshot, preserving
assignment and request fields. This avoids pairing old screen contents with a
newer workspace revision and silently overwriting concurrent changes.

End Shift derives carry-over from the authoritative stored snapshot and replaces
previous suggestions, expires active invites, and closes the shift in one
transaction. A failure rolls back all effects. It retains linked access rows so
the existing joined-nurse workflow continues to report `shift_ended`. Existing
database triggers remain responsible for broadcasts and notification effects.

Reopen retains its existing expected-baseline check and no-baseline no-op. The
template is locked before its shift when ending, matching template deletion's
foreign-key lock order. No optimizer-run lock is acquired after a shift lock.

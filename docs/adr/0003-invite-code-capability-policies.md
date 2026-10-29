# Let a presented invite code unlock only its own invite

Accepted on 2026-10-24 for Go migration milestone 4. Joining a shift requires
reading another charge nurse's invite and shift, which the existing
`SECURITY DEFINER` functions do by bypassing RLS. Go keeps ADR 0001's limited
role instead: it hashes the code the user presented and sets that hash as a
transaction-local setting beside the verified Auth user ID. Separate Go-role
policies allow only the invite with that exact hash, the shift it references,
marking that invite used, and linking that shift's nurse slot to the caller's
own profile.

Calling the existing functions would leave the join logic in PL/pgSQL, and
granting Go unrestricted invite/shift access would remove the database
protection ADR 0001 kept. Knowing the code is already the real permission, so
the database enforces the same boundary. The unlocked shift row still contains
the whole snapshot; Go's pre-join and join responses must stay limited to the
nurse name, floor name, and expiry, matching the current functions.

Postgres rejects policies that reference each other in a cycle (the existing
invite and access policies already read `active_shifts`). The two new
`active_shifts` checks therefore call small `SECURITY DEFINER` predicates in a
`go_private` schema that only `nurseflow_go` may use. Each answers yes/no for
one shift — "the presented hash belongs to an invite for it" or "the caller has
linked access to it" — and returns no row data.

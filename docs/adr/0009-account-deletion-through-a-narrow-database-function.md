# Account deletion through a narrow database function, not the Auth admin key

Accepted on 2026-11-07 for milestone 8 (ticket 25). Apple requires in-app account
deletion for apps that let people create accounts. `DELETE /profile` on the Go
API deletes the caller's account by calling `go_private.delete_current_account()`.
That function is `SECURITY DEFINER`, owned by `postgres`, takes no arguments, and
can be executed only by `nurseflow_go`. It reads the same transaction setting,
`nurseflow.auth_user_id`, that Go sets from the verified access token for every
`go_*` policy ([ADR 0001](0001-go-database-ownership-checks.md)), and deletes that
one `auth.users` row. Postgres foreign keys do the rest: the Auth user's sessions
and identities, the application profile, and everything the profile owns. The three
references that were `ON DELETE RESTRICT` (messages, manual moves, assignment runs)
became `CASCADE`, because a person's deletion must remove what they created.

Deletes send no Realtime broadcasts, so the function first makes the same updates
the app already reacts to. It ends the caller's open shifts, so joined nurses see
"Shift ended" live. It also marks the caller's nurse access on other charges'
shifts as removed, so those charges can invite someone new. Then it deletes.

We rejected giving Go Supabase's secret key and calling the Auth admin API. That key
can delete or impersonate any user, and Go would hold it for every request just
to serve this one. The function gives exactly one power: delete the user this
transaction runs as. We also rejected a function that takes a user ID. A bug in
Go could then delete someone else. Without an argument, the worst a bug can do is
act on the caller.

The trust boundary is unchanged: as for every Go policy, the database relies on Go
to set the identity only from a verified token. An access token issued before the
deletion stays cryptographically valid until it expires, but it reaches nothing.
Go finds no profile and answers 403 `profile_missing`, the client roles have no
table access ([ADR 0008](0008-clients-reach-data-only-through-go.md)), and
Realtime authorization finds no profile.

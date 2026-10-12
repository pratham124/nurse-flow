# Profile resolution and charge-nurse authorization

Task 8 is complete. It adds the authorization step after Task 7's token verification. A Supabase Auth UUID identifies the signed-in user; a separate NurseFlow profile UUID identifies the application profile and owns floor templates. They are not interchangeable.

## Agreed behavior

On 2026-10-11, the user chose distinct missing-profile and forbidden-role errors, plus a separate `GET /auth/charge-check` diagnostic. The existing `/auth/check` remains authentication-only, so regular nurses can still use it. A read never creates a profile. Template listing and Expo integration remain tasks 9 and 10.

| Request outcome | HTTP status | Error code |
| --- | --- | --- |
| Missing, invalid, or expired token | 401 | `unauthenticated` |
| Token verification keys unavailable | 503 | `auth_unavailable` |
| Verified user has no visible application profile | 403 | `profile_missing` |
| Profile role is not `charge_nurse` | 403 | `forbidden` |
| Database lookup or transaction fails | 503 | `database_unavailable` |
| Missing middleware context or inconsistent profile identity | 500 | `internal_error` |

Errors retain the existing `{ "error": { "code": "...", "message": "..." } }` format. Public responses contain no driver errors, tokens, or credentials and use `Cache-Control: no-store`.

Successful charge authorization returns only:

```json
{"profile_id":"<application profile UUID>","role":"charge_nurse"}
```

## Implementation and Go concepts

- `backend/internal/database/profiles.go`: `ProfileByAuthUserID` uses the existing `WithIdentity` read-only transaction, transaction-local RLS identity, and five-second deadline. A parameterized `auth_user_id` filter adds an explicit ownership condition. GORM's `Take` reports `ErrRecordNotFound` for an absent row; the method translates that into `ErrProfileNotFound`, while other errors remain operation failures. UUID case is normalized. Existing uniqueness guarantees one profile per Auth user.
- `backend/internal/auth/profile.go`: `RequireChargeNurse` gets the verified identity from request context, resolves the profile, and requires its database role to equal `charge_nurse`. It does not read identity from query parameters, headers, profile IDs, or user metadata. The JWT's `authenticated` database-role claim does not establish a nurse role.
- `ProfileReader` is a small Go interface: any type with the declared lookup method satisfies it. The real database store supplies that method; tests supply a controlled reader without a database. This keeps role/error tests separate from Postgres integration checks.
- `ProfileFromContext` retrieves the authorized profile for a downstream handler. A private key type prevents accidental context-key collisions. No profile is cached across requests, so the next request reads the current database role.
- `backend/cmd/api/main.go`: opens the development store once, passes it to the router, and defers pool closure when `run` returns. `/auth/charge-check` composes token verification, profile authorization, then the diagnostic handler. `/health` and `/auth/check` perform no database queries, but the process now requires valid database configuration and connectivity at startup. A database outage after startup produces a controlled 503 on the charge route; startup failure exits before listening.

The existing schema, role grants, and RLS policies already support this lookup. No migration, profile creation, new dependencies, template endpoint, or Expo changes are introduced. [ADR 0001](../adr/0001-go-database-ownership-checks.md) remains the applicable database authorization decision.

## Manual development requests

Use the private settings from [Task 6 database setup](database-connection.md#private-configuration-and-connection-check), including `NURSEFLOW_DB_SSLROOTCERT` when required. Then run from `backend`:

```powershell
go run ./cmd/api
```

In a second terminal, use a current access token obtained through the existing development sign-in flow. Keep the token private:

```powershell
$task8Token = Read-Host 'Current development access token' -AsSecureString
$task8Headers = @{
  Authorization = 'Bearer ' + [System.Net.NetworkCredential]::new('', $task8Token).Password
}
Invoke-RestMethod -Uri http://127.0.0.1:8080/auth/check -Headers $task8Headers
Invoke-RestMethod -Uri http://127.0.0.1:8080/auth/charge-check -Headers $task8Headers
```

Alpha and Beta each receive their own application profile ID and `charge_nurse`. A regular nurse receives 200 from `/auth/check` and 403 `forbidden` from `/auth/charge-check`. Without a token, the charge route returns 401. PowerShell reports non-success statuses as exceptions; the JSON response body identifies the error. Adding `?profile_id=another-profile&auth_user_id=another-user&role=charge_nurse` cannot change the selected profile or role.

Missing-profile behavior is exercised using an unknown UUID in isolated integration tests and a signed synthetic token in middleware tests; do not delete a live fixture merely to test it. Database-error behavior is exercised with a controlled failing reader. Afterward, clear `$task8Headers` and `$task8Token` and stop the API with Ctrl+C.

## Verification

Ordinary Go tests check the full token-verification/authorization middleware chain using signed synthetic ES256 tokens: authorized profile context, regular and unsupported roles, missing profiles, database failures, inconsistent profile identity, ignored client identity inputs, and database short-circuiting for unverified requests. Reusing the same token after a simulated database role change proves that authorization reads the role again. Router tests check rejection on both diagnostic routes and preserve health behavior.

Opt-in `TestDatabaseOwnershipIntegration` now also calls the actual profile lookup for Alpha, Beta, Regular, and Unknown. It verifies distinct Auth/profile IDs, UUID normalization, the missing-profile sentinel, invalid identity rejection, cancellation handling, and transaction identity cleanup on the reused pool connection. The earlier RLS/grant checks remain intact.

Run ordinary checks from `backend`:

```powershell
go test ./...
go vet ./...
go test -race ./...
```

For development database integration, use the existing private database settings and fixture variables documented in Task 6, then run:

```powershell
go test ./internal/database -run TestDatabaseOwnershipIntegration -v -count=1
```

Verification on 2026-10-11:

- `go test ./...` and `go vet ./...` passed. After the final router test was added, all packages passed `go test -race ./... -count=1` with database integration enabled; final static and whitespace checks passed too.
- Isolated PostgreSQL 17 with UTF-8 encoding, the existing local fixture, and the unchanged role migration passed Alpha, Beta, Regular, and Unknown checks through the actual `ProfileByAuthUserID` implementation. Existing ownership, grant, and pooled-identity checks also passed. An older SQL_ASCII test cluster could not serve the driver's simple-protocol queries; verification used a fresh UTF-8 cluster instead.
- The router test used synthetic ES256 discovery/signing fixtures and confirmed the exact two-field charge response, regular-role rejection on the charge route, and continued regular-role success on the authentication-only route. Middleware tests confirmed controlled missing-profile and database-failure responses.
- Temporary local servers were stopped, and the temporary database/role added to the older test cluster were removed. Automatic approval review blocked deletion of the new stopped cluster and its setup/log files under `.scratch/task8-*`; those artifacts remain on disk and are excluded by `.gitignore` so they do not clutter the change list. No development Supabase schema, credentials, accounts, or app paths changed. A live development authorization walkthrough has not been claimed; private credentials are not present in the agent command environment. The manual commands above are available for that check.

## References

- [GORM single-record queries and missing rows](https://gorm.io/docs/query.html)
- [GORM error handling](https://gorm.io/docs/error_handling.html)
- [Supabase application user tables and RLS](https://supabase.com/docs/guides/auth/managing-user-data)

The current Supabase changelog and its PostgreSQL minor-release notice were reviewed before implementation. The announced extension/operator changes do not affect this existing UUID profile lookup.

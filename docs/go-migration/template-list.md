# Floor-template list endpoint

Task 9 is complete. Local verification and the required development Postgres isolation check passed on 2026-10-17. Task 10's Expo integration is implemented; its verification status is recorded in `expo-template-read.md`.

## Agreed contract

The user selected option 1 on 2026-10-17: return database-shaped rows and retain the existing frontend mapper.

- `GET /floor-templates`, using a current development Supabase bearer access token.
- Token verification and charge-nurse profile authorization run before the template query.
- Success is HTTP 200 with `{"templates":[...]}`. Each row has exactly `id`, `owner_profile_id`, `name`, `template_snapshot`, `created_at`, and `updated_at`.
- No rows is HTTP 200 with `{"templates":[]}`, never null.
- Templates are filtered by the authorized application's profile ID and ordered only by `updated_at DESC`. Equal update times have no promised relative order. No pagination, client owner selection, or secondary sort is added.
- Missing/invalid/expired tokens receive 401; a missing profile or forbidden role receives Task 8's distinct 403 errors. Key discovery failure retains 503 `auth_unavailable`; database query failures receive 503 `database_unavailable`. A failed query never returns a partial list.
- JSON responses use `Cache-Control: no-store`. Driver details and credentials are not exposed.

Example shape:

```json
{
  "templates": [
    {
      "id": "30000000-0000-0000-0000-000000000001",
      "owner_profile_id": "10000000-0000-0000-0000-000000000001",
      "name": "Migration Test Floor",
      "template_snapshot": {
        "doctorSides": [],
        "rooms": [],
        "beds": []
      },
      "created_at": "2026-10-01T00:00:00Z",
      "updated_at": "2026-10-17T12:00:00Z"
    }
  ]
}
```

The identifiers and empty arrays above illustrate the contract, not the current live fixture. Timestamps encode as RFC 3339 strings representing the stored instants, preserving fractional seconds.

## Implementation and Go concepts

`internal/database/templates.go` adds `Store.FloorTemplatesByProfile`. Its Auth/profile arguments come from the server-authorized profile. It uses the existing read-only `WithIdentity` transaction and its five-second deadline/statement timeout. The explicit `owner_profile_id` condition and unchanged RLS policy both restrict the read. RLS also checks the profile's current charge-nurse role. An invalid profile UUID fails before querying; failures discard any partial rows.

The query uses `Find`, which treats zero rows as success. A slice made with `make([]FloorTemplate, 0)` encodes as an empty JSON array. The handler also normalizes a nil slice from a reader to preserve that HTTP contract.

`internal/database/models.go` adds JSON field-name tags to the existing template mapping; no database structure changes. `json.RawMessage` embeds the stored snapshot as JSON rather than a quoted JSON string.

`internal/httpapi/floor_templates.go` defines the one-method `FloorTemplateReader` interface, list envelope, and handler. It gets the profile from request context and supplies its Auth/profile IDs to the reader. Request parameters and identity headers are never used for ownership. `cmd/api/main.go` injects the verifier and readers into `httpapi.NewHandler`; `internal/httpapi/handler.go` registers the routes and wraps them with token verification and charge authorization. HTTP tests live beside these handlers.

The snapshot is deliberately unchanged. Task 10 moves the existing `mapTemplateRow` / `requireFloorTemplateSnapshot` into `src/services/floorTemplateRepository.ts`, where they continue to validate the three arrays, shallow-copy their elements, discard unknown top-level snapshot fields, and use the row's ID/name. Go does not tighten array-element validation or silently skip malformed snapshots. Expo now uses Go for the template-list read and reuses this mapper for the retained Supabase template writes.

## Verification

- [x] `go test -race ./... -count=1` passed with isolated database integration enabled.
- [x] `go vet ./...` passed.
- [x] HTTP tests send requests through the router and actual token verifier using synthetic ES256 keys and a controlled database reader. Cases cover exact response fields, unchanged snapshots, timestamp precision, empty/nil results, ignored client identity inputs, regular/missing profiles, query failures without leaked details or partial data, and token rejection before database access.
- [x] After the HTTP package move, `go test -race ./... -count=1` and `go vet ./...` passed. HTTP tests now run in `internal/httpapi`; missing/expired token checks and unsupported method/path cases are included.
- [x] Actual Postgres queries passed owner/cross-owner/regular/unknown checks and pooled-identity cleanup. Additional local-only Gamma/Delta fixtures verify two nonempty owners, descending ordering, and ties without a secondary-order assumption.
- [x] `TestTemplateListIsolationIntegration` against development Supabase passed through `scripts/development.ps1 TestTemplates` on 2026-10-17. All seven subtests passed; the parent test took 4.00 seconds (package time 5.379 seconds). The agent used the saved dedicated-role credential through an approved same-account command and did not display it.
- [ ] Optional manual real-token endpoint requests; the full Expo walkthrough remains Task 11.

The local cluster used UTF-8 PostgreSQL 17 in the OS temporary directory rather than the Git workspace and was stopped and removed after verification. It loaded `internal/database/testdata/schema.sql`, the existing role migration, and the new local-only `testdata/template-list.sql`. These fixture scripts must never be applied to Supabase. No development schema, grants, policies, or fixture records were changed.

The pre-existing ownership test and the new tests share `openIntegrationStore`. With no local override they use the development-only configuration and limited `nurseflow_go` role. The new live isolation test performs SELECT queries only.

## Live isolation check

The saved-credential helper now provides the shortest repeatable command from `backend`:

```powershell
./scripts/development.ps1 TestTemplates
```

This command passed all seven live subtests. The original manual environment setup is retained below as an alternative.

From `backend`, in the terminal configured with Task 6's private database settings and certificate:

```powershell
Remove-Item Env:NURSEFLOW_TEST_DATABASE_URL -ErrorAction SilentlyContinue
$env:NURSEFLOW_DATABASE_TESTS = '1'
$env:NURSEFLOW_TEST_ALPHA_ID = '4ea34fc9-d17b-411e-83a0-8a82cf9b8977'
$env:NURSEFLOW_TEST_BETA_ID = '5e7093ff-d8ea-4734-ae77-73a3906f936e'
$env:NURSEFLOW_TEST_REGULAR_ID = '712ae250-d0c6-4af4-b19e-ee7844d0c295'
go test ./internal/database -run '^TestTemplateListIsolationIntegration$' -v -count=1
```

This expects Alpha's one template and Beta's empty list, then attempts cross-owner reads in both directions. Regular and unknown identities also receive no templates at the database boundary. The HTTP middleware separately rejects those identities before the list query.

If private settings are no longer configured, use [Task 6's private setup](database-connection.md#private-configuration-and-connection-check). Do not share passwords, bearer tokens, or connection URLs.

## Manual API request

Start `go run ./cmd/api` with the private database settings. In another PowerShell terminal, read a current development access token privately:

```powershell
$task9Token = Read-Host 'Current development access token' -AsSecureString
$task9Headers = @{
  Authorization = 'Bearer ' + [System.Net.NetworkCredential]::new('', $task9Token).Password
}
Invoke-RestMethod -Uri http://127.0.0.1:8080/floor-templates -Headers $task9Headers
```

Alpha should receive its template; Beta should receive an empty `templates` array. A regular nurse receives 403. Adding `?owner_profile_id=another-profile` cannot select another owner's records. Clear the token/header variables after use and stop the API.

## References

- [GORM queries, collections, and ordering](https://gorm.io/docs/query.html)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Go JSON encoding](https://pkg.go.dev/encoding/json)

The Supabase changelog was checked on 2026-10-17. The current TLS cipher deprecation concerns HTTP APIs and does not affect direct Postgres or pooler connections; this task makes no TLS configuration changes.

## Local credential storage follow-up

The user reported a successful development `nurseflow_go` password reset after failed reader/admin login attempts. The password was not shared in chat. `backend/scripts/development.ps1 Save` now verifies a privately entered reader password with `dbcheck` before storing it using Windows DPAPI outside Git. The helper can then run `TestTemplates` under the same Windows account without printing the secret. Synthetic DPAPI, output-confidentiality, failed-save protection, and environment-restoration checks passed. The user completed the real credential save, and the agent then ran the live isolation test successfully through the helper. The credential was not displayed or committed. See the backend README for usage. No administrator password is stored. The temporary local Postgres cluster used earlier was stopped and removed.

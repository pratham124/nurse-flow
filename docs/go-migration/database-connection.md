# Development Go database connection

Task 6 is complete. The development role migration is applied, private credentials were provisioned by the user, and the user-run Go connection and live ownership checks passed.

## Design and Go concepts

GORM maps existing Postgres rows to Go structs. `Profile` maps the separate Auth user UUID and application profile UUID; `FloorTemplate.OwnerProfileID` refers to the latter. Explicit table/column mappings preserve the current schema, timestamps, and JSONB snapshot. No AutoMigrate or new product data tables are introduced.

`Store` owns a GORM handle and its underlying `database/sql` pool. It opens at most five connections, retains two idle connections, and closes them through `Close`. `OpenDevelopment` constructs a development-only connection and checks connectivity and the effective role. Failures return controlled messages; GORM's SQL logger is disabled so it does not print credentials or row data. The diagnostic command closes its pool before exiting. The health server stays independent; a later workflow will own and inject the store into the API.

`WithIdentity` takes an Auth UUID and a callback. It starts a read-only transaction, supplies the UUID using parameterized `set_config`, and calls the callback with the transaction's GORM handle. `true` makes the setting transaction-local, so commit or rollback clears it before the connection is reused. Use only a server-verified Auth subject when this is connected to an HTTP request; the current fixture tests supply known synthetic UUIDs directly. The database trusts this setting and does not verify access tokens itself.

A `context.Context` carries cancellation and deadlines. Connection checks and read transactions have five-second limits; each transaction also sets a five-second Postgres statement timeout. The URI includes a five-second connection timeout. `defer` schedules cleanup when the surrounding function returns.

## Reviewed development migration

The versioned role migration was created with Supabase CLI 2.120.0. It is an addition to the already-restored baseline, not a complete fresh-project bootstrap. Do not run a blind migration push or reapply the historical restore.

The migration creates `nurseflow_go` without login, role inheritance, RLS bypass, administrative capabilities, or write privileges. It grants schema usage and SELECT on profiles and floor templates, with separate ownership SELECT policies. Existing client policies and their grants remain in place. Missing identity sees no rows; regular nurses can read their own profile but cannot read templates.

Read-only dashboard preflight on 2026-10-07 confirmed both tables have RLS enabled, the Go role does not exist, and 21 public policies exist. Five functions still grant EXECUTE to PUBLIC: invite validation/acceptance, swap resolution, issue submission, and swap submission. A second catalog query verified explicit EXECUTE grants to postgres, anon, authenticated, and service_role on each of the five functions. The proposed migration removes only those five blanket grants; explicit existing role grants remain. The migration rejects unexpected inherited table/function/schema privileges and rolls back on failure. It deliberately fails if the role already exists.

The reviewed migration `20261008060018_go_template_read_role.sql` was applied manually through the development SQL editor on 2026-10-08, in one successful transaction. On 2026-10-10, its missing CLI history entry was reconciled after read-only catalog verification. Do not reapply this file.

### Migration history reconciliation (2026-10-10)

The pinned CLI was authenticated by the user. This checkout has no saved project link, so every remote command used the explicit development project reference. The initial list showed local version `20261008060018` with no remote entry. The reusable read-only query in `verify-database-role.sql` confirmed the expected role flags (login enabled separately), SELECT grants, RLS on both tables, both exact ownership predicates, zero unrelated reads/writes or public function access, and preserved named client function grants.

Commands run from the repository root:

```powershell
npx --yes supabase@2.120.0 migration list --project-ref nmitctyxtjmlakcsmnuj
npx --yes supabase@2.120.0 db query --linked --project-ref nmitctyxtjmlakcsmnuj --file docs/go-migration/verify-database-role.sql
npx --yes supabase@2.120.0 migration repair 20261008060018 --status applied --project-ref nmitctyxtjmlakcsmnuj
npx --yes supabase@2.120.0 migration list --project-ref nmitctyxtjmlakcsmnuj
```

The final list reported `20261008060018` in both local and remote columns. Repair recorded the existing migration; it did not execute the role/policy SQL again. The baseline restore remains separately documented under `supabase/baseline`; this migration directory alone is not a fresh-project bootstrap. Future changes use new migration files and an explicitly verified project target.

Live catalog verification confirmed two Go policies, zero executable public functions, zero unexpected table grants, no superuser/RLS bypass, and login disabled. Explicit anon/authenticated/service_role grants on the five existing workflow functions remain present. The SQL editor's admin role cannot `SET ROLE nurseflow_go`; live ownership checks must use the dedicated Go connection after private credential provisioning. No ownership-test success is claimed from that blocked attempt.

The user privately set the role password and enabled login, then verified the dedicated Go connection. The password is not in chat or committed SQL. No production configuration or credentials are used.

## Private configuration and connection check

The development project's Connect dialog verified session pooler host `aws-0-us-east-1.pooler.supabase.com` on 2026-10-07. The Go code uses port 5432, database `postgres`, and `nurseflow_go.nmitctyxtjmlakcsmnuj` for the pooler username. It also supports the development direct host with username `nurseflow_go`. The production direct host, arbitrary hosts, and supplied port overrides are rejected.

Set these variables only in the terminal that runs the backend:

```powershell
$env:NURSEFLOW_DB_HOST = 'aws-0-us-east-1.pooler.supabase.com'
$task6Password = Read-Host 'Go database role password' -AsSecureString
$env:NURSEFLOW_DB_PASSWORD = [System.Net.NetworkCredential]::new('', $task6Password).Password
Set-Location backend
go run ./cmd/dbcheck
```

The connection requires TLS with hostname/certificate verification (`sslmode=verify-full`). If the project requires its downloadable database CA, set `NURSEFLOW_DB_SSLROOTCERT` to that certificate's local path. Do not disable certificate verification to work around a connection problem. The code does not load Expo's environment file, and passwords are URI-encoded safely. After use, clear the process variable with `Remove-Item Env:NURSEFLOW_DB_PASSWORD`.

Expected output after provisioning: `Connected to development Postgres as nurseflow_go`. If it fails, inspect private settings and availability; the public diagnostic does not print the raw driver error.

## Checks and current evidence

Ordinary checks from `backend`:

```powershell
go test ./...
go vet ./...
```

Local verification: the migration applied successfully in a separate UTF-8 PostgreSQL 17 cluster, and Go tests/static checks passed with integration tests enabled. Tests checked anonymous/unknown/regular-nurse access, charge-owner isolation, reusable connection identity cleanup, denied writes/unrelated reads, and preserved existing client function permissions. The first local cluster's default SQL_ASCII encoding was corrected after the driver rejected simple-protocol queries; the final cluster was initialized with UTF-8. Local servers were stopped after verification.

Live development verification: the user ran `go run ./cmd/dbcheck` with the downloaded Supabase CA file and received `Connected to development Postgres as nurseflow_go`. The user then ran `go test ./internal/database -run TestDatabaseOwnershipIntegration -v -count=1`; the parent test and Alpha, Beta, Regular, and Unknown subtests passed (package time 6.189s). Evidence is the output shared in this session; the agent did not receive the private password or rerun these live checks in its separate command session. Windows psql rejected `sslrootcert=system` with `SSL error: unregistered scheme`; using the downloaded root certificate file resolved the user's provisioning connection.

Database tests are opt-in. Set `NURSEFLOW_DATABASE_TESTS=1` and the three fixture Auth UUID variables (`NURSEFLOW_TEST_ALPHA_ID`, `NURSEFLOW_TEST_BETA_ID`, `NURSEFLOW_TEST_REGULAR_ID`), then run:

```powershell
go test ./internal/database -run TestDatabaseOwnershipIntegration -v -count=1
```

The read-only development preflight verified these synthetic Auth UUIDs:

```powershell
$env:NURSEFLOW_DATABASE_TESTS = '1'
$env:NURSEFLOW_TEST_ALPHA_ID = '4ea34fc9-d17b-411e-83a0-8a82cf9b8977'
$env:NURSEFLOW_TEST_BETA_ID = '5e7093ff-d8ea-4734-ae77-73a3906f936e'
$env:NURSEFLOW_TEST_REGULAR_ID = '712ae250-d0c6-4af4-b19e-ee7844d0c295'
```

With no local override, the test uses the private development settings. It performs reads plus denied no-row writes to verify privileges; it does not create or alter development records. It expects the documented fixtures: one Alpha template and zero Beta templates. It also verifies the regular nurse/unknown user, commit/rollback identity cleanup on a reused connection, snapshot/timestamp mapping, denied writes, unrelated-table denial, and preserved client function access.

For isolated local testing only, `NURSEFLOW_TEST_DATABASE_URL` can point to `127.0.0.1`; the application configuration never accepts that override. The local fixture creates synthetic tables/users and stand-in functions before the role migration. Initialize local Postgres with UTF-8 encoding for compatibility with the driver's simple protocol. Never apply the local fixture SQL to Supabase.

## References

- [GORM database connections and pools](https://gorm.io/docs/connecting_to_the_database.html)
- [GORM model mappings](https://gorm.io/docs/models.html)
- [Supabase Postgres roles](https://supabase.com/docs/guides/database/postgres/roles)
- [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Postgres transaction-local settings](https://www.postgresql.org/docs/17/functions-admin.html)

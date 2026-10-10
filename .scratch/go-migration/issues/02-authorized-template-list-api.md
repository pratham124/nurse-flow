# 02: Read the charge nurse's templates through Go

**What to build:** A signed-in charge nurse can request their own floor templates through the local Go API backed by the isolated development database. The response preserves the existing template-list behavior, and unauthorized users cannot read templates. This covers ordered migration tasks 6–9.

**Blocked by:** 01: Run the local Go health endpoint.

**Status:** in-progress

- [x] Go connects to development Postgres through GORM with explicit existing-table mappings, connection lifecycle management, and timeouts; no automatic schema migration runs.
- [x] A dedicated database role has reviewed permissions and verified RLS behavior. Existing client RLS protection is preserved, and database credentials remain server-side.
- [x] Token verification uses a maintained library and the development project's inspected signing configuration; it validates signature, issuer, audience as appropriate, and expiry. Decoding alone never authorizes a request.
- [ ] The application profile is resolved from the verified Auth subject, and only the charge-nurse role is authorized. Missing-profile and forbidden-role behavior is tested.
- [ ] The agreed template-list route and response preserve owner-profile filtering, descending update-time ordering without a new tie-break rule, and existing snapshot mapping semantics, including row ID/name and validation of doctor-side, room, and bed arrays.
- [ ] An owner with no templates receives a successful empty collection.
- [ ] Two charge-nurse fixtures cannot read each other's templates against development Postgres; a client-supplied identity cannot override verified ownership.
- [ ] Missing, invalid, expired, or otherwise unverifiable credentials are rejected, and database/API failures return consistent controlled errors without internal details or secrets.
- [ ] Expo sign-in and token refresh retain their existing behavior.
- [ ] Relevant automated checks and documented manual API requests pass, with implementation and results explained.
- [ ] Ordered tasks 6, 7, 8, and 9 are marked complete individually after their own implementation and relevant checks pass.

## Implementation guidance

### Task 7 complete — 2026-10-10

The user selected ES256-only verification after the active development key was inspected. JWT v5.3.1 verification, library-managed public-key discovery/cache through `jwkset` v0.11.3, bearer middleware, context identity, controlled JSON errors, and the `/auth/check` diagnostic are implemented. Go tests/vet/race checks, live public discovery, and HTTP health/missing/invalid-token requests passed. A real Charge Alpha Supabase token returned 200 with the matching Auth user ID; an altered signature returned 401. Tasks 8–9 have not started; this combined ticket remains in progress.

### Task 6 progress — 2026-10-07

On 2026-10-10, read-only catalog checks verified the installed role/policies/grants, and CLI migration repair registered the already-applied version `20261008060018`. The final list matches locally and remotely; the migration SQL was not rerun. The task 6 code walkthrough was completed with the user.

Task 6 is complete. Connection code, existing-table mappings, role/policy migration, and Go/local Postgres checks are implemented and verified. The reviewed migration was applied to development on 2026-10-08; live catalog checks confirmed limited grants and preserved existing client function access. The user privately provisioned credentials and enabled login, then shared successful dedicated Go connection and live ownership integration-test output. SQL-editor role impersonation was denied; the live tests passed through the dedicated connection instead. Tasks 7–9 have not started, so this combined ticket remains in progress.

Implement ordered tasks 6, 7, 8, and 9 one at a time, in that order; this ticket groups their demoable outcome and does not authorize implementing all four in one turn. Before each task, explain its design and use grill-with-docs to settle only unresolved decisions. Load the relevant Supabase/PostgreSQL skills before database work. Preserve the existing schema and JSONB snapshot representation. No mandatory understanding quiz is required.

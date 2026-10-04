# 02: Read the charge nurse's templates through Go

**What to build:** A signed-in charge nurse can request their own floor templates through the local Go API backed by the isolated development database. The response preserves the existing template-list behavior, and unauthorized users cannot read templates. This covers ordered migration tasks 6–9.

**Blocked by:** 01: Run the local Go health endpoint.

**Status:** ready-for-agent

- [ ] Go connects to development Postgres through GORM with explicit existing-table mappings, connection lifecycle management, and timeouts; no automatic schema migration runs.
- [ ] A dedicated database role has reviewed permissions and verified RLS behavior. Existing client RLS protection is preserved, and database credentials remain server-side.
- [ ] Token verification uses a maintained library and the development project's inspected signing configuration; it validates signature, issuer, audience as appropriate, and expiry. Decoding alone never authorizes a request.
- [ ] The application profile is resolved from the verified Auth subject, and only the charge-nurse role is authorized. Missing-profile and forbidden-role behavior is tested.
- [ ] The agreed template-list route and response preserve owner-profile filtering, descending update-time ordering without a new tie-break rule, and existing snapshot mapping semantics, including row ID/name and validation of doctor-side, room, and bed arrays.
- [ ] An owner with no templates receives a successful empty collection.
- [ ] Two charge-nurse fixtures cannot read each other's templates against development Postgres; a client-supplied identity cannot override verified ownership.
- [ ] Missing, invalid, expired, or otherwise unverifiable credentials are rejected, and database/API failures return consistent controlled errors without internal details or secrets.
- [ ] Expo sign-in and token refresh retain their existing behavior.
- [ ] Relevant automated checks and documented manual API requests pass, with implementation and results explained.
- [ ] Ordered tasks 6, 7, 8, and 9 are marked complete individually after their own implementation and relevant checks pass.

## Implementation guidance

Implement ordered tasks 6, 7, 8, and 9 one at a time, in that order; this ticket groups their demoable outcome and does not authorize implementing all four in one turn. Before each task, explain its design and use grill-with-docs to settle only unresolved decisions. Load the relevant Supabase/PostgreSQL skills before database work. Preserve the existing schema and JSONB snapshot representation. No mandatory understanding quiz is required.

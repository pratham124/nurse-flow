# Account deletion (ticket 25)

Milestone 8, decision 6. The user approved ticket 25 on 2026-11-07 and settled the
open details in a grilling session. The architecture decision is
[ADR 0009](../adr/0009-account-deletion-through-a-narrow-database-function.md).

## Facts found first (read-only, 2026-11-07)

- Development and production have the same foreign keys. Deleting an `auth.users`
  row cascades to `profiles` (and to Auth sessions and identities). Deleting a
  profile cascades to templates, active and previous shifts, invites they created,
  device tokens, and notification events. It sets `shift_nurse_access.nurse_profile_id`
  and `shift_nurse_invites.used_by_profile_id` to NULL. Three references were
  `ON DELETE RESTRICT` and blocked every deletion: `nurse_request_messages.author_profile_id`,
  `manual_assignment_overrides.created_by_profile_id`, and
  `optimizer_runs.requested_by_profile_id`.
- `postgres` may delete from `auth.users` (owned by `supabase_auth_admin`).
- No trigger fires on DELETE. The broadcast triggers fire only on UPDATE or INSERT.
- Every production profile has the `charge_nurse` role. A "regular nurse" is a
  profile joined to another charge's shift (glossary: joined nurse).

## Decisions

| # | Area | Decision |
| --- | --- | --- |
| 1 | Endpoint | `DELETE /profile` returns 204 with no body. It requires only a verified token, not a profile, so a person whose profile was never created can still delete their login. A second call returns 404 `account_not_found`. |
| 2 | Function | `go_private.delete_current_account()`: `SECURITY DEFINER`, owned by `postgres`, no arguments, using the `nurseflow.auth_user_id` transaction identity. Only `nurseflow_go` can execute it. It returns whether a user was deleted. |
| 3 | Live notice | Before deleting, it ends the caller's open shifts with an UPDATE, so joined nurses get the existing "active shift changed" broadcast and see "Shift ended". It also marks the caller's own nurse access on other charges' shifts as `removed` (added during implementation), so that slot shows as Removed and can be invited again. |
| 4 | App | A "Delete account" link in the Home footer opens `/delete-account`. That screen has a static warning, a field where the button stays disabled until the text is exactly `DELETE`, a local sign-out on success, and an inline error on failure. |
| 5 | Order | Expand before deploy. The migration is additive, so it goes to development, then the user applies it to production, then the PR merges and deploys Go. |
| 6 | Verification | Go handler tests. A live development check with fresh synthetic accounts: delete a joined nurse, then a charge, with a second charge whose data must survive. It also checks that an old token gets 403, the same email can sign up again, and the joined nurse is told live. Production is checked with a throwaway account only. |
| 7 | Records | ADR 0009, the glossary term **Account deletion**, and the policy pages' effective date (2026-11-07, the date this shipped). |

## Development (2026-11-07)

- Applied `20261107212029_account_deletion` to `nmitctyxtjmlakcsmnuj`. The rollback
  (`supabase/rollback/20261107212029_restore_before_account_deletion.sql`) and the
  re-apply both succeeded. `migration repair` recorded the version.
- Rolled-back probe: running the function as a synthetic charge with 1 template,
  1 shift, 1 run, 1 message, and 3 Auth sessions removed all of them, plus the
  profile and the Auth user. The other 20 profiles and 8 templates were untouched.
  A second call returned false. The transaction was rolled back, and the account
  still exists.
- Live check, 2026-11-07. This branch's Go API ran locally against development
  (`backend/scripts/development.ps1 Api`, with the hosted development solver).
  Expo used the development settings pointed at it. The charge, T23 Charge
  (synthetic), was on Expo web in Playwright. The joined nurse was a fresh account,
  T25 Nurse, on the Pixel 7 Pro API 33 emulator. Read-only SQL captured the state
  before and after each step.
  - Setup: the charge started a shift from "T23 Floor" with carry-over, ran
    assignment (Ana → 301, Raj → 302), and invited Raj. The nurse joined (Room 302
    only, Live), sent an issue and a thread message, and the charge replied.
  - Screen: "Delete account" appears in the Home footer. The warning lists the
    agreed items. The button stays disabled for an empty field and for lowercase
    `delete`, and is enabled for `DELETE`.
  - Deleting the joined nurse (Android): the app went to the login screen. The
    nurse's Auth user, profile, and message were removed, and the charge's reply
    stayed. The access row stayed, unlinked and `removed`, and the charge could
    generate a new code for that slot. The charge's data and every other account
    were unchanged. The old token got `profile_missing` (404 on `GET /profile`,
    which is that route's existing behaviour, and 403 on other routes). A second
    `DELETE /profile` returned 404 `account_not_found`.
  - Signing up again with the same email worked, and the new account joined
    through the new code.
  - Deleting the charge (web) while the nurse was joined: the nurse's screen
    showed "Shift ended" about 2 s later, live. The charge's browser went to
    `/login`, its stored Supabase session was cleared, and a reload stayed on
    `/login`. The charge's Auth user, profile, template, both shifts, runs,
    invites, and messages were removed, along with the joined nurse's access row on
    that shift. The nurse's own account survived. The old charge token got 403
    `profile_missing`. Other accounts were unchanged, except one earlier message
    by another account in a thread on the deleted charge's ended shift, which went
    with that shift (decision 6).
  - The browser logged two expected 403s after deletion: Supabase's
    `logout?scope=local` (the server session was already deleted) and one
    workspace refetch triggered by the shift-ended broadcast.
- Local checks: Go vet, race tests (all packages), and gofmt; TypeScript and lint;
  every `tsx --test` script, including the new `test:go-profile` (8 tests).

## Production (2026-11-07)

- The user applied `20261107212029_account_deletion` to `mkljczezkyqtuplzedpj`
  with `.scratch/apply-production-ticket25.ps1`, before the merge.
  `verify-account-deletion.sql` changed from 3 `RESTRICT` keys to 0; the three
  keys are now `c`, the function exists, and only `nurseflow_go` can execute it.
  The profile count stayed at 10, and `migration list` shows 9 of 9 local = remote.
- [PR #11](https://github.com/pratham124/nurse-flow/pull/11) was merged as `ab3ac5f`.
  The development deploy, the dev-database check, and "Publish policy pages"
  passed, and the user approved the production API deploy. Revision
  `nurseflow-api-prod-00005-mah` serves 100% of traffic, `/health` is ok, and
  `DELETE /profile` without a token returns 401. The live privacy policy shows
  "Effective date: November 7, 2026".
- Throwaway account check: a random `nurseflow.t25.throwaway.*@example.com` account
  (its password was never shown or stored) signed up, created its profile, a
  template, and an active shift through the production API.
  - `DELETE /profile` returned 204.
  - Its Auth user, profile, session, template, and shift were removed.
  - Totals went from 11 to 10 Auth users and profiles, 30 to 29 shifts, and 9 to
    8 templates.
  - The old token got 403 `profile_missing`, and a second delete returned 404
    `account_not_found`.
  - All smoke accounts were unchanged.
- The in-app screen was exercised on development (web and Android), not in
  production. The first iPhone build (ticket 27) covers it there.

Ticket 25 is done.

### Known limits

- A person whose profile was never created sees the session-recovery screen,
  which has no delete link. The API supports that case, so it is a possible
  follow-up. Until then, the privacy policy's email route covers it.
- The live test data had no manual moves, so the override cascade was not exercised
  with real rows. The foreign key change behind it is checked by
  `supabase/baseline/verify-account-deletion.sql`.
- The delete screen signs out locally without first disabling the device push
  token. The token row is removed by the profile cascade, and notifications are
  off.

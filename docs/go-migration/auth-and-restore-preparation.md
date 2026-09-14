# Auth settings and schema restore preparation

Read-only review of production project `mkljczezkyqtuplzedpj` on 2026-09-12 and development project `nmitctyxtjmlakcsmnuj` on 2026-09-13 (America/Vancouver). No settings changed.

## Observed Auth settings

| Setting | Current value |
| --- | --- |
| Email provider | Enabled |
| New user signups | Enabled |
| Confirm email before first login | Disabled |
| Anonymous sign-in | Disabled |
| Manual identity linking | Disabled |
| Other listed built-in providers | Disabled |
| Custom OAuth providers | None listed |
| Site URL | `http://localhost:3000` |
| Redirect URL allowlist | Empty |
| Secure email change | Enabled |
| Secure password change | Disabled |
| Require current password for updates | Disabled |
| Leaked-password protection | Disabled |
| Email OTP expiration | 3600 seconds |
| Email OTP length | 8 digits |
| Access-token expiry | 3600 seconds |
| Refresh-token replay detection | Enabled |
| Refresh-token reuse interval | 10 seconds |
| Single-session enforcement | Disabled |
| Session time limit / inactivity timeout | Both 0 (never); controls unavailable on current plan |

Sources: the project's Auth URL Configuration, Sign In / Providers (including the Email panel), and Sessions pages. Minimum password length and password character requirements were not reliably exposed in the inspected fields; do not infer them from helper text. Signing-key algorithm/status, Auth hooks, SMTP/templates, MFA, third-party Auth, API exposure, and project Realtime settings still need verification before claiming full configuration parity.

The development project should use its own Auth users and keys. Keep existing sign-in behavior for the first migration milestone. Select development redirect URLs based on the actual Expo web/device flow before adding any; the current localhost site URL alone does not establish a mobile redirect configuration.

## Development comparison

The inspected development settings match production for email/password availability, signup availability, disabled anonymous and manual-linking behavior, the `http://localhost:3000` Site URL, empty redirect allowlist, session controls, 3600-second access-token expiry, refresh-token replay detection, and the 10-second reuse interval.

Email confirmation initially differed: it was enabled in development and disabled in production. On 2026-09-13, the human chose to disable it in development as well. This keeps the current signup/login behavior aligned and avoids relying on the built-in email provider while creating fixtures; Supabase currently limits that provider to two Auth emails per hour per project. The tradeoff is that development users can authenticate without proving control of the supplied email address. Keep development credentials and keys isolated, and never reuse these fixture accounts in production.

## Export preparation

Use the installed PostgreSQL 17 `pg_dump` against the verified session pooler. This produces dependency-ordered public-schema DDL and ACL statements. We retain grants but omit ownership statements so the restore can run under the reviewed destination owner. No role passwords or application records are requested.

Run from an interactive PowerShell terminal:

```powershell
& 'C:/Users/psito/Projects/Projects/first-app-go-migration/supabase/baseline/export-public-schema.ps1'
```

Enter the existing production **database password** at pg_dump's password prompt. Do not paste the password into chat, the script, a connection URL, or an Expo environment variable. This script does not reset the password or create credentials. If the existing password is unavailable, stop and decide how to obtain access before changing production credentials.

On success it creates `supabase/baseline/public-schema-<timestamp>.sql`. Failed output retains a `.partial` suffix and is not a restore candidate. The user successfully ran the export; `public-schema-20260912-215152.sql` is saved and statically reviewed in `supabase/baseline/dump-review.md`.

The session endpoint was read from Dashboard â†’ Connect â†’ Direct â†’ Session pooler:

- Host: `aws-1-us-east-1.pooler.supabase.com`
- Port: `5432`
- Database: `postgres`
- User: `postgres.mkljczezkyqtuplzedpj`

## Review before applying anything

1. Compare the dump with the captured 11 tables, 29 functions, 27 indexes, seven triggers, and public policies. Inspect identity sequence ownership, default privileges, and security-definer function ownership.
2. Review public-schema creation statements for a fresh Supabase project's existing `public` schema; do not blindly run the raw dump or add destructive cleanup.
3. Reconcile external dependencies: `auth.users`, `auth.uid()`, extension functions, and Realtime functions/tables. Supabase supplies managed schemas; a public-only dump does not include dependencies from other schemas.
4. Prepare a separate reviewed addition for the captured `realtime.messages` receive policy and membership of `active_shifts` and `nurse_request_messages` in `supabase_realtime`. Do not recreate Supabase's dated Realtime partitions.
5. Restore only into the separate development Supabase project, compare the resulting definitions/permissions, then exercise the unchanged app using synthetic accounts and records.

Status: dump exported, reviewed, restored, and structurally verified in development. Core Auth settings needed for the first migration milestone were compared, and development email confirmation was disabled to match production. Test users, synthetic records, development app configuration, and behavior validation remain pending.

## References

- [PostgreSQL pg_dump options and schema dependency limitations](https://www.postgresql.org/docs/17/app-pgdump.html)
- [Supabase backup and restore connections](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

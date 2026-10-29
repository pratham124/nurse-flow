# Milestone 1 verification

Completed 2026-10-17 on `codex/go-migration`, using only development project
`nurseflow-go-dev` (`nmitctyxtjmlakcsmnuj`). Ordered tasks 10 and 11 are complete.

## Manual Expo walkthrough

| Check | Observed result |
| --- | --- |
| Populated web list | Charge Alpha displayed Migration Test Floor, two rooms and three beds, through Axios and Zod. |
| Empty web list | Fresh Charge Empty signup displayed Floor Templates 0 and No templates created yet through Go. |
| Native empty list | Existing Android debug app loaded current Metro code; fresh Charge Native Empty signup displayed the same empty state. |
| Unavailable API | Stopped Go, reloaded web and Android; both displayed Workspace could not load with the controlled template-service connection message. |
| Recovery | Restarted Go and pressed Retry; both restored their empty lists. No Supabase template-read fallback was used. |
| Retained navigation | Web opened the existing Floor details screen and returned to the unchanged empty list; no template was saved. Signup/sign-out also worked. |

The user chose fresh synthetic accounts instead of recovering Beta:
- `charge.empty.20261017.1792286047082@example.com` — Charge Empty, web.
- `charge.native.empty.157b102df1@example.com` — Charge Native Empty, Android.

Both used the existing signup/profile path and default charge-nurse role.
Generated passwords were transient and are not recorded. Beta was unchanged.
These accounts replace only Beta's manual empty-state login; original Alpha/Beta
fixtures still support live database isolation checks.

## Authentication, authorization, and failures

| Check | Evidence and boundary |
| --- | --- |
| Missing/malformed tokens | Direct requests to the running Go API returned controlled 401 unauthenticated responses. |
| Expiry/signature/claim validation | Go verifier/handler tests exercise synthetic signed ES256 tokens, expired credentials, wrong claims/signatures, and unsupported algorithms. |
| Forbidden/missing profiles | HTTP tests use controlled profile readers and verify expected 403 errors before the template query. |
| Live owner/role isolation | Development Postgres: Alpha's own template, Beta's non-nil empty list, cross-owner reads in both directions, regular-nurse and unknown-user denial. |
| Transaction safety | Database checks cover pooled-identity cleanup, invalid identities, and cancelled-query failure behavior. |
| Database unavailable | Deterministic HTTP tests inject profile/template reader failures and verify controlled 503 responses without internal details or partial results. Supabase was not stopped. |
| Identity spoofing | Handler tests reject client identity overrides; client tests reject returned rows owned by another profile. |
| Public signing keys | Live development JWKS discovery passed. |
| Browser access | CORS preflight/origin/error tests passed; actual allowed-origin browser requests passed. |

All rows passed. A real regular-nurse Expo login and a real expired Supabase
session are not claimed: those branches use automated verifier/HTTP tests plus
the live role-isolation checks described above. No signing keys, policies,
grants, schema, production records, or existing passwords changed.

## Automated checks

From `backend`:
- `./scripts/development.ps1 TestTemplates` — live isolation passed with the saved Windows DPAPI credential.
- `go test -race ./... -count=1` — all packages passed.
- `go vet ./...` — passed.
- Live public signing-key test with `NURSEFLOW_AUTH_LIVE_CHECK=1` — passed; process setting restored.

From the repository root:
- `npm run test:go-templates` — 18 passed.
- `npm run test:server-workspace-store` — 9 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- Expo web and Android Metro bundles — completed and rendered.

Workspace-store checks cover atomic source updates, selectors, save success/failure,
and sign-out cleanup. This walkthrough did not exercise every retained shift/write
workflow or the optimizer; those remain outside this template-read migration.

## Reachability and cleanup

Web used localhost:8081 and Go at 127.0.0.1:8080. Native used the existing
`Pixel_5_API_34` emulator (Android 14/API 34), read-only without saving a snapshot,
and existing debug app `com.pfrog123.firstapp`. Scoped ADB reverse ports 8080/8081
connected emulator loopback to Go/Metro. No NurseFlow APK, system image,
firewall rule, or LAN binding changed. The automation snapshot helper was updated
only inside the disposable emulator.

No physical phone was connected. Emulator success verifies the native app and
HTTP path, not physical-phone LAN access. Explicit LAN setup remains in
[Expo template reads](expo-template-read.md#physical-devices). iOS was not tested.

Temporary Go/Metro servers, verification tab, reverse mappings, emulator, and
automation daemon were stopped. Emulator processes and an empty ADB device list
were checked. Screenshots of the web empty state and native outage/recovery
were saved locally. A Windows CLI shutdown assertion followed one successful
Metro reload; app reload and subsequent verification passed.

No application refactor was needed. Only verification notes and development
fixtures changed. Before implementing a template write, hold the next bounded
design round described in [the migration plan](plan.md).

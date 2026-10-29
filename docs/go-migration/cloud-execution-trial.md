# Codex Cloud execution trial

Verified on 2026-10-18. This was an environment experiment, not a new Go migration milestone.

## Completed setup

- [x] Pushed `codex/go-migration` through `a3723268dd6cadbc354e8d3db3a5b88b041b1bff` to the existing GitHub remote.
- [x] Created and published the private `nurse-flow` Codex Cloud environment. Access is Only me. It uses the migration branch and the pinned commit; refresh/review the pin when preparing future work.
- [x] Prepared Go 1.27.1 (archive checksum verified), Go modules, and Node dependencies from the lockfile. Go race tests, vet, build, 27 template/client checks, nine workspace-store checks, TypeScript, and Expo lint passed during setup. Opt-in live checks were skipped. Expo telemetry was disabled to avoid writes to an unavailable home directory.
- [x] Retained restricted package-manager networking and added only `aws-0-us-east-1.pooler.supabase.com`. Published the configuration before starting a fresh probe task.
- [x] Confirmed that the fresh cloud task uses a clean checkout at the intended commit.

The reusable install script and start instructions belong to the cloud environment. They do not modify repository product code. Neither the local Windows DPAPI credential nor any database password was read, uploaded, or saved to the cloud environment. No database schema, fixture, or account was changed. No milestone 3 implementation was started.

## Observed database result

The onboarding probe failed DNS resolution with `EAI_AGAIN` / `Temporary failure in name resolution`, before connecting to PostgreSQL.

After publication, a fresh cloud task ran:

```sh
getent ahosts aws-0-us-east-1.pooler.supabase.com
```

It exited 2 without addresses or diagnostic output. The task stopped at DNS failure. Direct TCP port 5432 reachability and database authentication therefore remain unverified. This does not prove that Supabase is down or that port 5432 itself rejected a connection. The runtime policy included the exact hostname in its HTTP allowlist and listed no TCP grants; the precise DNS failure cause was not established.

- [ ] Verify a supported direct PostgreSQL connection from cloud and then run the read-only `TestTemplateListIsolationIntegration` with privately configured limited-role settings. Do not claim a live database pass from the ordinary Go tests.

Cloud code work and ordinary checks are usable. Live Supabase verification still requires a suitable execution/network environment. A disposable PostgreSQL fixture database inside the cloud or a separate CI runner would be a different test path and needs its own setup and verification. No HTTPS SQL/admin API, tunnel, hard-coded destination IP, certificate bypass, or credential workaround was attempted.

## Recorded chats

- Setup: https://chatgpt.com/local/01a14da1-891c-773f-83b8-91a85e52d03b?hostId=local
- Fresh probe: https://chatgpt.com/local/01a14da6-5007-770b-b435-9c0372fad008

Reference: [Official Codex Cloud environment setup](https://learn.chatgpt.com/docs/environments/cloud-environments).

## Supported-permission retry

- [x] At the user's request, inspected the cloud runtime's networking references and available permission tools. The runtime retained the exact pooler in its enforced HTTP allowlist, with no configured VPN or TCP destination grants. No host-and-port-specific direct TCP grant control was exposed to the task.
- [x] Requested and received the platform's normal general sandbox network permission for one turn, solely for the pooler probe. Saved environment settings and the enforced destination policy were unchanged.
- [x] Retried with Python's `socket.getaddrinfo(host, 5432, type=socket.SOCK_STREAM)`; it failed with `gaierror: [Errno -3] Temporary failure in name resolution`. The subsequent five-second TCP connection was not attempted because DNS failed.

The supported temporary grant did not fix DNS. Port 5432 reachability, TLS, and database authentication remain unverified; the precise DNS failure cause is still unknown. No credential was read or uploaded, and there were no product/schema/fixture changes or milestone 3 implementation. This retry does not establish that all cloud database access is impossible; it establishes that the tested direct path remains unavailable in this prepared environment.

## Working laptop-independent database verification

- [x] Configured GitHub Actions as the live database runner on 2026-10-18. The credential-free probe passed on a GitHub-hosted machine, then the existing read-only isolation test and all seven cases passed with verified TLS and the limited role: [run 39104411624](https://github.com/pratham124/nurse-flow/actions/runs/39104411624).

The password is an encrypted secret in the `nurseflow-go-development` GitHub environment, restricted to the exact migration branch. Codex Cloud does not receive that password. Backend changes pushed from cloud trigger CI independently of the laptop. Direct connections from the Codex Cloud runtime remain unverified/blocked as recorded above; the successful database run took place on GitHub's runner. See [CI setup](ci-database-checks.md).

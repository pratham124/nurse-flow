# Development database checks in GitHub Actions

The `Go development database` workflow runs on GitHub-hosted Ubuntu 24.04 when a push to `codex/go-migration` changes `backend/**` or the workflow itself. It does not depend on the laptop or the Codex Cloud runtime's outbound PostgreSQL support.

## What it runs

1. Resolve the development pooler and connect directly to TCP port 5432 without credentials.
2. Check out the triggering commit and install the Go version in `backend/go.mod`.
3. Materialize the trusted public CA certificate and keep the application's existing `verify-full` TLS checks.
4. Run only `TestTemplateListIsolationIntegration` with the existing Alpha/Beta/Regular fixtures and limited development role.

The integration test is read-only. It verifies the populated/empty lists, both directions of cross-owner filtering, regular/unknown-user denial, and pooled identity cleanup. It does not apply migrations, mutate fixtures, or run write tests. A missing credential or certificate fails explicitly rather than silently skipping the live check.

The workflow token has only `contents: read`; checkout does not retain its Git credential. Third-party action versions are pinned to immutable commit SHAs. No pull-request trigger receives database credentials.

## GitHub configuration

Environment: `nurseflow-go-development`, restricted to the exact branch `codex/go-migration` (branch, not tag).

| Configuration | Kind | Purpose |
| --- | --- | --- |
| `NURSEFLOW_DB_PASSWORD` | Environment secret | Existing limited `nurseflow_go` development password. Only the test step receives it. |
| `NURSEFLOW_DB_CA_CERT_PEM` | Environment variable | Public CA certificate, written to a temporary runner file. It contains no private key. |

The development host and synthetic fixture Auth IDs are fixed in the workflow. The application constructs its development-only connection and checks that it uses the limited non-bypass role. No administrator or service-role credential is used.

For a future password rotation, update the environment secret after verifying the new limited-role password. Do not put it in Git, chat, a command-line argument, or a log. The initial setup transferred the existing Windows DPAPI credential directly to `gh secret set` through private process stdin; no plaintext password file was created.

## Using it while the laptop is off

Work in Codex Cloud and push the migration branch. Relevant backend changes trigger the workflow automatically. Open the repository's Actions tab, select `Go development database`, and inspect `Read-only Supabase isolation`. Re-run an existing workflow from that run's menu when needed.

The workflow currently exists on the migration branch, so it uses push triggers rather than relying on a manual-dispatch workflow on `main`. Docs-only and frontend-only changes do not rerun this database check. Continue to run the relevant app/unit checks in the coding environment.

Existing cloud chats retain their own checkout; sync the migration branch before making new changes. The originally published cloud environment was prepared at `a372326`; it does not automatically incorporate later CI setup commits into an already-running chat.

## Verification

- [x] actionlint 1.7.12 passed for the workflow.
- [x] The initial credential-free GitHub runner probe passed: [run 39104180152](https://github.com/pratham124/nurse-flow/actions/runs/39104180152).
- [x] The complete workflow passed on 2026-10-18 for commit `e8ba85691b2868a514950d061cf887fb7185f9fc`: [run 39104411624](https://github.com/pratham124/nurse-flow/actions/runs/39104411624). Connectivity passed, and `TestTemplateListIsolationIntegration` plus all seven subtests passed without skips. The test executed on GitHub-hosted Ubuntu with verified TLS and the existing limited development role. Existing fixtures were unchanged.

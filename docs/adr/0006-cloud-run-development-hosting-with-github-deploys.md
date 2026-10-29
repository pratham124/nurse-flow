# Host development on Cloud Run, deployed by GitHub Actions through Workload Identity Federation

Accepted on 2026-10-25 for Go migration milestone 7 (ticket 20). The Go API and a
solver-only copy of the Python optimizer run as two Cloud Run services in a new,
development-only GCP project in `us-east4`, next to Supabase's `us-east-1`. Both
scale to zero with small instance caps. Secrets live in Secret Manager, readable
only by each service's own runtime account.

A push to `codex/go-migration` deploys through GitHub Actions. The workflow
proves its identity to Google with a short-lived GitHub OIDC token. Google accepts
it only for this repository ID, branch, and `gcp-development` environment, so no
Google key is stored in GitHub. The workflow tests, builds an image tagged with
the commit SHA, deploys a no-traffic candidate revision, smoke-checks it, and
only then moves traffic. Rollback moves traffic back to the previous revision.

We chose Cloud Run for the same reasons as the Phase 9 optimizer: immutable
revisions with traffic control, configurable concurrency and timeouts, and no
cluster to run. A separate GCP project keeps development deploys, IAM, and secrets
away from the production optimizer. It also lets the deployer hold project-level
Cloud Run admin without that reaching production.

We rejected a deploy script run from the laptop (simpler, but every deploy depends
on one machine's credentials and leaves no audit trail) and Terraform (change
previews and state, but a new tool for a single environment). The one-time
setup is a checked-in, re-runnable gcloud script instead. The Go API selects its
Supabase project from a required environment variable restricted to the two known
refs, so the same image can later be promoted to production by configuration.

The deploy trigger stays on the migration branch. Merging into `main`, which
still builds the legacy app, is part of the separately approved production cutover
(ticket 22).

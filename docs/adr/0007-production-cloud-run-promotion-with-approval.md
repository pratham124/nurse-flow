# Promote to a separate production Cloud Run project, with manual approval

Accepted on 2026-10-29 for Go migration milestone 7 (ticket 22). Production gets
the same two Cloud Run services as development (the Go API and a solver-only
Python service) in its own GCP project, `nurseflow-512906`. That project has its
own runtime accounts, secrets, deployer, and Workload Identity provider. The API
selects the production Supabase project through `NURSEFLOW_SUPABASE_PROJECT_REF`
and allows no browser origins, because the app is mobile-only.

One workflow per service runs on `main`: test, deploy to development, then deploy
to production. The production job runs only from `main`, only after development
succeeded, and waits for the user's approval through the `gcp-production` GitHub
environment. The deploy steps live in reusable workflows that each environment
calls with its own name, service, and settings file. Each environment builds its
own image from the same commit into its own registry.

We rejected putting production services in the development project, because
anyone who could deploy development could then reach production secrets. We also
rejected automatic production deploys on every `main` push, because the first
real users arrive with the store release and a human check is cheap now. Copying
the development workflow files was rejected too: the deploy steps would then exist
four times and could drift. Building one image and promoting it across projects
would need cross-project registry access. We may revisit that if build time or
reproducibility becomes a concern.

Production starts at zero minimum instances. The measured cold start was 4.1 s
end to end. Keeping one instance warm is decided at the store release. This
extends [ADR 0006](0006-cloud-run-development-hosting-with-github-deploys.md).

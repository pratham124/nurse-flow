# Phase 9 Python Service Boundary

Task: Phase 9 Task 0.3, Document the Python Service and Deployment Boundary

This document freezes where the production optimizer runs, how it is called,
which credentials it may use, and which runtime limits it must satisfy. It is a
deployment contract, not Python implementation.

## Decision Summary

NurseFlow will use:

- a separately deployable Python 3.13.14 service;
- the official `ortools==9.15.6755` Python package;
- FastAPI with one Uvicorn worker per container;
- a Linux container built from an official Python image rather than the
  deprecated FastAPI base image;
- Google Cloud Run in the region closest to the Supabase project;
- one authenticated `POST /v1/assignment-runs` endpoint for both the first
  assignment and every rerun;
- public HTTPS reachability at the Cloud Run layer, with every assignment
  request authenticated and authorized inside NurseFlow;
- Supabase as the source of truth and transaction owner.

The Expo app never imports Python, OR-Tools, model variables, solver settings,
or the finalization credential. It only starts an assignment action and then
reloads the committed Supabase workspace.

## Host Tradeoff Review

Cloud Run is a fit decision, not a requirement imposed by OR-Tools. The service
is kept as a standard OCI/Docker-compatible container so the host can be
changed without rewriting the optimizer.

The shortlist was evaluated against the needs that matter here: run the
official native OR-Tools wheel, permit a 75-second HTTPS request, isolate one
CPU-heavy request per instance, set exact CPU/memory limits, reduce cold-start
risk, deploy immutable revisions, and roll back without operating a cluster.

| Option | Strengths for NurseFlow | Costs or drawbacks | Decision |
| --- | --- | --- | --- |
| Google Cloud Run | Runs the exact container; configurable concurrency, CPU, memory, min/max instances, and request timeout; immutable revisions support traffic splitting and rollback; no cluster to manage. | Adds a GCP account, Artifact Registry, IAM, billing, and monitoring to the Expo/Supabase stack. Scaling to zero reduces idle cost but adds cold-start latency. | Chosen for the initial benchmark and deployment. |
| AWS App Runner | Also accepts a container image, provides managed HTTPS/autoscaling, and its 120-second HTTP limit fits the planned request. | Adds AWS/ECR/IAM operations, and this project has no existing AWS footprint that would offset that setup. Its deployment controls must be re-evaluated if weighted rollout is required. | Viable runner-up when an organization already standardizes on AWS. |
| Azure Container Apps | Accepts containers and supports min/max replicas, scale-to-zero, immutable revisions, and traffic splitting. | Adds an Azure Container Apps environment and KEDA/revision concepts that NurseFlow does not otherwise need. There is no existing Azure footprint in this project. | Viable runner-up when Azure is already the required platform. |
| Supabase Edge Function | Already beside NurseFlow's database and authentication, with fewer vendors. | Its JavaScript/TypeScript edge runtime is not the normal CPython environment required by the official OR-Tools Python wheel, and it does not provide the chosen solver container boundary. | Rejected for solver execution; Supabase still owns prepare and finalization. |
| Self-managed VM, ECS, or Kubernetes | Maximum control over runtime, networking, and long-running work. | Requires substantially more patching, scaling, health, rollout, and recovery operations than one stateless optimizer endpoint justifies. | Rejected at this phase as unnecessary operational scope. |

Why Cloud Run currently wins:

1. Its configurable concurrency of one directly matches a solve that consumes
   most of one instance's CPU and memory.
2. Its request timeout is configurable beyond NurseFlow's 75-second host
   limit, while the service retains its own earlier deadline.
3. Scaling to zero supports a cost-first initial deployment, and the benchmark
   makes its cold-start cost visible before clinical use.
4. Built-in revision traffic controls make a no-traffic smoke test, gradual
   rollout, and quick rollback straightforward.
5. It provides these controls without introducing a cluster or persistent
   server for the team to operate.

Known Cloud Run tradeoffs remain explicit:

- keeping one instance warm costs money even when no assignment runs;
- scaling to zero instead would make the first request slower;
- a public mobile-facing endpoint needs JWT validation, authorization, request
  size limits, maximum-instance cost protection, and later abuse monitoring;
- a 70-second synchronous request can be interrupted, so idempotency and
  source-of-truth reloads are mandatory;
- choosing a region far from Supabase would add prepare/finalize latency and
  network cost;
- Cloud Run deployment configuration is provider-specific even though the
  application container remains portable.

Cloud Run should be revisited before implementation if the hospital or company
requires AWS/Azure, if no Cloud Run region is suitably close to Supabase, or if
the measured solver cannot reliably fit the synchronous deadline. In that
case, changing the host is allowed; weakening the optimizer safety rules is
not.

## Why This Is a Separate Service

Expo runs JavaScript on the phone and cannot import a normal CPython package.
Supabase Edge Functions run a JavaScript/TypeScript edge runtime and are not the
place to bundle the native OR-Tools Python wheel. The solver also needs bounded
CPU, memory, request duration, and a reproducible container image.

The separate service gives the optimizer those runtime controls without making
the mobile bundle responsible for clinical assignment calculation or exposing
server authority to a phone.

## Repository Boundary

Implementation work may later add one focused top-level service directory, for
example `optimizer-service/`. It will own:

- the FastAPI HTTP adapter;
- Supabase token verification and prepare/finalize clients;
- normalization, CP-SAT modeling, staged solves, output projection, and
  independent validation;
- Python dependency locks, container definition, and service tests;
- the maximum-floor benchmark fixture and runner.

The React Native app will own only a typed repository function for the HTTPS
action and presentation state such as `calculating`, `stale`, `timed_out`, and
`failed`. No Python files or Python dependency commands belong in the Expo
runtime.

## Pinned Runtime

The first implementation must pin, rather than loosely range:

| Item | Frozen version or policy | Reason |
| --- | --- | --- |
| Python | `3.13.14` | A current maintenance release with an OR-Tools Linux wheel. |
| OR-Tools | `9.15.6755` | Current official package at the time of this review. |
| Container platform | Linux `amd64` | Matches an official OR-Tools wheel and the chosen Cloud Run target. |
| CP-SAT workers | `num_search_workers = 1` | Avoids concurrent solver searches changing equal-choice discovery order. |
| Random seed | One checked-in fixed value | Removes an uncontrolled input, while canonical staged solves remain the real determinism rule. |

FastAPI, Uvicorn, the JWT library, Supabase HTTP client, and all transitive
packages must also be exact in the eventual lock file. They are not added by
this documentation task.

Upgrading Python or OR-Tools is a deliberate optimizer-version change. It must
rerun the canonical fixtures and maximum-floor benchmark before deployment.

## HTTP Surface

### `POST /v1/assignment-runs`

This is the only optimizer action endpoint. Initial assignment and rerun do not
use separate solver routes.

Request headers:

- `Authorization: Bearer <Supabase access token>`;
- normal JSON content headers;
- no secret, service-role, or finalization key from the app.

Request body:

| Field | Rule |
| --- | --- |
| `shiftId` | Required active-shift ID. |
| `clientMutationId` | Required UUID created once for safe retry. |
| `expectedShiftRevision` | Required server revision or `updatedAt` precondition last reviewed by the app. |
| `expectedBaselineAssignmentResultId` | `null` for the first run; required for a rerun. |

The body must not contain `nextShift`, a shift snapshot, generated teams, room
coverage, bed assignments, flags, owner profile ID, solver values, or an
optimizer result.

Successful or safely handled responses contain only action state needed by the
app, such as:

- `saved`, with the run ID and new baseline ID for correlation;
- `stale`, so the app reloads and asks for a fresh review;
- `infeasible_input` or `timed_out`;
- `unavailable` or `failed`.

Even after `saved`, the response is not the new board. The app reloads Supabase
and renders the exact committed source of truth.

### Health endpoints

- `GET /healthz` proves that the HTTP process is responsive. It performs no
  Supabase call and no solve.
- `GET /readyz` proves that required configuration parsed, the pinned OR-Tools
  module imported, and the service can accept requests. It returns no version,
  secret, environment value, patient data, or dependency detail.

Cloud Run uses `/readyz` as the startup probe and `/healthz` as the liveness
probe. Health routes are safe to expose because they return only a generic
healthy/unhealthy status.

## Authentication and Authorization Flow

Authentication proves who sent the request. Authorization proves that this
person may optimize this shift. They are separate checks.

```text
Expo user session
  -> bearer access token
  -> Python verifies signature and required claims
  -> Python forwards that same bearer context to prepare
  -> Supabase RLS/RPC derives the profile and checks shift ownership
  -> Python receives the authorized current snapshot
```

### 1. Verify the Supabase access token

The service accepts only a bearer access token. For the preferred asymmetric
Supabase signing-key setup, a maintained Python JWT library verifies it against
the project's HTTPS JWKS endpoint.

Verification must:

- allowlist the configured asymmetric signing algorithm;
- select the public key by `kid` without accepting a token-supplied key URL;
- verify the signature;
- match the exact configured issuer;
- match the configured audience used for signed-in users;
- reject an expired or not-yet-valid token;
- require a valid `sub` user ID.

JWKS caching must respect Supabase key rotation guidance and support cache
refresh when an unknown `kid` appears. The private signing key and legacy JWT
secret are never copied into this service.

If the Supabase project still uses legacy shared-secret signing, the temporary
fallback is verification through the Supabase Auth `/user` endpoint using the
publishable key. NurseFlow must not copy the shared JWT secret into the
optimizer. Moving the project to asymmetric signing keys is the preferred
production setup.

### 2. Authorize through prepare

JWT validity alone does not grant shift access. Python calls the authenticated
Supabase prepare action with the caller's bearer context and the four request
fields.

Prepare derives the profile from the token and checks:

- the profile owns the active shift as its charge nurse;
- the shift is still active;
- the expected shift revision matches;
- the first-run/rerun baseline precondition is correct;
- the mutation ID is new or an identical idempotent retry.

Only then may prepare return the authoritative current snapshot and run
metadata. A joined nurse, unrelated charge nurse, or expired session is denied
before OR-Tools starts.

### 3. Do not retain the user token

The access token exists only in request memory long enough to verify it and
call prepare. It must not be placed in:

- the optimizer run record;
- application logs, traces, exception messages, or analytics;
- an assignment result or response body;
- a retry queue, file, cache entry, or database field.

The service also redacts `Authorization`, `apikey`, cookies, and request bodies
from default HTTP logging.

## Service-Only Finalization

After an `OPTIMAL` result passes independent validation, Python calls one
protected Supabase finalization transaction using a Supabase secret key. New
Supabase secret keys are preferred over the legacy `service_role` key.

The credential is:

- stored in the deployed service's secret manager/environment injection;
- available only to the service revision identity;
- absent from source control, local example values, build arguments, logs, and
  client responses;
- never prefixed `EXPO_PUBLIC_` and never included in the mobile bundle.

The finalization transaction is not granted to `anon` or `authenticated`. It
checks its service caller and revalidates the run, snapshot fingerprint,
revision, baseline precondition, IDs, and hard constraints inside the same
transaction that saves the baseline.

Therefore a modified app cannot invent an assignment and finalize it: the app
does not possess the credential, and normal user authorization cannot execute
the protected transaction.

The broad secret key is used only to enter this narrow transaction. The service
must not use it for ordinary user-authorized reads that belong in prepare.

## Idempotency and Concurrency

- One `clientMutationId` identifies one intended action.
- Retrying the identical request returns or waits for the same run outcome.
- Reusing the mutation ID with different action fields is rejected.
- A first run requires no current baseline.
- A rerun requires the exact baseline ID the charge nurse reviewed.
- Prepare captures the authoritative revision and input fingerprint.
- Finalization rechecks both. Any intervening optimizer-input or baseline
  change returns `stale` and saves nothing.
- Only one calculating run may own the same shift/revision/baseline tuple.
- The phone may retry only with the same mutation ID until the outcome is
  known. A newly reviewed attempt gets a new mutation ID.

## Runtime and Cloud Run Configuration

The first production-like benchmark uses this frozen envelope:

| Setting | Value |
| --- | --- |
| Region | Same region as Supabase when available; otherwise the closest supported region is recorded. |
| CPU | 1 vCPU |
| Memory | 2 GiB |
| Container processes | One Uvicorn worker |
| Cloud Run concurrency | 1 request per instance |
| Billing | Request-based |
| Minimum instances | 0 for the initial cost-first deployment |
| Maximum instances | 2 initially, with a billing budget and alert |
| Cloud Run request timeout | 75 seconds |
| NurseFlow internal request deadline | 70 seconds from receipt |
| Normalize plus all CP-SAT stages plus output validation | At most 50 seconds of the shared deadline |
| Auth/prepare/finalize/response reserve | At least 20 seconds total |
| CP-SAT search workers | 1 |

The internal deadline is earlier than the host timeout because Cloud Run can
close the connection while container code keeps running. NurseFlow must stop
starting later solve stages when the shared deadline cannot safely finish,
mark the run `timed_out`, and return before the host's 75-second cutoff.

All lexicographic and canonical stages share one deadline; each stage does not
receive a fresh 50 seconds. A `FEASIBLE` stage at the deadline is not saved.

One request per instance prevents two CPU-heavy solves from competing for the
same CPU or memory. One CP-SAT worker supports repeatability. With minimum
instances zero, Cloud Run may remove every idle container. The next request
then waits for the container, Python, FastAPI, and OR-Tools to start before the
normal solve begins. A warm request avoids that startup work. The production
decision may move to one warm instance only after the measured latency and
actual budget justify its recurring idle cost.

Maximum instances two limits both downstream pressure and unexpected cost
during the initial rollout. This is a launch guardrail, not a permanent scale
claim; expected concurrent hospital usage and Supabase capacity must be
reviewed before raising it.

## Maximum-Floor Benchmark Gate

Task 0.2 supports at most 200 rooms, 400 total and participating occupied beds,
40 nurses, and 10 generated teams. That limit is provisional until the real
solver passes this gate in the production container.

The checked-in synthetic maximum fixture must include:

- exactly two doctor sides and 200 rooms;
- 400 occupied beds with stable IDs and a mixture of one- and multi-bed rooms;
- 40 nurses producing 10 teams;
- RN and LPN eligibility pressure;
- experienced, mid, and new-grad RNs;
- green, yellow, and red acuity across both sides;
- hard nurse loads and side-guidance values that create meaningful choices;
- at least one feasible full assignment and a separate understaffed maximum
  variant.

Benchmark procedure:

1. Build the exact release image by immutable digest.
2. Deploy it with the configuration above and production-like Supabase RPC
   latency, using synthetic data only.
3. Run five cold-start attempts after confirming the service has scaled to zero
   or by using a new revision with no warm instance.
4. Run twenty warm attempts for each maximum fixture at concurrency one.
5. Record container digest, Python/OR-Tools/optimizer versions, result status,
   decision fingerprint, stage timings, end-to-end duration, and peak memory.
6. Compare decision fingerprints after excluding server-generated result IDs
   and timestamps.

Release gate:

- every attempt reaches `OPTIMAL` at every objective/canonical stage;
- every output passes independent validation;
- every repetition has the same decision fingerprint;
- every request finishes before the 70-second internal deadline;
- warm p95 end-to-end time is at most 60 seconds;
- peak resident memory is at most 1.5 GiB, leaving host headroom;
- no request reaches the Cloud Run cutoff, crashes, or is killed for memory.

Task 0.3 freezes this benchmark contract. The result cannot be measured until
the minimal solver from later Phase 9 tasks exists. Production connection is
blocked until a dated benchmark report passes. If it fails, NurseFlow must
either improve the model or lower the documented supported ceiling; it must not
silently commit a merely feasible result or increase resource/time limits
without review.

## Local Development

Local implementation will use Python 3.13.14 in an isolated virtual environment
and the same exact dependency lock as the container.

Required local behavior:

- run FastAPI on a non-public local port;
- use a local or dedicated non-production Supabase project;
- load credentials from ignored environment files or the developer's secret
  store, never committed files;
- use synthetic fixtures only;
- exercise the same JWT, prepare, solve, validate, and finalize path;
- allow an explicit test mode to replace Supabase HTTP calls with fakes without
  weakening the production route.

The Expo app receives only a public optimizer base URL through configuration.
It never receives a service credential.

## Deployment and Rollback

Deployment is revision-based:

1. Run unit, fixture, authorization, output-validation, and maximum-floor gates.
2. Build one Linux image from the pinned lock and record its immutable digest.
3. Deploy a new Cloud Run revision with no production traffic.
4. Check startup/liveness probes and synthetic authenticated smoke tests.
5. Send limited traffic to the revision, monitor safe outcome counts and
   latency, then move to full traffic.
6. Keep the previous compatible revision available during the observation
   window.

Rollback moves traffic back to the previous known-good revision. Database
changes that support the endpoint must be backward compatible with both
revisions; destructive cleanup waits until rollback is no longer needed. A
rollback never converts an in-progress or timed-out result into a committed
baseline.

## Observability and Data Minimization

Allowed operational fields include:

- server run ID or a non-sensitive correlation ID;
- optimizer and dependency versions;
- coarse outcome and HTTP status;
- total and per-stage durations;
- room/bed/nurse/team counts;
- memory and cold/warm-start measurements.

Do not log bearer tokens, API keys, request bodies, patient fields, diagnosis,
nurse names, bed assignments, full IDs from the clinical snapshot, solver model
dumps, or complete exception objects containing headers.

## Failure Contract

| Condition | Endpoint behavior | Persistence behavior |
| --- | --- | --- |
| Missing, invalid, or expired token | `401` | No run and no solve. |
| Valid user without shift authority | `403` | No released snapshot and no solve. |
| Stale revision/baseline or mutation conflict | Typed `409` outcome | No baseline or override change. |
| Invalid or unsupported normalized input | Typed `422` outcome | Run records the safe failure only. |
| Shared solve deadline reached | Typed timeout before host cutoff | No assignment result is saved. |
| Supabase or service temporarily unavailable | Retryable `503` with same mutation ID | Existing baseline and overrides remain. |
| Unexpected solver/service failure | Generic `500`; detailed server-only diagnostic | No partial result is saved. |

User-facing text stays calm and actionable. It never exposes a stack trace,
solver model, credential detail, or internal database name.

## Task 0.3 Verification State

Completed by this document:

- service/framework/host choice;
- one action endpoint and health surface;
- JWT verification and user-authorized prepare boundary;
- server-secret protected finalization boundary;
- exact Python and OR-Tools pins;
- local, resource, timeout, cold-start, deployment, and rollback policies;
- maximum-floor benchmark fixture, procedure, and pass thresholds.

Still required before production implementation is accepted:

- run the benchmark against the implemented optimizer and attach the dated
  results;
- prove through database authorization tests that `authenticated` cannot invoke
  protected finalization;
- perform the teaching checkpoint recorded in
  `docs/understanding-checklist.md`.

## Official Sources Rechecked

- [OR-Tools installation](https://developers.google.com/optimization/install)
- [OR-Tools package releases](https://pypi.org/project/ortools/)
- [Python 3.13.14 release](https://www.python.org/downloads/release/python-31314/)
- [FastAPI container deployment](https://fastapi.tiangolo.com/deployment/docker/)
- [Cloud Run configuration](https://docs.cloud.google.com/run/docs/configuring)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Cloud Run request timeouts](https://docs.cloud.google.com/run/docs/configuring/request-timeout)
- [Cloud Run health checks](https://docs.cloud.google.com/run/docs/configuring/healthchecks)
- [Cloud Run revisions and rollback](https://docs.cloud.google.com/run/docs/managing/revisions)
- [AWS App Runner overview](https://docs.aws.amazon.com/apprunner/latest/dg/)
- [AWS App Runner request behavior](https://docs.aws.amazon.com/apprunner/latest/dg/develop.html)
- [Azure Container Apps scaling](https://learn.microsoft.com/azure/container-apps/scale-app)
- [Azure Container Apps revisions](https://learn.microsoft.com/azure/container-apps/revisions)
- [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)
- [Supabase signing keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase API key security](https://supabase.com/docs/guides/getting-started/api-keys)

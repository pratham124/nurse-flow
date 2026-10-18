# Expo template reads through Go

Task 10 moves only the floor-template list read to the local Go API. The user
approved web and native support on 2026-10-17.

## Request and mapping

`src/services/goApiClient.ts` configures the public `EXPO_PUBLIC_GO_API_URL`
once as the shared Axios base URL. `src/services/floorTemplateRepository.ts`
obtains the current access token using the existing Supabase client's
`auth.getSession()` and sends
`GET /floor-templates` with `Authorization: Bearer <token>`. Supabase retains
sign-in, persisted sessions, and token refresh. Go remains responsible for token
verification and database authorization.

The request contains no profile ID or owner filter. The profile ID passed to
the repository is used only to reject returned records owned by another account.
The response must be HTTP 200 with a `templates` array and the six expected row
fields. Invalid envelopes, malformed rows, or any bad snapshot reject the whole
load. The repository preserves server order and timestamp strings.

The existing `mapTemplateRow` and snapshot mapper moved into this module without
changing their behavior: require the three arrays; shallow-copy their elements;
use the row ID/name; discard extra top-level snapshot fields; preserve additional
element fields without adding element-field validation. Supabase template writes
reuse this same mapper.

`serverWorkspaceRepository.ts` calls the new reader inside its existing
`Promise.all`. Template failure still rejects the workspace. Active shifts,
previous-shift snapshots, template writes/deletes, and all other reads and writes
retain their existing paths. Existing workspace state and screens display errors
and support retry. No fallback to the Supabase template list is present.

## Response schemas

Task 10 uses pinned Zod 4.6.7 as a direct app dependency. The private
`floorTemplateRowSchema` defines the six response fields, and
`floorTemplateListSchema` defines the `templates` array. The exported
`FloorTemplateRow` type is inferred with `z.infer` and remains shared by the
existing Supabase write result mappings.

Axios response data remains `unknown` until `safeParse` succeeds. A schema
failure produces the same controlled invalid-response message rather than raw
Zod issues or partial results. The schemas replace the manual envelope guard,
`isTemplateRow`, and duplicate row type definition.

The snapshot field deliberately remains `z.unknown()`: the existing snapshot
mapper still validates its three arrays and preserves their original mapping
behavior. The required snapshot key is checked even though its value is unknown.
String IDs, names, and timestamps retain their previous acceptance rules; no
coercion, defaults, skipped rows, UUID restriction, or date normalization is added.
Extra envelope and row fields are tolerated and do not change the mapped result.
The separate profile ownership check remains in place.

References: [Zod basic usage](https://zod.dev/basics),
[Zod object schemas](https://zod.dev/api#objects).

## Failures

Missing configuration and session failures stop before HTTP. Network errors,
HTTP 401/403/503, unexpected statuses, and malformed responses produce controlled
messages. The client does not display raw server error bodies. The shared Axios
client's ten-second timeout covers the HTTP request and response body. Requests
omit cookies and reject redirects. There is no custom token refresh or automatic
retry loop.

## Local web setup

From `backend`, start Go using the previously saved development credential:

```powershell
./scripts/development.ps1 Api
```

In the repository root's ignored `.env`, alongside the development Supabase URL
and publishable key:

```dotenv
EXPO_PUBLIC_GO_API_URL=http://127.0.0.1:8080
```

Then, from the repository root:

```powershell
npm run web -- --port 8081
```

Open `http://localhost:8081` and sign in with the existing development fixtures.
The Go API defaults to accepting web origins `http://localhost:8081` and
`http://127.0.0.1:8081`. The API address and the web origin are different settings:
the former is where requests go; the latter is where the browser page is served.

`NURSEFLOW_WEB_ORIGINS` overrides the complete comma-separated allowlist. Set it
in the Go terminal before starting the API, for example:

```powershell
$env:NURSEFLOW_WEB_ORIGINS = 'http://localhost:8091'
./scripts/development.ps1 Api
```

An explicitly empty value permits no browser origins; native requests without an
Origin header still work. Origins match exactly, including scheme and port; no
wildcard or cookie permission is added. CORS wraps the router, answers GET
preflight for Authorization/Accept before authentication, and includes the origin
header on allowed-origin errors. Actual requests retain token/profile checks.
Requests from unlisted browser origins receive 403.

Reload Expo after changing public environment settings. Never put database
passwords, secret API keys, or access tokens in public environment variables.
If the Python optimizer also runs locally, give it a different port from Go.

## Physical devices

Keep the Go loopback default for computer-only development. To test on a phone
on the same private network, explicitly bind Go to the computer's interfaces:

```powershell
$env:NURSEFLOW_HTTP_ADDR = '0.0.0.0:8080'
./scripts/development.ps1 Api
```

Set Expo's public API URL to `http://<computer-LAN-IP>:8080`, reload the app,
and verify the phone can reach `http://<computer-LAN-IP>:8080/health`. A phone's
localhost refers to the phone. Windows firewall/network settings must allow that
private-network connection. Native requests do not require CORS. A browser using
the LAN address does require its exact Expo origin in the Go allowlist.
Physical-device testing is not claimed without a connected device.

## Verification

Run from the repository root:

```powershell
npm run test:go-templates
npm run test:server-workspace-store
npx tsc --noEmit
npm run lint
```

From `backend`:

```powershell
go test -race ./... -count=1
go vet ./...
```

The new repository checks use synthetic sessions and responses and one real local
HTTP server. They cover current-token use, identity-free requests, unchanged
mapping/order/timestamps, empty results, wrong owners, malformed rows/snapshots,
missing configuration/session, controlled failures, and timeout. Go checks cover
browser preflight, allowed and unlisted origins, readable auth errors, and
authenticated/native requests. Existing workspace-store checks cover failure
handling and state behavior.

The full milestone failure matrix and real-account walkthrough are ordered
Task 11. Task 10's minimal browser result is recorded below once observed.

## Sources

- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Supabase getSession](https://supabase.com/docs/reference/javascript/auth-getsession)
- [Fetch CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)

### Observed on 2026-10-17

- All 11 new template repository tests and nine existing workspace-store tests passed.
- TypeScript, lint, Go race tests, and Go vet passed.
- Expo web bundled successfully and reached sign-in. A real Charge Alpha session displayed Migration Test Floor with two rooms and three beds through the new list path.
- Charge Beta rejected its prior test password once. The user does not remember its current password, so no reset was attempted. Beta's manual browser empty-state check remains pending; the automated empty-list test passed.
- Physical-device reachability has not been exercised because no connected device was available. Web reachability was exercised at localhost:8081 against Go at 127.0.0.1:8080.
- Task 10 code is implemented; its task ticket and ordered checkbox remain open for the remaining manual criteria. The full Task 11 verification matrix is not claimed.

- Additional live browser check: stopping Go and reloading Alpha's workspace showed the controlled template-service connection error. Restarting Go and using Retry restored the template list. This confirms visible failure behavior and the Go read path without a Supabase fallback.

### Shared Axios client

The user requested a shared Axios client and a constant base URL. Pinned Axios
1.20.0 is configured once in `src/services/goApiClient.ts` with
`const baseURL = process.env.EXPO_PUBLIC_GO_API_URL`, a ten-second timeout, and
the JSON Accept header. Endpoint callers supply a relative path and their current
token; tokens are not stored in instance defaults. A missing-setting guard stops
requests before HTTP. The URL-building helper, base-URL override, optional fetch
implementation, and manual AbortController/timer were removed.

The client uses Axios's fetch adapter so cookie omission and redirect rejection
remain configured centrally. Axios parses JSON and rejects unsuccessful statuses;
the template repository retains the exact HTTP 200 contract, controlled messages,
row/snapshot validation, mapping, and owner check. Supabase auth lifecycle and
other data paths are unchanged.

The 16 focused checks cover the repository and real local HTTP through the shared
client, including missing configuration, headers, HTTP errors, malformed JSON,
redirect rejection, and timeouts for both a stalled request and a stalled response
body. Nine existing workspace-store checks also passed. Expo web bundled with
Axios and the existing real Charge Alpha session displayed Migration Test Floor
with two rooms and three beds. Beta's manual empty-state and physical-device
results remain unavailable.

Sources:
[Axios instances](https://axios-http.com/docs/instance),
[Axios request configuration](https://axios-http.com/docs/req_config).


Final Axios follow-up verification: TypeScript, focused lint, and all 16 focused checks passed with the finalized client import. Temporary local servers and the verification tab were closed afterward.

Readability follow-up: `loadFloorTemplates` now reads as session lookup, authenticated request, and response parsing. Private `throwTemplateRequestError` and `parseFloorTemplateList` helpers retain the same controlled messages, HTTP 200 contract, row/snapshot validation, mapping, and owner checks. All 16 existing Axios/template checks, TypeScript, and focused lint passed after the refactor.

Zod follow-up verification: all 18 Axios/template checks, nine workspace tests, TypeScript, and focused lint passed. Expo web bundled with Zod 4.6.7 and Alpha's existing development session displayed Migration Test Floor with two rooms and three beds. The manual Beta/device status is unchanged. Temporary verification servers were stopped afterward.

Migration convention agreed on 2026-10-17: use Zod for Expo-side validation of Go API responses as each workflow migrates, with inferred TypeScript response types. Adopt it incrementally alongside each migrated path and preserve existing mapping/error semantics. This decision is recorded in the migration plan's agreed decisions; Go continues to enforce server-side validation and authorization.

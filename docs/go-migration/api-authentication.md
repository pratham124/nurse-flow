# Go API authentication

Task 7 implements token verification, a protected diagnostic route, and controlled authentication errors. Profile resolution/charge-nurse authorization remain task 8; template reads remain task 9.

## Development signing configuration inspected on 2026-10-10

- Project: `nurseflow-go-dev` (`nmitctyxtjmlakcsmnuj`).
- Dashboard JWT settings identify the current key as ECC P-256, key ID `5062456a-adac-4d67-b29b-8e6b0ce454c9`.
- The public discovery endpoint returned one EC/ES256 key with that same ID: `https://nmitctyxtjmlakcsmnuj.supabase.co/auth/v1/.well-known/jwks.json`.
- The dashboard also lists a previously used legacy HS256 shared-secret key, rotated about a month ago. No private key or shared secret was read, copied, or changed.
- Key IDs are inspected facts, not values to hardcode in the verifier. Verification should discover trusted public keys from the fixed development endpoint.

## Agreed design

The user chose ES256-only verification. The Go API rejects HS256 tokens without a shared-secret or remote Auth fallback. A client holding an older token must refresh its Supabase session or sign in again. No signing keys, Expo sign-in code, refresh behavior, or database policies were changed.

The existing plan already settles Expo sign-in/token refresh, server verification before trusting identity, and the boundary between authentication (task 7), profile/charge-nurse authorization (task 8), and template reads (task 9). Those decisions are not being reopened.

The pinned library is `github.com/golang-jwt/jwt/v5` v5.3.1. It verifies the ES256 signature and validates issuer `https://nmitctyxtjmlakcsmnuj.supabase.co/auth/v1`, audience `authenticated`, and required expiry. A supplied `nbf` or `iat` cannot be in the future; `iat` is not required. No clock-skew allowance is added. The subject must have UUID format, and the signed database-role claim must equal `authenticated`. This claim does not establish the user's NurseFlow nurse role; task 8 will read that from the profile.

The user also chose library-managed JWKS retrieval and caching for readability and maintenance. Pinned `github.com/MicahParks/jwkset` v0.11.3 handles fetching, decoding, curve-point validation, synchronized storage, and refresh. This is the underlying library used by `keyfunc`; our existing JWT key callback can use it directly without another wrapper dependency. `golang.org/x/time` v0.9.0 supplies the refresh rate limiter. The intermediate `go-jose` dependency has been removed.

## Files and request flow

- `backend/internal/auth/verifier.go`: validates the token and returns an `Identity` containing only the verified Auth subject. It has no database dependency.
- `backend/internal/auth/keys.go`: configures library-managed discovery and caching at the fixed development endpoint. The small `signingKeyStore` wrapper enforces our public P-256/ES256 selection, signing use (or no declared use), and missing/duplicate key-ID rejection before accepting a refreshed set. `boundedKeyTransport` rejects declared response sizes above 64 KiB and limits streamed response reads to that size. Redirects and JWK certificate-URL fetches are rejected; HTTPS uses certificate verification and requests time out after five seconds. There is no application-owned cache mutex, expiry timestamp, fetch loop, or coordinate decoder.
- `backend/internal/auth/middleware.go`: reads one `Authorization: Bearer <token>` header, verifies it, and attaches identity to the request context before calling the protected handler. Query parameters/body fields cannot supply identity. A private context-key type prevents accidental key collisions.
- `backend/internal/httpresponse/json.go`: writes JSON success/error responses with `Cache-Control: no-store`. Errors expose stable codes/messages rather than raw library failures or tokens.
- `backend/cmd/api/main.go`: gives the verifier a server-lifetime context and cancels background refresh when `run` exits. The constructor now returns `(*Verifier, error)` because it configures a library resource. It attempts initial key retrieval before listening (at most five seconds); retrieval failure does not prevent startup. `/health` stays public, and `GET /auth/check` returns `{"auth_user_id":"<verified subject>"}` without a database connection.
- `backend/internal/auth/*_test.go` and the API handler test: exercise signed synthetic tokens, claim/signature rejection, middleware behavior, key discovery/caching, and controlled failures. Private test keys are generated in memory and never stored as project credentials.

Context now has two uses: it carries cancellation/deadlines to the key request and holds the verified identity for downstream handlers. A middleware is an HTTP handler wrapping another handler; it can reject a request before the wrapped handler executes. No profile or template handler is implemented here.

## Public-key cache and limits

The library fetches once during setup and refreshes every five minutes in the background. Unknown key IDs can trigger an additional refresh, rate-limited to once every 30 seconds; the initial fetch consumes the first allowance. Waiting for the limiter and the associated request is bounded by five seconds. The library owns storage synchronization; known keys are read from its cache without another HTTP request. These are conservative starting defaults, not measured production settings. Tokens are limited to 8 KiB, and key IDs to 256 characters. Token headers cannot choose a remote URL or algorithm outside ES256.

This replaces the previous request-triggered five-minute expiry with a background refresh interval. Cached keys remain available while a refresh is in flight. A failed refresh clears the cache, and authentication returns an unavailable error while no accepted keys are cached; a later successful refresh recovers automatically. A successful refresh replaces the set, including removal of revoked keys. New keys may be temporarily rejected during the unknown-key refresh pause. Supabase's own discovery cache can add up to ten minutes of delay; revocation is not instantaneous. Before rotating keys, allow discovery caches to see the standby key. Restarting the Go process clears its local cache but not Supabase's edge cache.

Local JWT verification does not query live session/account state on each request. A still-valid token is not automatically invalidated by sign-out or account deletion; session-revocation requirements must be considered before sensitive write workflows or deployment.

## Error contract

| Situation | Status | JSON error code |
| --- | --- | --- |
| Missing/malformed bearer credentials or rejected token | 401 | `unauthenticated` |
| Required public keys cannot be retrieved/decoded | 503 | `auth_unavailable` |
| Protected handler called without middleware identity | 500 | `internal_error` |

An authentication error body has this shape:

```json
{"error":{"code":"unauthenticated","message":"A valid access token is required."}}
```

401 responses also include `WWW-Authenticate: Bearer`. Internal exception messages, raw tokens, and credentials are neither returned nor logged. Existing router-generated 404/405 behavior remains unchanged; the JSON contract above covers authentication and protected-handler errors.

## Verification and manual requests

From `backend`, run ordinary checks:

```powershell
go test ./...
go vet ./...
```

Public-key discovery can be checked without a user token or API secret:

```powershell
$env:NURSEFLOW_AUTH_LIVE_CHECK = '1'
go test ./internal/auth -run TestDevelopmentPublicKeys -v -count=1
```

Start `go run ./cmd/api`. In another terminal:

```powershell
curl.exe --include http://127.0.0.1:8080/health
curl.exe --include http://127.0.0.1:8080/auth/check
curl.exe --include -H 'Authorization: Bearer invalid-token' http://127.0.0.1:8080/auth/check
```

Expect health 200 and both diagnostic failures 401 with the documented JSON. To check a real signed-in session, privately obtain its current development access token (not an API key), then use:

```powershell
$task7Token = Read-Host 'Current development access token' -AsSecureString
$task7Headers = @{ Authorization = 'Bearer ' + [System.Net.NetworkCredential]::new('', $task7Token).Password }
Invoke-RestMethod -Uri http://127.0.0.1:8080/auth/check -Headers $task7Headers
Remove-Variable task7Headers, task7Token
```

Do not paste tokens into chat or commit them. Expected success is the token's verified Auth UUID. Regular nurses can authenticate here too; the charge-nurse restriction belongs to task 8.

Evidence on 2026-10-10: ordinary Go tests/static checks passed, including valid/invalid synthetic signatures and claims; the opt-in Go discovery test fetched the actual development ES256 key successfully. Running-server requests on temporary port 18087 returned health 200 and controlled JSON 401 for missing/malformed tokens. At 21:28 UTC, the user-run private check signed in as `charge.alpha@example.com` in development: its real Supabase token returned 200 with the matching Auth UUID `4ea34fc9-d17b-411e-83a0-8a82cf9b8977`, and an altered signature returned 401. The fixture password was reset through the development Auth admin API while preserving the existing user ID. Credentials and tokens were not recorded. The temporary test server was stopped afterward. Database ownership integration checks were not rerun because no database code or policy changed.

## References

- [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)
- [Supabase signing keys and discovery caching](https://supabase.com/docs/guides/auth/signing-keys)
- [JWT library release](https://github.com/golang-jwt/jwt/releases/tag/v5.3.1)
- [JWT parser options](https://pkg.go.dev/github.com/golang-jwt/jwt/v5@v5.3.1)
- [jwkset HTTP storage and cache configuration](https://pkg.go.dev/github.com/MicahParks/jwkset@v0.11.3)

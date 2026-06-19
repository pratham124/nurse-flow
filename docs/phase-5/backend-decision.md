# Phase 5 Backend Decision

Decision date: 2026-06-13

## Decision

Use Supabase for Phase 5 auth and server-side persistence.

- Auth provider: Supabase Auth with email/password.
- Database provider: Supabase Postgres.
- Authorization boundary: Supabase Row Level Security policies, added in later Phase 5 implementation tasks.
- Native session storage: prefer Expo SecureStore for Supabase session tokens when auth is implemented.
- Client pattern: request/response reads and writes from small app service or repository helpers.

This task is planning only. It does not add Supabase dependencies, environment files, tables, policies, or app code.

## Why Supabase Fits Phase 5

Supabase is enough for the Phase 5 goal because it gives NurseFlow one service for both account sessions and server records:

- Email/password signup and login are supported by Supabase Auth.
- React Native session persistence is supported by the Supabase client setup pattern for Expo/React Native.
- Postgres tables can store profiles, floor templates, active shifts, previous-shift snapshots, and nurse access records.
- Row Level Security can protect charge nurse records and nurse-scoped assignment reads.

This keeps the first backend phase beginner-friendly: one provider, one app client, and one database model.

## Environment Variables

The app should need only client-safe public values:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Rules:

- Do not put a Supabase secret key or service role key in the Expo app.
- If these variables are missing, a later setup-gate task should show a readable setup message instead of crashing.
- Keep the environment variable names aligned with Expo's public client environment pattern.

## Session Security Posture

Supabase Auth uses short-lived JWT access tokens for signed-in user sessions. Those tokens are bearer credentials, so Phase 5 should treat local session storage as sensitive.

When the auth client is implemented:

- Store Supabase session tokens in Expo SecureStore on native iOS and Android where available.
- Use the least surprising secure default first; avoid storing auth tokens in plain AsyncStorage for native builds unless a platform limitation forces a documented fallback.
- Never store raw passwords, Supabase secret keys, or service role keys in the Expo app.
- Keep Row Level Security as the server-side enforcement layer. Secure local storage reduces device-token exposure, but it does not replace backend authorization.
- On sign out, delete the stored Supabase session and clear account-specific in-memory state.
- If secure storage is unavailable or a stored session cannot be read, show a safe signed-out or setup-recovery state instead of crashing.

SecureStore notes:

- Expo SecureStore stores encrypted key-value pairs locally on device.
- Android stores values in encrypted SharedPreferences backed by the Android Keystore.
- iOS stores values using Keychain services.
- Large stored values can fail on some platforms, so the implementation should handle storage read/write errors.

## Phase 5 Data Boundary

Phase 5 should use ordinary request/response database reads and writes:

1. The user submits a focused action.
2. The app writes that change to Supabase.
3. The app reloads the relevant server-owned data.
4. The next screen renders from the refreshed server response.

Do not use realtime subscriptions to make the UI update in Phase 5.

## Realtime Is Deferred

Supabase supports realtime features, but NurseFlow will not enable them in Phase 5.

Deferred provider features:

- Realtime database subscriptions.
- Broadcast channels.
- Presence.
- Nurse invite links.
- Deep link joins.
- Push notifications.
- Offline write queues or conflict resolution.

Reason: Phase 5 is only backend, auth, and server persistence. Multi-device collaboration belongs to Phase 6, and push/offline behavior belongs to later phases.

## Future Fit Check

Choosing Supabase for Phase 5 does not block the planned later phases:

- Phase 6 realtime collaboration can use Supabase Realtime features such as database change listeners, Broadcast, or Presence after the server persistence model is stable.
- Phase 6 nurse invite links can be modeled with Supabase Auth/email behavior plus NurseFlow-owned invite or access records in Postgres.
- Phase 6 deep link joins can use Expo deep linking and Supabase auth redirect support when that phase is ready.

This is a compatibility check only. Phase 5 should not create realtime channels, invite-token tables, deep link routes, or join flows.

## ID Rule

Normal backend records should use one `id` field.

Examples:

- `UserProfile.id`
- `FloorTemplateRecord.id`
- `ActiveShiftRecord.id`
- `ServerPreviousShiftSnapshot.id`
- `ShiftNurseAccess.id`

Old local IDs from Phase 1-4 should not be carried into the normal Phase 5 model. The old local storage data was only for testing before server persistence existed, so Phase 5 should remove the local storage-backed app state path instead of importing it. Normal screen state and fetched server records should use one backend-owned `id` field.

## Beginner-Friendly Local Setup

Local development should stay small:

1. Create one Supabase project for development.
2. Copy the project URL and publishable key into local environment variables.
3. In later tasks, add the minimal tables and Row Level Security policies needed for the current task.
4. Create signed-in test accounts through the app once auth screens exist. For joined nurse access testing, link one profile to one shift nurse manually.
5. Reset test data by deleting test rows and test users from the development Supabase project, or by rerunning the documented development SQL reset once that SQL exists.

Reset expectations:

- Never reset production data while testing.
- Keep test account emails obvious, such as `charge-test@example.com`.
- Existing local Phase 1-4 test data does not need to be preserved after the matching server-backed flows are in place.

## References Checked

- Supabase React Native Auth quickstart: https://supabase.com/docs/guides/auth/quickstarts/react-native
- Supabase password auth guide: https://supabase.com/docs/guides/auth/passwords
- Supabase Row Level Security guide: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Realtime overview: https://supabase.com/docs/guides/realtime
- Supabase JWT guide: https://supabase.com/docs/guides/auth/jwts
- Expo SecureStore docs: https://docs.expo.dev/versions/latest/sdk/securestore/

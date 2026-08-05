# Services

External service wrappers belong here when a phase needs them.

Phase 5 uses this folder for small Supabase auth, profile, and server workspace
repositories.

Keep service files focused on one boundary at a time. Auth belongs in
`authRepository`, profile rows belong in `profileRepository`, Supabase client
setup belongs in `supabaseClient`, and floor-template or active-shift server
reads and writes belong in `serverWorkspaceRepository`.

Phase 6 adds focused realtime and invite boundaries here. Realtime subscription
setup belongs in `realtimeWorkspaceRepository`, and shift invite record reads or
writes belong in `shiftInviteRepository`.

For the Phase 6 nurse invite flow, the screen should ask
`shiftInviteRepository` to create, validate, accept, regenerate, revoke, or
expire invite codes. Screens should not store raw invite codes anywhere durable.

For the Phase 6 live update flow, `ServerWorkspaceContext` starts a realtime
listener only after the signed-in user has an active charge shift or linked
joined nurse access. A realtime event is only a signal to refetch server data;
it should not become a second copy of saved shift state.

Phase 7 adds `devicePushTokenRepository` as the focused boundary for obtaining
this device's Expo push token, registering it for the signed-in profile, and
disabling the device record before sign out. Token records stay separate from
active shifts and patient data.

Phase 7 notification taps use `serverWorkspaceRepository` to confirm current
shift or nurse-access state before navigation. Notification payloads are only
pointers; they never replace a current server read.

Phase 8 request threads use `requestMessageRepository` as the only app-facing
boundary for listing and appending request messages. The server derives the
author and request access from the signed-in session; screens never choose an
author identity or query another nurse's thread directly.

Do not add offline queues, deep links, drag-and-drop overrides, board sharing,
tablet layout, AI, or other future task infrastructure here until the matching
task starts.

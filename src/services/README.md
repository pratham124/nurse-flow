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

Do not add push notifications, offline queues, deep links, drag-and-drop
overrides, board sharing, tablet layout, AI, or future-phase infrastructure here
until the matching phase starts.

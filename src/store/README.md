# Store

Shared app state belongs here when a workflow grows beyond local screen state.

`ServerWorkspaceProvider` creates one Zustand store for each provider mount.
Context carries only that stable store object, while screens subscribe to the
small state slices they use through `useServerWorkspace(selector)`.

- `serverWorkspaceStore.ts` owns server-workspace state, derived views, and
  stable actions.
- `serverWorkspaceDependencies.ts` connects those actions to the production
  repositories without coupling the store's focused tests to React Native.
- `ServerWorkspaceContext.tsx` owns the provider lifecycle and charge/joined
  nurse realtime subscriptions, including their unmount cleanup.

Prefer a direct selector for one field. Use Zustand's `useShallow` when a
component selects an object containing several fields. Keep screen-local form,
filter, dialog, and mutation feedback state in the screen rather than adding it
to this store.

Server actions return promises and throw failures to their caller. The screen
that starts an operation owns its pending flag and error message, so an
assignment move cannot disable an unrelated floor-template or shift workflow.

Phase 7 uses `NotificationTapContext` only for temporary notification routing
and recovery state. Saved shift data continues to live in the server workspace
boundary.

# Server Workspace Store Migration

This focused refactor moves the existing server workspace behavior from one
broad Context value to a provider-scoped Zustand store. It is intentionally
incremental so behavior changes can be reviewed separately from subscription
changes.

## Task 1 - Preserve Behavior With Selector Subscriptions

Status: complete.

- [x] Add Zustand through Expo's dependency workflow.
- [x] Create one fresh store for each `ServerWorkspaceProvider` mount.
- [x] Keep realtime subscription setup and cleanup in the provider.
- [x] Move workspace state, derived views, and existing actions into the store.
- [x] Preserve the current `saveStatus` and `saveErrorMessage` behavior.
- [x] Migrate consumers to explicit field-level selectors.
- [x] Add focused tests for store isolation, atomic derived state, selector
  isolation, save lifecycle, failure behavior, sign-out reset, and selector
  usage.
- [x] Remove obsolete simulated nurse screens and their draft session state.
- [x] Complete the human understanding checkpoint.

## Task 2 - Revisit Mutation Status

Status: not started.

After Task 1 is understood and manually checked, decide whether the single
shared `saveStatus` should become operation-specific mutation state. Do not mix
that behavior redesign into the store migration.

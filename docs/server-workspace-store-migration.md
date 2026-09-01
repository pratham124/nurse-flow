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

Status: complete.

- [x] Inventory all shared `saveStatus` and `saveErrorMessage` consumers.
- [x] Keep authoritative workspace data and actions in the shared store.
- [x] Remove the shared save lifecycle and its unused model type.
- [x] Reuse existing operation-local flags for optimizer and request updates.
- [x] Add local pending state to shift saves, template saves, carry-over saves,
  and assignment moves.
- [x] Keep failure messages local to the screen that started the operation.
- [x] Verify that an in-flight save does not publish unrelated shared-store
  state before the authoritative workspace refresh.
- [x] Complete automated validation.
- [x] Complete the human understanding checkpoint.

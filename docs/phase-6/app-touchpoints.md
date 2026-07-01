# Phase 6 App Touchpoints

Task: Phase 6 Task 0.2, Confirm Existing App Touchpoints

This note maps the current app before writing Phase 6 realtime or invite feature code. It is documentation only and should not change Phase 1-5 behavior.

## Scope Reminder

`docs/phases.md` defines Phase 6 as Realtime Collaboration and Nurse Invites.

Phase 6 includes:

- Realtime updates for active shift data.
- Nurse invite link generation.
- Deep link handling for nurse joins.
- Invite expiration when a shift ends.
- Regenerate and reshare nurse links.
- Joined nurse assignment updates on connected devices.
- In-app live issue flags and swap requests.

Phase 6 excludes:

- Push notifications.
- Offline write queues.
- Conflict resolution systems.
- Drag-and-drop assignment override.
- Board snapshot sharing.
- Tablet layout.
- AI.

## Current Route Shape

The app uses Expo Router under `src/app/`. Route files stay thin and point to screen files under `src/screens/`.

Relevant current routes:

- `src/app/_layout.tsx` wraps auth, server workspace, workflow draft, and session gate providers.
- `src/app/index.tsx` opens the charge nurse account workspace.
- `src/app/floor-board.tsx` opens the charge nurse floor board.
- `src/app/flags.tsx` opens charge nurse flags and request review.
- `src/app/local-request-detail.tsx` opens one request detail.
- `src/app/join-active-session.tsx` opens the current placeholder join shell.
- `src/app/regular-nurse-workspace.tsx` opens the joined nurse workspace shell.
- `src/screens/SimulatedNurse*` screens are legacy local simulation reference code.
  The `src/app/simulated-nurse-*` route files were removed in Task 4.3 so
  simulated nurse screens are no longer reachable from the normal app route
  surface.

Likely Phase 6 route additions later:

- A Nurse Invites route near the Floor Board route.
- An invite deep-link join gate route.
- A real joined nurse assignment route, likely building on the existing `regular-nurse-workspace` shell.

## Current Provider And State Boundaries

`src/app/_layout.tsx` currently nests providers in this order:

1. `AuthSessionProvider`
2. `ServerWorkspaceProvider`
3. `WorkflowDraftProvider`
4. `SessionGate`

Important boundaries:

- `src/store/AuthSessionContext.tsx` owns session checking, signed-in profile state, and sign out.
- `src/store/ServerWorkspaceContext.tsx` owns server workspace load state, active shift snapshots, save state, joined nurse access load state, and active participation.
- `src/store/WorkflowDraftContext.tsx` owns unsaved workflow draft state and local nurse simulation state.

Realtime connection state should likely live in `ServerWorkspaceContext` or a focused provider directly beside it, because it depends on signed-in profile, active shift, joined nurse access, and cleanup on sign out.

Connection state should not live in `WorkflowDraftContext` because it is not draft input. It should not be saved into the active shift snapshot because it is foreground UI state, not server truth.

## Current Server Service Boundary

`src/services/serverWorkspaceRepository.ts` is the main server persistence boundary.

Current server functions include:

- `loadServerWorkspace`
- `saveServerFloorTemplate`
- `deleteServerFloorTemplate`
- `createServerActiveShift`
- `saveServerActiveShift`
- `endServerActiveShift`
- `saveServerPreviousShiftSnapshot`
- `loadJoinedNurseAssignmentView`

Likely Phase 6 service additions later:

- Realtime subscription helpers, either in `serverWorkspaceRepository.ts` if small or a new focused file such as `src/services/realtimeWorkspaceRepository.ts`.
- Invite repository functions in a focused service file, such as `src/services/shiftInviteRepository.ts`, once invite records are implemented.
- Invite validation and join functions near the invite repository rather than inside screen files.

Screens should continue to avoid direct Supabase table calls.

## Active Shift Save Flow

`ServerWorkspaceContext.saveActiveShift` currently:

1. Confirms the user is signed in as a charge nurse.
2. Calls `saveServerActiveShift`.
3. Reloads the server workspace with `loadServerWorkspace`.
4. Applies the refreshed workspace.

This request-then-refresh shape is important for Phase 6. Realtime should add live update signals around the same server truth, not replace direct writes with a second local sync model.

Current screens that save active shift changes:

- `src/screens/CarryOverReviewScreen.tsx`
- `src/screens/StartShiftScreen.tsx`
- `src/screens/NursesScreen.tsx`
- `src/screens/PatientsAndAcuityScreen.tsx`
- `src/screens/AssignmentReviewScreen.tsx`
- `src/screens/BreakScheduleScreen.tsx`
- `src/screens/SimulatedNurseIssueScreen.tsx`
- `src/screens/SimulatedNurseSwapScreen.tsx`
- `src/screens/LocalRequestDetailScreen.tsx`

Compatibility risk:

- A realtime refetch must not overwrite unsaved screen-local edits before the user presses the existing save action.
- Direct saves should keep their readable error states even after realtime listeners exist.

## Joined Nurse Access Flow

Phase 5 already has a joined nurse boundary:

- `ServerWorkspaceContext` calls `loadJoinedNurseAssignmentView`.
- `serverWorkspaceRepository` calls the `get_joined_nurse_assignment_view` RPC.
- `RegularNurseWorkspaceScreen` renders loading, empty, ready, and error states.
- `HomeScreen` blocks starting or joining conflicting active participation contexts.

The existing Phase 5 joined nurse shell that can become the real invite join path is:

- `src/screens/JoinActiveSessionScreen.tsx` for the pre-join gate shell.
- `src/screens/RegularNurseWorkspaceScreen.tsx` for the post-join nurse-scoped assignment shell.

Compatibility risk:

- Invite join should create or update shift nurse access without granting full charge nurse workspace reads.
- A signed-in user who owns an active charge shift should still be blocked from joining another shift as a nurse.

## Request Flow

Current request behavior stores nurse requests inside the active shift snapshot:

- `src/utils/nurseRequests.ts` creates, lists, de-duplicates, and resolves request records.
- `src/utils/nurseRequestDisplay.ts` prepares request display data.
- `SimulatedNurseIssueScreen` appends issue requests with `saveActiveShift`.
- `SimulatedNurseSwapScreen` appends swap requests with `saveActiveShift`.
- `LocalRequestDetailScreen` resolves pending swap requests with `saveActiveShift`.

Compatibility risk:

- Phase 6 live requests should preserve the existing request status meanings.
- Joined nurse request writes must be nurse-scoped on the server before they become real multi-device actions.
- Realtime request updates should not add push notification behavior.

## Floor Board And Flags Touchpoints

Likely Phase 6 UI touchpoints later:

- `src/screens/HomeScreen.tsx` for active shift live status.
- `src/screens/FloorBoardScreen.tsx` for board live status and Nurse Invites navigation.
- `src/screens/FlagsScreen.tsx` for live issue and swap request updates.
- `src/screens/RegularNurseWorkspaceScreen.tsx` for joined nurse live status.

Compatibility risk:

- Live status chips should be small foreground UI, not a new saved data field.
- The floor board must keep existing census, flags, unassigned-bed, workload, break, and local simulation behavior until each later Phase 6 task changes one behavior explicitly.

## Compatibility Risks To Watch Later

- Realtime listeners must stop when the user signs out, the shift ends, active shift clears, joined nurse access is removed, or the screen tree no longer has a matching participation context.
- Fast Refresh during development should not create duplicate subscriptions.
- Reconnecting should refetch server data without promising offline write support.
- Invite links should not store raw tokens in normal persisted app data.
- Invite validation should not show patient data before the signed-in user successfully joins.
- Existing local simulation routes should stay clearly labeled until a real joined nurse path fully replaces their testing purpose.

## Likely Files Affected Later

- `src/store/ServerWorkspaceContext.tsx`
- `src/services/serverWorkspaceRepository.ts`
- `src/services/supabaseClient.ts`
- A new invite service file under `src/services/`
- A new realtime service file under `src/services/` if the subscription logic grows
- `src/types/models.ts`
- `src/app/_layout.tsx`
- `src/app/floor-board.tsx`
- `src/app/flags.tsx`
- `src/app/join-active-session.tsx`
- `src/app/regular-nurse-workspace.tsx`
- Future thin route files for Nurse Invites and invite deep-link join
- `src/screens/HomeScreen.tsx`
- `src/screens/FloorBoardScreen.tsx`
- `src/screens/FlagsScreen.tsx`
- `src/screens/JoinActiveSessionScreen.tsx`
- `src/screens/RegularNurseWorkspaceScreen.tsx`
- Future Nurse Invites and Invite Join Gate screen files
- `docs/phase-5/supabase-auth-setup.md` or a new Phase 6 backend setup note when schema work begins

## Task 0.2 Guardrail

This task does not add realtime subscriptions, invite tables, invite links, deep links, push notifications, offline queues, conflict handling, drag-and-drop behavior, board sharing, tablet layout, or AI.

# Understanding Checklist

Use this file as the running teaching checklist after each completed task. Keep entries short, concrete, and tied to the actual work completed.

## How To Use This Checklist

For each task, add a dated section with:

- Task: what changed.
- Problem understanding: what the human should be able to explain about the problem and why it existed.
- Solution understanding: what the human should be able to explain about the implementation, design decisions, and edge cases.
- Broader context: what the human should understand about why the change matters and what it affects.
- Verification: how understanding was checked, such as restatement, open-ended question, multiple-choice quiz, code walkthrough, debugger walkthrough, or manual test explanation.
- Status: `pending`, `in progress`, or `verified`.

## Template

### YYYY-MM-DD - Task Name

- Task:
- Problem understanding:
  - [ ] What problem existed?
  - [ ] Why did it exist?
  - [ ] What branches or alternatives were considered?
- Solution understanding:
  - [ ] What changed?
  - [ ] Why was this solution chosen?
  - [ ] What design decisions matter?
  - [ ] What edge cases matter?
- Broader context:
  - [ ] Why does this matter to NurseFlow?
  - [ ] What current behavior does it impact?
  - [ ] What future work could it influence?
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

## Running Items

### 2026-06-26 - Add Charge Active Shift Realtime Subscription Boundary

- Task: Implement Phase 6 Task 1.2 by starting a charge active-shift realtime listener and refetching the active shift after server change signals.
- Problem understanding:
  - [ ] A realtime event should be treated as a signal that server data changed, not as trusted app state.
  - [ ] The listener must start only for a signed-in charge nurse with an active shift.
  - [ ] The listener must stop when the active shift disappears or the signed-in charge context is gone.
- Solution understanding:
  - [ ] `src/services/realtimeWorkspaceRepository.ts` owns the Supabase channel setup and status mapping.
  - [ ] `src/store/ServerWorkspaceContext.tsx` owns temporary foreground realtime connection state and listener lifecycle.
  - [ ] `src/services/serverWorkspaceRepository.ts` exposes `loadServerActiveShift` so realtime refreshes can refetch only the active shift.
  - [ ] Existing write flows still use request-then-refresh.
- Broader context:
  - [ ] Task 1.3 can render the temporary connection state in UI.
  - [ ] Joined-nurse subscriptions, invite links, push notifications, offline queues, and conflict handling remain out of scope.
  - [ ] Supabase must have `public.active_shifts` enabled in the `supabase_realtime` publication before backend update events can arrive.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-25 - Fix Home Template Cards on Small Screens

- Task: Reflow the Home floor-template card so its action no longer overlaps metadata on narrow phone screens.
- Problem understanding:
  - [ ] The template identity, two metadata chips, Start Shift action, and chevron were competing for one horizontal row.
  - [ ] Flexible shrinking could not preserve readable metadata and a usable action at narrow content widths.
  - [ ] This is a responsive presentation issue, not a shift or server-data issue.
- Solution understanding:
  - [ ] `FloorTemplateRow` compares the current window width with the module-level `COMPACT_TEMPLATE_CARD_MAX_WIDTH` constant.
  - [ ] Compact cards keep template identity and the chevron on the first row, then place Start Shift on its own aligned row.
  - [ ] The compact Start Shift action has a 44-point minimum touch target.
- Broader context:
  - [ ] Template editing, shift creation, deletion, navigation, and saved data behavior are unchanged.
  - [ ] Wider screens retain the existing single-row card layout.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-25 - Add Realtime Connection State Types

- Task: Complete Phase 6 Task 1.1 by defining the foreground realtime connection states without adding subscription behavior.
- Problem understanding:
  - [x] Realtime connection health needs a shared vocabulary before listeners and live-status UI are implemented.
  - [x] Connection health is temporary foreground app state, not saved active-shift or database data.
  - [x] Offline queues and conflict state are outside this task and Phase 6 scope.
- Solution understanding:
  - [x] `src/types/models.ts` exports `RealtimeConnectionState` with `connecting`, `live`, `reconnecting`, `disconnected`, and `error`.
  - [x] A string union rejects unsupported connection-state values during TypeScript compilation.
  - [x] `Shift`, `ActiveShiftRecord`, and `ServerWorkspace` remain unchanged, so connection state is not persisted.
- Broader context:
  - [x] Task 1.2 can use this type when it adds the charge active-shift subscription boundary.
  - [x] Task 1.3 can use the same vocabulary when it adds live-status UI.
  - [x] Existing auth, workspace, assignment, request, and break behavior is unaffected.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-21 - Confirm Phase 6 Existing App Touchpoints

- Task: Complete Phase 6 Tasks 0.1 and 0.2 by verifying the Phase 6 planning docs and documenting the current app touchpoints before runtime feature work starts.
- Problem understanding:
  - [ ] Phase 6 needs a clear boundary before adding realtime subscriptions or invite links.
  - [ ] Task 0.2 is documentation and review, not runtime implementation.
  - [ ] Existing Phase 1-5 behavior should stay unchanged while touchpoints are mapped.
- Solution understanding:
  - [ ] `docs/phase-6/app-touchpoints.md` documents current routes, providers, services, joined nurse access, request flow, active shift saves, likely future files, and compatibility risks.
  - [ ] `docs/phase-6/tasks.md` now marks only Task 0.2 done in addition to the already done Task 0.1.
  - [ ] No app runtime code was changed for this setup step.
  - [ ] Realtime connection state is planned as foreground UI/provider state, not saved active-shift data.
- Broader context:
  - [ ] The touchpoint map protects later Phase 6 tasks from spreading Supabase calls across screens.
  - [ ] Invite work can build on the existing join shell and joined nurse workspace without exposing the full charge board.
  - [ ] Push notifications, offline queues, conflict handling, drag-and-drop, board sharing, tablet layout, and AI remain out of scope.
- Verification:
  - [x] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-20 - Plan Phase 6 Realtime Collaboration and Nurse Invites

- Task: Create Phase 6 planning docs for realtime collaboration, nurse invite links, deep link joining, and live nurse-scoped shift participation.
- Problem understanding:
  - [ ] Phase 6 should follow `docs/phases.md`, where Phase 6 is Realtime Collaboration and Nurse Invites.
  - [ ] The AGENTS summary has an older-looking Phase 6 note for push/offline, but push notifications and offline resilience belong to Phase 7 in `docs/phases.md`.
  - [ ] Realtime should make server-backed active shifts update across devices without adding push notifications or offline write queues.
- Solution understanding:
  - [ ] `docs/phase-6/user-stories.md` defines realtime, invite, join, live nurse view, live request, regeneration, and compatibility stories.
  - [ ] `docs/phase-6/data-model.md` documents invite records, shift nurse access updates, realtime subscription scopes, and connection state.
  - [ ] `docs/phase-6/mobile-design.md` documents phone-first live status, invite management, join gate, joined nurse, and live request UI.
  - [ ] `docs/phase-6/screens.md` maps the Phase 6 screens and safe recovery states.
  - [ ] `docs/phase-6/tasks.md` orders small implementation tasks and marks only planning Task 0.1 done.
- Broader context:
  - [ ] Phase 6 connects the Phase 5 server-backed app to live multi-device use.
  - [ ] Joined nurse access stays nurse-scoped and does not expose the full charge nurse board.
  - [ ] Push notifications, offline queues, drag-and-drop, board sharing, tablet layout, and AI remain deferred.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Complete Phase 5 Manual Test Pass

- Task: Complete Phase 5 Tasks 6.1 through 6.7 by validating the auth, server template, active shift, role boundary, previous-phase compatibility, scope, and readability pass without adding new feature behavior.
- Problem understanding:
  - [ ] Task 6.x is a validation and readability pass, not a new feature build.
  - [ ] Manual-test tasks should verify the Phase 5 flow while preserving previous Phase 1-4 behavior.
  - [ ] Future-phase features such as realtime, invite links, push notifications, offline queues, drag-and-drop, tablet layout, and AI must stay out of this pass.
- Solution understanding:
  - [ ] `docs/phase-5/tasks.md` now marks only Tasks 6.1 through 6.7 done.
  - [ ] `src/services/README.md` now describes the current Phase 5 service boundaries for auth, profiles, Supabase client setup, and server workspace persistence.
  - [ ] No runtime feature code changed.
  - [ ] Validation covered TypeScript, lint, web export, server-backed code paths, and scope searches.
- Broader context:
  - [ ] This closes the Phase 5 task list without jumping into Phase 6 collaboration or invite behavior.
  - [ ] The service boundary docs make it easier to explain where backend code belongs.
  - [ ] The app remains account-backed through normal request/response server persistence.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Enable Floor Template Deletion

- Task: Make Home floor-template swipe delete available and actually remove the saved server template after confirmation.
- Problem understanding:
  - [ ] Home was passing `canDelete={false}`, so templates were never wrapped in the swipe-delete component.
  - [ ] The confirm handler only closed the dialog and did not delete anything.
  - [ ] Supabase also needs an explicit delete RLS policy for template deletion.
- Solution understanding:
  - [ ] `serverWorkspaceRepository` deletes an owned `floor_templates` row by template id and owner id.
  - [ ] `ServerWorkspaceContext` exposes `deleteFloorTemplate` and refreshes the workspace after delete.
  - [ ] `HomeScreen` enables swipe delete only when no active shift is running.
- Broader context:
  - [ ] Deleting templates stays server-backed and account-scoped.
  - [ ] Active shifts are protected from losing the template they were started from.
  - [ ] Old carry-over snapshots for that template are cleaned up by the schema cascade.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-20 - Align Floor Template Meta Chips

- Task: Keep the room and bed chips aligned on one row in Home floor-template cards when there is enough width.
- Problem understanding:
  - [ ] The template title area was allowed to size differently per row.
  - [ ] Longer names could leave the room and bed chips with less measured space.
  - [ ] The result looked uneven because one card showed chips side by side and another stacked them.
- Solution understanding:
  - [ ] `HomeScreen` now lets the left text area shrink predictably with `minWidth: 0`.
  - [ ] The right action area stays fixed with `flexShrink: 0`.
  - [ ] The meta chip row no longer wraps in normal card width.
- Broader context:
  - [ ] This is a presentation-only fix.
  - [ ] Saved templates, shift start, and navigation behavior are unchanged.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Preserve Pending Carry-Over On Resume

- Task: Fix Home resume so an active setup shift returns to carry-over review until that review has been completed.
- Problem understanding:
  - [ ] A setup shift can exist before carry-over review is finished.
  - [ ] Home previously resumed every setup shift to Start Shift.
  - [ ] Always showing carry-over would repeat the review even after the user completed it.
- Solution understanding:
  - [ ] `Shift` now has optional `carryOverReviewedAt`.
  - [ ] `CarryOverReviewScreen` sets `carryOverReviewedAt` when Continue is pressed.
  - [ ] `HomeScreen` routes Resume to carry-over when a matching previous snapshot exists and `carryOverReviewedAt` is still missing.
- Broader context:
  - [ ] Carry-over review becomes a resumable setup step.
  - [ ] Completed carry-over review does not keep interrupting normal setup resume.
  - [ ] This stays inside server-backed active-shift persistence.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Fix Carry-Over Patient Bed Matching

- Task: Fix carry-over patient suggestions so they can still apply when the new active shift has a matching bed label but not the exact previous bed id.
- Problem understanding:
  - [ ] Carry-over snapshots store `previousBedId` and `previousBedLabel`.
  - [ ] Exact bed-id matching can fail after server-backed template/save cycles.
  - [ ] Matching across the same floor template should still be safe when the bed label exists.
- Solution understanding:
  - [ ] `src/screens/CarryOverReviewScreen.tsx` now finds the target bed by id first.
  - [ ] If the id no longer exists, it falls back to `previousBedLabel`.
  - [ ] Patient suggestions without a matching id or label stay filtered out.
- Broader context:
  - [ ] Nurse carry-over is unaffected because nurse suggestions create new nurse rows.
  - [ ] Patient carry-over remains tied to beds on the current active shift.
  - [ ] This preserves Phase 5 scope and does not add sync/realtime behavior.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Refactor Workspace Reads Out Of Local State

- Task: Refactor Phase 5 workspace screens so server-backed templates, active shifts, previous-shift snapshots, flags, requests, and breaks are read from `ServerWorkspaceContext` instead of a copied `LocalStateContext`.
- Problem understanding:
  - [ ] Copying server workspace snapshots into global local state made the source of truth harder to explain.
  - [ ] Saved server data and unsaved UI drafts need different homes.
  - [ ] Some screens still need temporary edits before submit, but those edits do not need global app state.
- Solution understanding:
  - [ ] `src/store/ServerWorkspaceContext.tsx` now exposes `floorTemplates`, `activeShift`, and `previousShiftSnapshots` directly.
  - [ ] `src/store/WorkflowDraftContext.tsx` owns only `draftFloorTemplate` and simulated nurse testing state.
  - [ ] `src/hooks/useActiveShiftDraft.ts` gives setup screens a screen-local active-shift draft before they call `saveActiveShift`.
  - [ ] `src/store/LocalStateContext.tsx` and the old local storage service files are removed.
  - [ ] Screens no longer import `useLocalState`.
- Broader context:
  - [ ] Server workspace data is clearer as the saved truth.
  - [ ] Unsaved form edits stay local to the screen or draft-only context.
  - [ ] This remains Phase 5 server persistence cleanup and does not add future collaboration features.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-20 - Remove Local App-State Persistence

- Task: Complete Phase 5 Tasks 5.1 and 5.2 by removing the old durable local app-state path and reviewing previous workflow compatibility against server-backed state.
- Problem understanding:
  - [x] Phase 5 server persistence should not restore templates, active shifts, carry-over snapshots, requests, or breaks from old device-local app data.
  - [x] `LocalStateContext` was still loading and saving the old `nurseflow.localAppState.v1` data path.
  - [x] Previous Phase 1-4 screens still need an in-memory working copy so their forms and setup flow remain usable.
- Solution understanding:
  - [x] `src/store/ServerWorkspaceContext.tsx` exposes server-backed workspace snapshots directly.
  - [x] `src/store/WorkflowDraftContext.tsx` keeps only unsaved floor-template draft state and simulated nurse testing state.
  - [x] `src/services/storageRepository.ts` and `src/services/localStorageAdapters.ts` were removed from the runtime path.
  - [x] `src/screens/HomeScreen.tsx` no longer writes a previous-shift snapshot to local storage after saving carry-over to the server.
  - [x] `package.json` no longer lists `expo-file-system` as a direct dependency for app-state persistence.
- Broader context:
  - [x] Account data now restores from Supabase session plus server workspace records, not from old Phase 1-4 local test data.
  - [x] Temporary form state can still be local before submit, but saved truth belongs to the server.
  - [x] This stays inside Phase 5 and does not add realtime, invite links, deep links, push notifications, offline queues, drag-and-drop, tablet layout, or AI.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-19 - Add Join Active Session Screen Shell

- Task: Add a Home entry and placeholder screen for the future nurse-code join flow without implementing code verification.
- Problem understanding:
  - [ ] Users need to see where joining an active shift will happen.
  - [ ] The app should not imply join codes already work.
  - [ ] Existing active participation guardrails should still prevent conflicting shift contexts.
- Solution understanding:
  - [ ] `src/app/join-active-session.tsx` adds the route.
  - [ ] `src/screens/JoinActiveSessionScreen.tsx` shows disabled code entry and disabled join action.
  - [ ] `src/screens/HomeScreen.tsx` links to the shell and blocks navigation when the account is already in an active shift context.
- Broader context:
  - [ ] A later task can wire this screen to real code verification and `shift_nurse_access` creation.
  - [ ] The shell keeps the next workflow visible without adding invite links, deep links, realtime, push notifications, or full join behavior.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-19 - Treat Nurse Access As Shift Participation

- Task: Update Phase 5 role/access direction so every signed-in profile is charge-capable, while regular nurse behavior comes from joined shift access.
- Problem understanding:
  - [ ] Permanent `regular_nurse` profile roles made manual testing and linking harder to understand.
  - [ ] A nurse joining a shift should not change the account's global identity.
  - [ ] One account should not start or join multiple active shift contexts at the same time.
- Solution understanding:
  - [ ] `UserRole` is now only `charge_nurse` for Phase 5 profiles.
  - [ ] `SessionGate` sends signed-in users to Home rather than routing by regular-nurse profile role.
  - [ ] `ServerWorkspaceContext` owns joined nurse assignment loading, retry, and active participation state.
  - [ ] `ServerWorkspaceContext` blocks joined nurse access when the account already owns an active charge shift.
  - [ ] `ServerWorkspaceContext` blocks starting a charge shift when the account is already joined to another shift as a nurse.
  - [ ] Joined nurse assignment loading uses `shift_nurse_access` and `get_joined_nurse_assignment_view()`.
  - [ ] Phase 5 docs describe future `Join active session` code entry without implementing it yet.
- Broader context:
  - [ ] Join-code behavior can later create `shift_nurse_access` records.
  - [ ] Joined nurse access remains nurse-scoped and does not expose the full charge nurse board.
  - [ ] The one-active-participation rule prevents one account from being in conflicting active shift contexts.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-19 - Add Role Boundaries And Authorization Checks

- Task: Complete Phase 5 Tasks 4.1, 4.2, 4.3, and 4.4 by keeping accounts charge-capable, adding joined nurse empty/linked states, documenting shift nurse access records, and adding nurse-scoped server reads.
- Problem understanding:
  - [x] Regular nurse accounts needed a real boundary so they could not open charge nurse workspace screens.
  - [x] A signed-in profile alone should not expose nurse-scoped shift data; it needs a linked access record.
  - [x] UI routing is not enough protection, so server ownership and nurse-scoped reads also matter.
- Solution understanding:
  - [x] `src/components/SessionGate.tsx` routes signed-in users to Home rather than treating nurse access as a permanent profile role.
  - [x] `src/screens/RegularNurseWorkspaceScreen.tsx` shows loading, `No shift access yet`, linked assignment, and error states for joined nurse access.
  - [x] `src/services/serverWorkspaceRepository.ts` keeps charge nurse workspace reads owner-scoped and loads joined nurse assignment data through a reduced server RPC.
  - [x] `docs/phase-5/supabase-auth-setup.md` documents the `shift_nurse_access` table and `get_joined_nurse_assignment_view()` RPC for manual testing.
  - [x] No invite links, deep links, realtime, push notifications, offline queues, drag-and-drop, tablet layout, or AI were added.
- Broader context:
  - [x] Shift access boundaries prepare NurseFlow for later collaboration without exposing the full charge nurse board to joined nurses.
  - [x] Charge nurse templates, shifts, and snapshots remain owned by the signed-in charge nurse profile.
  - [x] Later invite/join behavior can create access records, but this task only proves the authorization shape.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-19 - Save Previous-Shift Snapshot to Server

- Task: Complete Phase 5 Task 3.4 by saving carry-over nurse and patient suggestions to Supabase when a shift ends.
- Problem understanding:
  - [ ] Ending a server shift no longer restored the active shift, but carry-over suggestions were still only local.
  - [ ] Reloading from the server could lose nurse and patient suggestions for the next shift.
  - [ ] Request history and break schedules should not become carry-over data.
- Solution understanding:
  - [ ] `src/services/serverWorkspaceRepository.ts` now saves one previous-shift snapshot per floor template by replacing the older server snapshot.
  - [ ] `src/store/ServerWorkspaceContext.tsx` exposes a server previous-shift snapshot save function.
  - [ ] `src/screens/HomeScreen.tsx` saves the server carry-over snapshot before ending the active shift.
  - [ ] Empty snapshots remove the older server snapshot instead of keeping stale suggestions.
  - [ ] `docs/phase-5/supabase-auth-setup.md` documents the previous-snapshot insert and delete policies.
- Broader context:
  - [ ] Carry-over suggestions now follow the signed-in account instead of depending only on device-local state.
  - [ ] The change stays within Phase 5 server persistence and does not add realtime, invites, push notifications, offline queues, drag-and-drop, tablet layout, or AI.
  - [ ] Later role and authorization work can keep using the repository/provider boundary.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-19 - Add Server Active Shift Persistence

- Task: Complete Phase 5 Tasks 3.1, 3.2, 3.2a, and 3.3 by starting active shifts from server templates, saving active-shift changes to Supabase, refreshing after saves, and restoring the server active shift after session restore.
- Problem understanding:
  - [ ] Active shifts were still mostly local after server floor templates were added.
  - [ ] Screens could move forward using in-memory nurses, patients, assignments, requests, or breaks even if the server had not saved them.
  - [ ] App startup could load old device state near the same time as server workspace state, so the restore order needed to be explicit.
- Solution understanding:
  - [ ] `src/services/serverWorkspaceRepository.ts` now creates and updates `active_shifts` rows with the full active-shift snapshot.
  - [ ] `src/store/ServerWorkspaceContext.tsx` owns the save-then-refresh pattern for starting and saving active shifts.
  - [ ] Setup, nurse, patient, assignment, carry-over, request, and break screens call the server save before relying on the next screen or restored data.
  - [ ] `src/store/LocalStateContext.tsx` exposes local-load completion so the server workspace can hydrate after device state loads.
  - [ ] The Supabase setup docs now include active-shift insert and update RLS policies.
- Broader context:
  - [ ] The active shift is now the server-backed source for Phase 1-4 workflow data during Phase 5.
  - [ ] This keeps the implementation request/response based and does not add realtime, invite links, push notifications, offline queues, drag-and-drop, tablet layout, or AI.
  - [ ] Later previous-shift and role/authorization tasks can build on the same repository/provider boundary.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-17 - Replace Deprecated Supabase Returns Helper

- Task: Replace deprecated Supabase `.returns<T>()` list query typing in the server workspace repository.
- Problem understanding:
  - [x] Supabase marked `.returns<T>()` deprecated, so the IDE showed a deprecation warning.
  - [x] The warning was about TypeScript result typing, not a runtime database behavior problem.
  - [x] The list queries still need typed rows so mapper functions receive the expected shape.
- Solution understanding:
  - [x] `src/services/serverWorkspaceRepository.ts` now uses `.overrideTypes<T>()` for list query result types.
  - [x] The fetched columns, table names, filters, and mapper functions stayed the same.
  - [x] Single-row calls were left alone because the warning was from `.returns<T>()`.
- Broader context:
  - [x] Keeping SDK usage current prevents warning noise while preserving the beginner-readable repository boundary.
  - [x] This is a type cleanup only and does not change floor template or workspace loading behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-17 - Add Shared Retryable Error State Component

- Task: Create one reusable retryable error component and replace Home's server workspace error block with it.
- Problem understanding:
  - [x] Home had a one-off retryable error layout that would likely be repeated by later server screens.
  - [x] Repeated error blocks can drift in spacing, retry button style, and accessibility behavior.
  - [x] The generic component should own the layout, while each screen still provides the specific title, message, and retry action.
- Solution understanding:
  - [x] `src/components/ErrorState.tsx` owns the shared title, message, optional retry button, and error styling.
  - [x] `src/screens/HomeScreen.tsx` now renders `ErrorState` for server load failures.
  - [x] The component is generic and does not know about Supabase, templates, or workspaces.
- Broader context:
  - [x] Future Phase 5 server screens can reuse the same retryable error pattern.
  - [x] This is a UI refactor only and does not change server loading, saving, or retry behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-17 - Add Shared Loading State Component

- Task: Create one reusable loading component and replace the direct loading spinners in session routing, auth submit, and Home's server load state.
- Problem understanding:
  - [x] Multiple screens were hand-rendering loading UI, which makes copy, spacing, color, and accessibility easier to drift.
  - [x] A shared loading component should stay generic and not know about auth, templates, or workspace data.
  - [x] Button loading and card loading need slightly different layout while sharing the same primitive.
- Solution understanding:
  - [x] `src/components/LoadingState.tsx` owns the shared spinner/message UI.
  - [x] `variant="card"` is used for full or section loading states.
  - [x] `variant="inline"` with `showMessage={false}` is used inside the auth submit button.
  - [x] `src/screens/HomeScreen.tsx`, `src/screens/SessionGateScreens.tsx`, and `src/screens/AuthFormScreen.tsx` no longer import `ActivityIndicator` directly.
- Broader context:
  - [x] Future Phase 5 loading states can reuse this component instead of inventing new spinner layouts.
  - [x] The refactor changes presentation only and does not change auth, server loading, or template save behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-17 - Add Server Workspace Loader And Template Save

- Task: Complete Phase 5 Tasks 2.1, 2.2, and 2.3 by loading the charge nurse server workspace, saving reusable floor templates to Supabase, and showing the server template list/empty/error states.
- Problem understanding:
  - [x] The charge nurse workspace still showed local-only templates and did not load account-owned server templates.
  - [x] Template save needed to move from device storage to the server without storing patients, nurses, assignments, requests, or breaks on the reusable template.
  - [x] Regular nurse accounts should not load or manage charge nurse templates.
- Solution understanding:
  - [x] `src/services/serverWorkspaceRepository.ts` owns Supabase reads and writes for workspace data and floor templates.
  - [x] `src/store/ServerWorkspaceContext.tsx` provides one server workspace boundary with loading, empty, error, retry, save, and save-error state.
  - [x] `src/screens/HomeScreen.tsx` shows server workspace loading, retry, template list, and empty states while keeping active-shift helpers local for now.
  - [x] `src/screens/TemplateReviewScreen.tsx` saves reusable template structure to the server and updates in-memory state with the fetched backend record.
  - [x] `docs/phase-5/supabase-auth-setup.md` documents the minimal workspace tables and RLS policies for manual testing.
- Broader context:
  - [x] This starts server persistence for reusable floor templates without adding active-shift save, realtime, invite links, push notifications, offline queues, drag-and-drop, tablet layout, or AI.
  - [x] Future active-shift persistence can reuse the same request-then-refresh pattern.
  - [x] Existing local-only helpers are preserved until the specific later tasks replace those save paths.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-16 - Add Signup Login Session Restore And Sign Out

- Task: Add Phase 5 auth actions for charge nurse signup, email/password login, session restore, and local-session sign out.
- Problem understanding:
  - [ ] The session gate existed, but users could not yet create an account, sign in, or sign out.
  - [ ] Supabase Auth users need a matching NurseFlow `profiles` row before the app can route by role.
  - [ ] The app should restore saved sessions without storing raw passwords or secret keys.
- Solution understanding:
  - [ ] `src/services/authRepository.ts` owns signup, login, profile creation, and local sign out calls.
  - [ ] `src/services/profileRepository.ts` can create or load a `profiles` row.
  - [ ] `src/screens/AuthFormScreen.tsx` provides beginner-friendly signup and login forms with validation, loading, and error states.
  - [ ] `src/store/AuthSessionContext.tsx` exposes `signOut()` and still restores sessions through SecureStore-backed Supabase auth.
  - [ ] Charge and regular nurse workspace screens now include sign-out actions.
  - [ ] `docs/phase-5/supabase-auth-setup.md` documents the minimal profile table and RLS policies needed for manual testing.
- Broader context:
  - [ ] This completes the first account loop before server floor templates, active shifts, previous-shift snapshots, realtime, invite links, push notifications, offline queues, or AI.
  - [ ] Future server persistence tasks can rely on the signed-in profile and role.
  - [ ] Signup defaults to `charge_nurse`; regular-nurse linking and invite behavior remain later work.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-16 - Add Phase 5 Auth Types And Session Gate

- Task: Add auth/profile/save-status types, Supabase secure session setup, and a root session gate for signed-out, charge nurse, regular nurse, setup-error, and recovery states.
- Problem understanding:
  - [ ] Phase 5 needs real account/session state before adding signup, login, or server persistence.
  - [ ] Auth/session state should not be mixed into local active-shift state.
  - [ ] Native auth tokens need secure storage instead of plain local app storage.
- Solution understanding:
  - [ ] `src/types/models.ts` now defines `AuthStatus`, `UserRole`, `ServerSaveStatus`, `UserProfile`, and `AuthSessionState`.
  - [ ] `src/services/supabaseClient.ts` creates the Supabase client only when public config exists and uses Expo SecureStore on native platforms.
  - [ ] `src/store/AuthSessionContext.tsx` checks the saved session, loads the user profile, and returns safe setup or recovery states when needed.
  - [ ] `src/components/SessionGate.tsx` routes signed-out users to Login, charge nurses to `/`, and regular nurses to `/regular-nurse-workspace`.
  - [ ] Login and regular nurse screens are intentionally minimal because signup, password login, and nurse access linking are later tasks.
- Broader context:
  - [ ] This creates the front door for Phase 5 account work without changing Phase 1-4 floor setup, assignment, requests, or break scheduling.
  - [ ] Future signup/login tasks can plug into the session provider instead of inventing their own account state.
  - [ ] Future server persistence tasks can rely on `UserProfile.role` for workspace boundaries.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-13 - Confirm Phase 5 App Touchpoints

- Task: Map the existing routes, screens, state, storage, and helper files before writing Phase 5 feature code.
- Problem understanding:
  - [ ] Phase 5 should not add backend code before identifying the current app boundaries.
  - [ ] Real auth/session state must stay separate from local app state and simulated nurse role state.
  - [ ] Existing local persistence should be removed from Phase 5 runtime flows once server-backed replacements exist.
- Solution understanding:
  - [ ] `docs/phase-5/app-touchpoints.md` documents current routes, state, storage, helpers, and future Phase 5 touchpoints.
  - [ ] Auth/session state should likely live in a new provider near `src/app/_layout.tsx`, not inside individual screens.
  - [ ] Server repository helpers should likely live in `src/services` so screens do not call Supabase directly.
  - [ ] Current local persistence paths are `saveFloorTemplates`, active-shift saving, and `savePreviousShiftSnapshot`.
  - [ ] The old `nurseflow.localAppState.v1` testing data does not need to be imported.
- Broader context:
  - [ ] This protects Phase 1-4 behavior while preparing for server-backed accounts.
  - [ ] It makes the likely implementation files explainable before auth code starts.
  - [ ] Task 0.3 is documentation-only and does not add backend, auth, realtime, invite, deep link, push, offline, drag-and-drop, tablet, or AI behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] File-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-13 - Choose Phase 5 Backend Approach

- Task: Choose and document the Phase 5 backend approach without adding app implementation code.
- Problem understanding:
  - [ ] Phase 5 needs a backend choice before auth, profile, template, or shift persistence code is written.
  - [ ] The backend must cover email/password auth and server persistence without pulling in later realtime or invite behavior.
  - [ ] Provider features should be selected by phase scope, not enabled just because they exist.
- Solution understanding:
  - [ ] `docs/phase-5/backend-decision.md` chooses Supabase Auth and Supabase Postgres.
  - [ ] The decision uses only client-safe Expo environment variables: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  - [ ] The task list now carries secure session storage into Task 1.2 and Task 1.5 so the auth implementation cannot skip it.
  - [ ] Supabase Realtime, Broadcast, Presence, nurse invite links, deep links, push notifications, and offline queues are deferred.
  - [ ] Normal backend records use one `id` field, and old local storage data should not remain as a second source of truth.
  - [ ] `docs/phase-5/tasks.md` marks only Task 0.2 done.
- Broader context:
  - [ ] This sets the provider boundary for upcoming auth/session and server persistence tasks.
  - [ ] Row Level Security will matter later for charge nurse ownership and regular nurse scoped access.
  - [ ] No current Phase 1-4 app behavior changes because this task is documentation-only.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [ ] File-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-13 - Plan Phase 5 Backend Auth And Server Persistence

- Task: Create Phase 5 planning docs for backend, auth, and server-side persistence.
- Problem understanding:
  - [ ] Phase 5 should follow `docs/phases.md`, where Phase 5 is Backend, Auth, and Server Persistence.
  - [ ] The older phase summary in `AGENTS.md` differs from `docs/phases.md`, so `docs/phases.md` is the source used for this phase plan.
  - [ ] Realtime collaboration, nurse invite links, deep links, push notifications, offline sync, drag-and-drop, tablet layout, and AI belong to later phases.
- Solution understanding:
  - [ ] `docs/phase-5/user-stories.md` defines account, server persistence, role, authorization, and compatibility stories.
  - [ ] `docs/phase-5/data-model.md` documents backend-owned `id` fields for profiles, templates, active shifts, snapshots, and nurse access records, and says old local storage state should be removed from Phase 5 runtime flows.
  - [ ] `docs/phase-5/mobile-design.md` documents account-backed UI direction without realtime or invite-link language.
  - [ ] `docs/phase-5/screens.md` maps the auth, workspace, existing workflow, regular nurse, and recovery screens.
  - [ ] `docs/phase-5/tasks.md` orders small future implementation tasks with manual validation checks and marks only planning Task 0.1 done.
- Broader context:
  - [ ] Phase 5 is the bridge from local workflows to server-backed accounts.
  - [ ] The active shift remains the main source of truth for assignment, requests, and break scheduling.
  - [ ] Role boundaries prepare the app for Phase 6 collaboration without implementing Phase 6 early.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] File-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Show Floor Name in Breaks and Flags Screen Headers

- Task: Update the headers on the Breaks and Flags and requests screens to display the active floor name instead of static screen titles.
- Problem understanding:
  - [ ] Navigating between the Floor Board, Breaks, and Flags screens caused the header to switch between the active floor name (on Floor Board) and generic titles ("Breaks", "Flags and requests").
  - [ ] The header should consistently reference the active floor name across all three board sub-views to keep the context stable.
  - [ ] If no active floor name exists (e.g. shift not started or template not selected), it should fall back to generic page names.
- Solution understanding:
  - [ ] `src/screens/BreakScheduleScreen.tsx` sets `title={activeShift?.floorName ?? "Breaks"}` with `subtitle=""` on `WorkflowScreen`.
  - [ ] `src/screens/FlagsScreen.tsx` sets `title={localState.activeShift?.floorName ?? "Flags and requests"}` with `subtitle=""` on `WorkflowListScreen`.
- Broader context:
  - [ ] This maintains visual consistency across the Floor Board sub-views (Board, Breaks, Flags).
  - [ ] It aligns with the user's preference of displaying only the floor name in the title, without a subtitle, when the sub-tab bar already clarifies the current view.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Polish Board Workload And Flags UI

- Task: Restyle the nurse workload cards and Flags filter/header area.
- Problem understanding:
  - [ ] Nurse workload cards had too many pill-like badges and felt cramped.
  - [ ] Flags used three separate filter cards, which made the page feel heavier than the content.
  - [ ] The UI needed clearer grouping without changing filter behavior or board data.
- Solution understanding:
  - [ ] `src/screens/FloorBoardScreen.tsx` now shows workload coverage and break status with quieter text and inset rows.
  - [ ] `src/screens/FlagsScreen.tsx` renders a dynamic summary card: when 'Flags' is selected, it shows the assignment flag count and critical/warning/info breakdown; when 'Requests' is selected, it shows the nurse request count and pending/accepted/declined breakdown.
  - [ ] A top-level Segmented Control toggles the view between `Flags` (assignment flags) and `Requests` (nurse requests) to prevent stacking.
  - [ ] Selecting a tab displays only the list items and the filter controls (using the new full-width iOS-style `SegmentedControl` component) relevant to that selection, reducing the stacked filter rows to a single row (for Flags) or two rows (for Requests).
  - [ ] Summary card badges display their own respective totals (e.g., total flags count on the Flags summary card and total requests count on the Requests summary card) rather than cross-referencing the other tab's count, preventing label confusion.
- Broader context:
  - [ ] Board sub-tabs now feel more consistent with each other.
  - [ ] The change is visual only and preserves assignment flags, local requests, and filters.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Polish Break Entries And Warnings

- Task: Restyle Breaks tab entry rows and warning rows so they are easier to scan.
- Problem understanding:
  - [ ] Break entry cards looked like raw data boxes instead of a schedule list.
  - [ ] Warning cards used too much amber fill and felt more alarming than necessary.
  - [ ] The UI needed visual hierarchy without changing local scheduling behavior.
- Solution understanding:
  - [ ] `src/screens/BreakScheduleScreen.tsx` keeps the same break entry and warning data.
  - [ ] Break entry rows now show nurse/time first, compact nurse metadata, coverage, and a subtle review note.
  - [ ] Warning rows now use a lighter surface with an amber left accent and context chips.
- Broader context:
  - [ ] This keeps the Breaks tab useful as a board sub-view rather than a noisy report screen.
  - [ ] The change is presentation-only and does not alter generated break times or warning rules.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Add Board Bottom Sub-Tabs

- Task: Add a board-context bottom tab bar for `Board`, `Breaks`, and `Flags`.
- Problem understanding:
  - [ ] Breaks and flags felt disconnected when they lived behind separate action buttons.
  - [ ] A bottom sub-tab pattern makes these views feel like sibling parts of the active board.
  - [ ] A full nested navigation refactor would be larger than needed for this UI pass.
- Solution understanding:
  - [ ] `src/components/workflow/BoardSubTabBar.tsx` defines the reusable bottom tab bar and its three routes.
  - [ ] `WorkflowScreen` and `WorkflowListScreen` accept an optional `bottomAccessory`.
  - [ ] Floor Board, Break Schedule, and Flags each render the same tab bar with their own active tab.
  - [ ] Board and Flags no longer need duplicate primary buttons for moving between each other.
- Broader context:
  - [ ] This keeps the charge nurse's board context stable while preserving existing routes and screen code.
  - [ ] Future board-adjacent views can reuse the same pattern if they belong in this local board context.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Refine Breaks Tab UI

- Task: Replace the Breaks summary tile grid and bottom `Refresh breaks` CTA with a cleaner summary card.
- Problem understanding:
  - [ ] The old Break summary repeated the same raised-tile pattern that made the Board summary hard to scan.
  - [ ] A large bottom `Refresh breaks` button competed with the Board/Breaks/Flags sub-tab bar.
  - [ ] Refresh should be available only when it is useful, not always shown as the main screen action.
- Solution understanding:
  - [ ] `src/screens/BreakScheduleScreen.tsx` now renders `BreakSummaryCard` instead of `SummaryTileGrid`.
  - [ ] Refresh moved into a compact inline pill that appears only when the schedule needs refresh and can be refreshed.
  - [ ] The redundant local schedule/back card was removed because the bottom Board tab handles navigation back.
- Broader context:
  - [ ] The Breaks tab now behaves like a board sub-view instead of a separate workflow screen with its own big CTA.
  - [ ] The underlying local refresh logic still replaces only `activeShift.breakSchedule`.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-12 - Refine Floor Board Summary UI

- Task: Make the Floor Board summary easier to scan and remove the confusing `Break scheduled` pill from the summary area.
- Problem understanding:
  - [ ] The old summary looked busy because every fact was shown as an equal raised tile.
  - [ ] `Break scheduled` did not help as a board-summary metric because Breaks now has its own board sub-tab.
  - [ ] Break warnings still need visibility because they represent something the charge nurse may need to review.
- Solution understanding:
  - [ ] `src/screens/FloorBoardScreen.tsx` now uses `BoardSummaryCard` for census, flags, admitting side, activity, and shift start.
  - [ ] The redundant Break schedule card was removed from the Board tab.
  - [ ] Break warning count stays visible as a warning strip or warning badge when warnings exist.
- Broader context:
  - [ ] This keeps the Floor Board focused on charge nurse scanning instead of treating every status as a KPI.
  - [ ] The change is visual and local-only; it does not regenerate breaks or change assignment logic.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-11 - Run Phase 4 Manual Test Pass

- Task: Work through Phase 4 `7.x` validation tasks without adding feature code.
- Problem understanding:
  - [ ] The `7.x` tasks are validation tasks, not new behavior tasks.
  - [ ] Some checks require hands-on app interaction with realistic shift data.
  - [ ] Task 7.1 no longer matches the current automatic-start/derived-activity implementation.
- Solution understanding:
  - [ ] `docs/phase-4/manual-test-pass.md` records what passed automatically, what needs manual click-through, and why.
  - [ ] `docs/phase-4/tasks.md` marks only 7.7 and 7.8 done because those were completed by code review.
  - [ ] TypeScript, lint, Expo export, and local-only scope scans provide non-interactive evidence, not full manual acceptance.
- Broader context:
  - [ ] This protects Phase 4 from accidental backend/auth/realtime/push/offline/AI scope creep.
  - [ ] The remaining manual checks should be completed in the running app before claiming all 7.x tasks are done.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-11 - Show Nurse's Own Break

- Task: Complete Phase 4 Tasks 6.1 and 6.2 only.
- Problem understanding:
  - [ ] The simulated nurse view should show only the selected nurse's break, not the full charge nurse schedule.
  - [ ] A nurse-specific warning should appear only when that selected nurse has break warning context.
  - [ ] Missing schedules and stale nurse entries need safe local display states.
- Solution understanding:
  - [ ] `src/screens/SimulatedNurseAssignmentScreen.tsx` uses `getNurseBreakView` with the selected nurse id.
  - [ ] The Break summary section shows `Break HH:MM`, `Break not scheduled yet.`, or `No break assigned for this nurse yet.`
  - [ ] The warning message comes from the selected nurse's filtered break warnings, not all schedule warnings.
  - [ ] Existing assigned beds, room coverage, issue history, and swap history stay unchanged.
- Broader context:
  - [ ] This completes the Phase 4 nurse-facing local break visibility without adding real accounts, invites, push notifications, realtime sync, or backend behavior.
  - [ ] Later manual testing can verify that Nurse A and Nurse B each see only their own break information.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-11 - Add Floor Board Break Integration

- Task: Complete Phase 4 Tasks 5.1, 5.2, and 5.3 only.
- Problem understanding:
  - [ ] The Floor Board needs a clear way to open Break Schedule after assignment is ready.
  - [ ] Nurse workload cards should show break timing without hiding load, room coverage, or flags.
  - [ ] Board summary should show whether breaks are scheduled, stale, or not scheduled.
- Solution understanding:
  - [ ] `src/screens/BreakScheduleScreen.tsx` owns break status, entries, warnings, and inline refresh behavior.
  - [ ] The Board tab links to Breaks through the board bottom sub-tab instead of a repeated card.
  - [ ] Nurse workload cards use saved break entries to show `Break HH:MM`, `Break not scheduled`, and `Break warning`.
  - [ ] Break schedule status is communicated in the Breaks sub-tab, while the Board summary stays focused on board facts and warning counts.
- Broader context:
  - [ ] The Floor Board now summarizes break state without regenerating schedules itself.
  - [ ] Existing assignment flags, acuity, load, max load, room coverage, and local nurse simulation behavior are preserved.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-11 - Review Generated Break Schedule

- Task: Complete Phase 4 Tasks 4.1, 4.2, and 4.3 only.
- Problem understanding:
  - [ ] Charge nurses need to review generated break entries after assignment creates them.
  - [ ] Break warnings should stay separate from assignment flags and local nurse requests.
  - [ ] A generated schedule can become stale after nurse or assignment changes, so refresh should be explicit.
- Solution understanding:
  - [ ] `src/screens/BreakScheduleScreen.tsx` sorts generated entries by `startTime`.
  - [ ] Break entry rows resolve current nurse, doctor side, and room labels safely while falling back for stale nurse references.
  - [ ] Break warning rows show affected nurses, doctor sides, and rooms without changing the Flags flow.
  - [ ] `Refresh breaks` replaces only `activeShift.breakSchedule` by using the latest active shift and assignment result.
- Broader context:
  - [ ] This keeps Phase 4 local-only and avoids backend, auth, realtime, notifications, drag-and-drop, tablet, or AI work.
  - [ ] Later Floor Board and simulated nurse tasks can link to or summarize the same saved schedule without changing generation.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-10 - Generate Local Break Schedule

- Task: Complete Phase 4 Tasks 3.1, 3.2, 3.3, and 3.4 only.
- Problem understanding:
  - [x] Break generation should happen from the local assignment snapshot, not from a separate backend or AI service.
  - [ ] The first version needs deterministic break slots and simple safety warnings, not a complex scheduler.
  - [ ] The generated schedule should not change beds, patients, assignment results, local nurse requests, templates, or previous-shift snapshots.
- Solution understanding:
  - [ ] `src/utils/breakSchedule.ts` derives staggered slots from shift start time, nurse count, and floor activity.
  - [ ] The helper creates one local break entry per nurse with covered rooms, doctor sides, and warning links.
  - [ ] The helper adds local warnings for fully overlapping room coverage and limited experienced-nurse coverage.
  - [ ] `src/screens/AssignmentReviewScreen.tsx` saves the generated break schedule when local assignment runs.
- Broader context:
  - [ ] Later tasks can display the saved entries and warnings without changing the generation rule.
  - [ ] The schedule remains local, serializable, and tied to the active shift.
- Verification:
  - [x] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-10 - Add Automatic Break Context on Floor Board

- Task: Revise and complete Phase 4 Tasks 2.1, 2.2, and 2.3 only.
- Problem understanding:
  - [x] Shift start time should come from when the local shift starts, not from an extra manual screen.
  - [x] Floor activity can be derived from existing bed-level acuity for Phase 4.
  - [x] AI-assisted floor acuity belongs to a later phase, not this local-only task.
- Solution understanding:
  - [x] `Shift.startedAt` is optional for old restored shifts and is set for newly started shifts.
  - [x] `src/utils/breakSchedule.ts` derives floor activity from acuity counts and formats the shift start time.
  - [x] `src/screens/FloorBoardScreen.tsx` shows shift start and floor activity in the board summary.
  - [x] The standalone Break Schedule route and manual input screen were removed.
- Broader context:
  - [x] Deterministic break generation can use this local context later without adding a separate input step.
  - [x] The change stays local-only and preserves existing assignment, persistence, flags, and simulated nurse behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-09 - Add Phase 4 Break Schedule Model and Refresh Marker

- Task: Complete Phase 4 Tasks 1.1, 1.2, and 1.3 only.
- Problem understanding:
  - [ ] Phase 4 needs break schedule state on the active shift without changing saved floor templates or previous-shift snapshots.
  - [ ] Restored shifts from earlier phases may not have `breakSchedule`, so displays need safe defaults.
  - [ ] Generated break times become stale when the local assignment is rerun, because break scheduling depends on the assignment snapshot.
- Solution understanding:
  - [ ] `src/types/models.ts` defines break schedule types and optional `Shift.breakSchedule`.
  - [ ] `src/utils/breakSchedule.ts` centralizes safe break schedule views, nurse entry lookup, nurse warning lookup, and the missing-break label.
  - [ ] `markBreakScheduleNeedsRefresh` only changes a generated schedule's status to `needs_refresh`; it preserves entries, inputs, and warnings.
  - [ ] Local assignment reruns use the helper to mark existing generated schedules stale without changing break times yet.
- Broader context:
  - [ ] These helpers prepare the Break Schedule screen, floor board badges, and simulated nurse break display without implementing those future tasks early.
  - [ ] The change stays local-only and does not add backend, auth, realtime, notification, sync, drag-and-drop, tablet, or AI behavior.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

### 2026-06-08 - Confirm Phase 4 App Compatibility

- Task: Complete Phase 4 setup Task 0.2 without writing feature code.
- Problem understanding:
  - [ ] Phase 4 break scheduling needs to build on the existing local active-shift workflow.
  - [ ] Setup work should identify touchpoints before adding model, route, screen, or generation code.
  - [ ] Break scheduling must stay local-only and avoid future-phase backend, auth, realtime, notification, sync, drag-and-drop, tablet, and AI work.
- Solution understanding:
  - [ ] `docs/phase-4/setup-notes.md` records the current compatibility review.
  - [ ] Break schedule state should attach to optional `activeShift.breakSchedule`, not saved floor templates or previous-shift snapshots.
  - [ ] Existing active-shift persistence can carry a plain JSON optional field without a storage version change.
  - [ ] `docs/phase-4/tasks.md` marks only setup Task 0.2 done.
- Broader context:
  - [ ] This protects Phase 1 assignment, Phase 2 persistence, and Phase 3 nurse simulation behavior before Phase 4 feature code starts.
  - [ ] The next task can add types with a clear source-of-truth decision.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Remove Carry-Over Review Subheader and Button Bar

- Task: Remove the "Previous-shift suggestions" subheader and the workflow step chips (button bar) from the Carry-Over Review screen.
- Problem understanding:
  - [x] The subtitle text was redundant.
  - [x] The carry-over button bar looked squished and took up vertical space unnecessarily, especially since this is a read-only review screen right now.
- Solution understanding:
  - [x] `src/screens/CarryOverReviewScreen.tsx` no longer passes the `subtitle` prop to `<WorkflowScreen>`.
  - [x] `src/screens/CarryOverReviewScreen.tsx` no longer passes the `flow` prop to `<WorkflowScreen>`, which removes the step chips.
  - [x] The unused `carryOverReviewFlow` import was removed.
- Broader context:
  - [x] This improves the visual layout of the Carry-Over Review screen.
  - [x] It reduces clutter before adding interactive suggestion review features later.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Accept and Dismiss Nurse Suggestions (Task 6.2)

- Task: Make nurse carry-over suggestions interactive with accept, dismiss, and undo actions.
- Problem understanding:
  - [x] The Carry-Over Review screen showed nurse suggestions as static "Pending review" badges with no way to act on them.
  - [x] Accepted nurses need to join the active shift's nurse list so they appear on the Nurses screen.
  - [x] Max patient load should NOT carry over because staffing limits change between shifts.
- Solution understanding:
  - [x] `src/screens/CarryOverReviewScreen.tsx` tracks review decisions in local `useState` as a `Record<suggestionId, NurseReviewEntry>`.
  - [x] Accept, dismiss, and undo only change local component state — no shift mutation happens until Continue.
  - [x] `handleContinue` collects all accepted suggestions and adds them to `activeShift.nurses` in one `setLocalState` call, with `maxPatientLoad` defaulting to `sideLoadLimits.admitting.max`.
  - [x] Duplicate prevention checks name + licenseType + experienceLevel before adding.
  - [x] `SuggestionStatusBadge` now takes a `variant` prop for accepted (green), dismissed (gray), and pending (amber) styles.
- Broader context:
  - [x] This fulfills US6 acceptance criteria for nurse carry-over.
  - [x] Patient carry-over (Task 6.3) follows the same pattern but modifies `bedStates` instead of `nurses`.
  - [x] The manual add flow on NursesScreen remains unchanged.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Plan Phase 2 Local Persistence

- Task: Create Phase 2 planning docs for local persistence, saved template reuse, active shift restore, and previous-shift carry-over suggestions.
- Problem understanding:
  - [ ] Phase 1 proved the local charge nurse workflow, but its work needs to become reusable across app launches and shifts.
  - [ ] Phase 2 should add persistence without introducing backend, auth, realtime sync, invite links, offline queues, or other later-phase infrastructure.
  - [ ] Carry-over suggestions should speed setup while still requiring the charge nurse to review nurses and patients from the most recent shift that used the same floor template.
- Solution understanding:
  - [ ] `docs/phase-2/user-stories.md` defines the Phase 2 charge nurse stories and acceptance criteria.
  - [ ] `docs/phase-2/data-model.md` documents persisted local app state, previous-shift snapshots keyed by floor template, and carry-over suggestion records.
  - [ ] `docs/phase-2/mobile-design.md` documents the local-only UI direction and carry-over review design.
  - [ ] `docs/phase-2/screens.md` maps the Phase 2 screen changes and new Carry-Over Review screen.
  - [ ] `docs/phase-2/tasks.md` orders small implementation tasks with manual validation checks.
  - [ ] The plan preserves Phase 1 assignment behavior and keeps future-phase features out of Phase 2.
- Broader context:
  - [ ] Phase 2 creates the bridge between a one-session prototype and a reusable local workflow.
  - [ ] The storage boundary should make persistence understandable before server persistence arrives in a later phase.
  - [ ] Previous-shift snapshots support next-shift setup for the same floor template without becoming full shift history or analytics.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Complete Phase 2 Setup Tasks

- Task: Complete Phase 2 setup tasks 0.1 and 0.2 by documenting local-persistence scope guardrails and Phase 1 compatibility.
- Problem understanding:
  - [ ] Phase 2 needs a clear boundary before feature code starts.
  - [ ] Persistence should save durable product data, not temporary setup/edit UI state.
  - [ ] Phase 1 assignment behavior should remain unchanged while persistence is added around it.
- Solution understanding:
  - [ ] `docs/phase-2/setup-notes.md` records Phase 2 included and excluded scope.
  - [ ] The setup note identifies current persisted candidates: floor templates, active shift, assignment result, flags, and future previous-shift snapshots.
  - [ ] The setup note identifies temporary state: draft floor template and active-shift-template edit mode.
  - [ ] `docs/phase-2/tasks.md` marks setup tasks 0.1 and 0.2 done.
- Broader context:
  - [ ] These setup tasks reduce the chance of accidentally adding backend, auth, sync, or future nurse flows during persistence work.
  - [ ] Separating persisted state from temporary UI state will make the storage boundary easier to implement and explain.
  - [ ] Preserving assignment behavior keeps Phase 2 focused on reuse, not algorithm changes.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Add Phase 2 Persisted State Types

- Task: Add the Phase 2 TypeScript types for persisted local app state and carry-over snapshots.
- Problem understanding:
  - [ ] `LocalAppState` is live app state and can include temporary UI workflow data.
  - [ ] Phase 2 needs a separate saved-state shape for durable local storage data.
  - [ ] Carry-over suggestions need a previous-shift snapshot without adding backend, auth, sync, or invite concepts.
- Solution understanding:
  - [ ] `src/types/models.ts` now defines `LocalStorageVersion`.
  - [ ] `src/types/models.ts` now defines nurse and patient carry-over suggestion types.
  - [ ] `src/types/models.ts` now defines `PreviousShiftSnapshot`.
  - [ ] `src/types/models.ts` now defines `PersistedLocalAppState`.
  - [ ] `LocalAppState` was left unchanged so Task 1.1 does not implement storage behavior early.
  - [ ] `docs/phase-2/tasks.md` marks Task 1.1 done.
- Broader context:
  - [ ] These types create the contract Task 1.2 can use for a local storage repository.
  - [ ] Separating persisted state from live UI state helps prevent unfinished drafts from being restored as saved data.
  - [ ] The change keeps Phase 2 local-only and does not change assignment behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Add Local Storage Repository

- Task: Add the Phase 2 local storage repository boundary for persisted app state.
- Problem understanding:
  - [ ] Screens should not each handle storage keys, JSON strings, or empty-storage defaults.
  - [ ] Task 1.2 needs a storage boundary, not full app startup restore or template persistence yet.
  - [ ] The repository should save `PersistedLocalAppState`, not temporary `LocalAppState` draft fields.
- Solution understanding:
  - [ ] `src/services/storageRepository.ts` defines a `StorageAdapter` interface.
  - [ ] `src/services/storageRepository.ts` defines a `StorageRepository` with load, save, and clear methods.
  - [ ] The repository serializes with `JSON.stringify` and parses with `JSON.parse`.
  - [ ] Missing saved data returns an empty persisted state with storage version, empty templates, and empty previous-shift snapshots.
  - [ ] A memory adapter exists for simple manual/debug validation without adding a storage library yet.
  - [ ] `docs/phase-2/tasks.md` marks Task 1.2 done.
- Broader context:
  - [ ] Later tasks can plug this boundary into app startup and saved template behavior.
  - [ ] Keeping storage behind one service makes persistence easier to explain and change.
  - [ ] The change remains local-only and does not add backend, auth, sync, or invite behavior.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Handle Invalid Saved Data Safely

- Task: Update the local storage repository so invalid or unreadable saved app state does not crash the app.
- Problem understanding:
  - [ ] Saved local data can be missing, malformed JSON, the wrong version, or the wrong top-level shape.
  - [ ] The app should recover locally instead of crashing during load.
  - [ ] Task 1.3 should not add backend, account, sync, conflict-resolution, or full recovery-screen behavior.
- Solution understanding:
  - [ ] `src/services/storageRepository.ts` now has a small persisted-state type guard.
  - [ ] `src/services/storageRepository.ts` now parses saved JSON through `parsePersistedLocalAppState`.
  - [ ] Invalid JSON, wrong top-level shape, wrong storage version, or storage read errors return an empty persisted state.
  - [ ] The repository keeps a local, beginner-readable recovery message constant for future UI use.
  - [ ] `docs/phase-2/tasks.md` marks Task 1.3 done.
- Broader context:
  - [ ] This makes the storage boundary safer before the app starts using it on launch.
  - [ ] Returning an empty persisted state keeps Phase 2 local-first and understandable.
  - [ ] Deeper validation can be added later when specific persisted entities are wired into screens.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-06 - Save Completed Floor Templates

- Task: Persist completed floor templates after the existing Template Review save validation passes.
- Problem understanding:
  - [ ] Completed templates were added to React state, but React state alone disappears when the app closes.
  - [ ] Task 2.1 should save reusable floor structure without adding startup restore, active-shift persistence, backend, auth, sync, or future-phase behavior.
  - [ ] The main branch considered was where to save: inside the screen versus through the existing local storage boundary.
- Solution understanding:
  - [ ] `src/services/localStorageAdapters.ts` provides a small adapter for browser localStorage on web and Expo FileSystem document storage on native.
  - [ ] `src/store/LocalStateContext.tsx` exposes `saveFloorTemplates`, which writes only the template list into `PersistedLocalAppState`.
  - [ ] `src/screens/TemplateReviewScreen.tsx` now saves the completed template list before updating the in-memory workspace and returning home.
  - [ ] The saved templates contain floor name, doctor sides, rooms, and beds, not patients, nurses, acuity, assignments, or flags.
  - [ ] `docs/phase-2/tasks.md` marks Task 2.1 done.
- Broader context:
  - [ ] This is the write side of template persistence; loading saved templates on app start stays reserved for Task 2.2.
  - [ ] Keeping persistence behind the repository makes later active-shift and carry-over storage easier to explain.
  - [ ] The change stays local-only and does not alter Phase 1 validation or assignment rules.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-06 - Load Saved Templates on App Start

- Task: Load saved floor templates into Local Workspace when the app starts.
- Problem understanding:
  - [ ] Task 2.1 saved templates to persisted storage, but the app still started from empty React state.
  - [ ] Task 2.2 should restore templates only, not active shifts, carry-over snapshots, backend data, auth, sync, or future-phase behavior.
  - [ ] A fresh install or cleared local data should still produce the normal empty template list.
- Solution understanding:
  - [ ] `src/store/LocalStateContext.tsx` now loads persisted app state once when `LocalStateProvider` mounts.
  - [ ] The provider copies `savedState.floorTemplates` into `localState.floorTemplates`.
  - [ ] Draft template state, active-shift state, and previous-shift snapshots are left alone for later tasks.
  - [ ] The effect avoids updating state after the provider unmounts.
  - [ ] `docs/phase-2/tasks.md` marks Task 2.2 done.
- Broader context:
  - [ ] Tasks 2.1 and 2.2 together complete the first save-and-restore loop for floor templates.
  - [ ] Loading through the provider keeps screens focused on UI instead of storage details.
  - [ ] Active shift restore remains a later Phase 2 task with its own acceptance criteria.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-06 - Prevent Duplicate Saved Template Names

- Task: Validate new floor names against saved floor template names.
- Problem understanding:
  - [ ] Once saved templates load on app start, new floor creation must not allow a duplicate saved template name.
  - [ ] The duplicate check should compare the typed name after trimming extra spaces.
  - [ ] Task 2.3 should not add edit flows, backend validation, auth, sync, or future-phase behavior.
- Solution understanding:
  - [ ] `src/screens/FloorDetailsScreen.tsx` now uses `hasSavedFloorTemplateWithName` for duplicate template-name validation.
  - [ ] The helper compares the trimmed typed name to each saved template name after trimming.
  - [ ] The current draft id is ignored so continuing through the same draft does not block itself.
  - [ ] `docs/phase-2/tasks.md` marks Task 2.3 done.
- Broader context:
  - [ ] Saved templates are now treated like the real local workspace list for new floor validation.
  - [ ] Preventing duplicates keeps later template reuse and editing easier to reason about.
  - [ ] This completes the small Phase 2 floor-template persistence group before template reuse tasks begin.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Start Shift From a Saved Template

- Task: Start a new active shift from a saved floor template without changing the saved template.
- Problem understanding:
  - [ ] A saved floor template is reusable structure, while an active shift is today's working copy.
  - [ ] Task 3.1 should reuse saved templates without adding template editing, active-shift persistence, carry-over review, backend, auth, sync, or future-phase behavior.
  - [ ] The main branch considered was whether to keep the selected template in `draftFloorTemplate` or keep the copied shift structure only on `activeShift`.
- Solution understanding:
  - [ ] `src/screens/HomeScreen.tsx` still creates a fresh `Shift` from the selected saved `FloorTemplate`.
  - [ ] The helper copies doctor sides, rooms, and beds into the active shift and creates one empty `BedState` for each saved bed.
  - [ ] Starting the shift now clears `draftFloorTemplate` and `isEditingActiveShiftTemplate` so the saved template is not treated as an editable draft for this task.
  - [ ] Patient, acuity, nurse, load limit, assignment, and flag changes stay on `activeShift`, not on the saved template.
  - [ ] `docs/phase-2/tasks.md` marks Task 3.1 done.
- Broader context:
  - [ ] This starts the Phase 2 template reuse group while preserving the existing Phase 1 setup flow.
  - [ ] The saved template remains the blueprint, and each shift gets its own editable local state.
  - [ ] Later tasks can add saved-template editing and active-shift persistence separately.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Add Template Edit Entry Point

- Task: Use saved template row selection as the edit entry point and block template editing while an active shift exists.
- Problem understanding:
  - [ ] Saved templates need a clear edit doorway, but editing should not be available during an active shift.
  - [ ] Task 3.2 should add the entry point only, not the saved-edit persistence from Task 3.3.
  - [ ] The main branch considered was whether to add a separate `Edit` button or reuse the existing row tap plus Template Review step navigation.
- Solution understanding:
  - [ ] `src/screens/HomeScreen.tsx` uses the existing saved template row tap as the edit entry point.
  - [ ] Pressing a saved template row with no active shift copies the saved template into `draftFloorTemplate` and opens Template Review, whose step chips can route back to the setup screens.
  - [ ] Pressing a saved template row while an active shift exists shows `End the active shift before editing templates.`
  - [ ] Template Review uses the same `Save template` path for new templates and saved-template edits.
  - [ ] `docs/phase-2/tasks.md` marks Task 3.2 done.
- Broader context:
  - [ ] This keeps saved template editing separate from active shift work.
  - [ ] Copying the saved template into draft state protects the saved template from accidental mutation.
  - [ ] Later Task 3.3 can add local persistence for saved template edits without changing the entry point again.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Compact Active Shift Actions

- Task: Make the active shift card actions smaller and place `Resume` and `End shift` in one row.
- Problem understanding:
  - [ ] The two full-width buttons made the active shift card taller than necessary.
  - [ ] The buttons should still communicate primary action versus destructive action.
  - [ ] The main branch considered was whether to keep full labels or shorten the primary label so both buttons fit cleanly.
- Solution understanding:
  - [ ] `src/screens/HomeScreen.tsx` wraps the active shift actions in one horizontal row.
  - [ ] `Resume Active Shift` became `Resume` with an accessibility label that still says `Resume active shift`.
  - [ ] Both buttons keep a 44px minimum touch target while using less vertical space.
- Broader context:
  - [ ] This improves scanability of the Local Workspace without changing shift behavior.
  - [ ] The destructive `End shift` action remains visually separate through the red outline.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Save Template Edits Locally

- Task: Save edited saved floor templates back to local storage.
- Problem understanding:
  - [x] Task 3.2 opened a saved template as a draft, but Task 3.3 needs `Save template` to persist the edited draft.
  - [x] Cancel/back should not change the saved template because edits live in `draftFloorTemplate` until save.
  - [x] The main branch considered was whether to treat new templates and edited templates as separate save paths or one replace-by-id path.
- Solution understanding:
  - [x] `src/screens/TemplateReviewScreen.tsx` uses one `Save template` path for new templates and edits.
  - [x] `getFloorTemplatesWithSavedTemplate` replaces an existing template with the same id or appends a brand-new template.
  - [x] `saveFloorTemplates` persists the updated template list locally.
  - [x] Existing Phase 1 validation still blocks incomplete templates before save.
  - [x] `docs/phase-2/tasks.md` marks Task 3.3 done.
- Broader context:
  - [x] Saved templates remain reusable local structure, not shift-specific patient or nurse data.
  - [x] Editing by matching template id keeps the local workspace list stable and beginner-readable.
  - [x] Later active-shift persistence and carry-over tasks can build on the same local storage boundary.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Validate Edited Templates Before Shift Start

- Task: Block shift start from incomplete saved templates and route the user to review/fix when possible.
- Problem understanding:
  - [ ] A saved template can become invalid after editing, such as having no rooms or missing room-to-side assignments.
  - [ ] Starting a shift from invalid structure would create broken shift state with missing beds or doctor-side mappings.
  - [ ] The main branch considered was whether to silently block, show only a message, or open the existing Template Review/edit path.
- Solution understanding:
  - [ ] `src/screens/HomeScreen.tsx` keeps the existing valid-template start-shift path unchanged.
  - [ ] `handleStartShift` blocks starting any saved template while another active shift exists.
  - [ ] If `isCompletedFloorTemplate` fails and no shift is active, `handleStartShift` copies the saved template into `draftFloorTemplate` and routes to Template Review.
  - [ ] If an active shift exists, it shows `End the active shift before starting another shift.`
  - [ ] Template Review already shows the existing incomplete-template validation message and step chips for fixing the template.
  - [ ] `docs/phase-2/tasks.md` marks Task 3.4 done.
- Broader context:
  - [ ] This protects active shift creation from bad saved template structure.
  - [ ] The fix path reuses Phase 1 template setup screens instead of adding recovery screens or future-phase infrastructure.
  - [ ] Later tasks can rely on started shifts having valid room, bed, and doctor-side structure.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Save Active Shift Changes

- Task: Save active shift changes into local persisted state.
- Problem understanding:
  - [x] React state keeps the active shift usable during the current app session, but it is not durable storage.
  - [x] Task 4.1 should write active shift changes only; restoring them on app start belongs to Task 4.2.
  - [x] The main branch considered was whether each screen should save manually or the provider should observe `activeShift` changes in one place.
- Solution understanding:
  - [x] `src/store/LocalStateContext.tsx` keeps `saveActiveShift` private to the provider.
  - [x] The provider watches `localState.activeShift` and saves it when it changes.
  - [x] The saved `Shift` includes status, admitting side, side load limits, nurses, bed states, assignment result, and flags because those fields already live on `activeShift`.
  - [x] The provider avoids clearing persisted active shift on initial app load before Task 4.2 restore exists.
  - [x] `docs/phase-2/tasks.md` marks Task 4.1 done.
- Broader context:
  - [x] This is the write side of active shift persistence.
  - [x] Keeping the save in the provider avoids spreading storage code across setup and board screens.
  - [x] Later restore and recovery tasks can read from the same local storage boundary.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Restore Active Shift on App Start

- Task: Restore the saved active shift into local app state when NurseFlow opens.
- Problem understanding:
  - [x] Task 4.1 saved active shift data, but React state still started empty after a reload.
  - [x] Task 4.2 should restore the one saved local active shift, not add history, backend sync, or recovery flows.
  - [x] The main branch considered was whether Home should load storage itself or the provider should keep startup restore in one place.
- Solution understanding:
  - [x] `src/store/LocalStateContext.tsx` now loads `savedState.activeShift` with saved floor templates.
  - [x] The existing Home active shift card appears because `localState.activeShift` is restored.
  - [x] The existing resume button routes setup shifts to `/start-shift` and assigned shifts to `/floor-board`.
  - [x] `draftFloorTemplate` and edit-mode state are still temporary and are not restored.
  - [x] `docs/phase-2/tasks.md` marks Task 4.2 done.
- Broader context:
  - [x] Active shift persistence now has both halves: save on change and restore on app start.
  - [x] Later missing-template recovery remains separate in Task 4.3.
  - [x] Later end-shift behavior remains separate in Task 4.4.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Handle Missing Template for Restored Shift

- Task: Show a local recovery message when a restored active shift references a missing floor template.
- Problem understanding:
  - [x] Saved local data can become inconsistent if an active shift points to a template id that is no longer saved.
  - [x] Task 4.3 should show a local recovery path, not add backend sync, conflict handling, or shift history.
  - [x] Normal template deletion already clears matching active shift state, so this handles unusual restored-data mismatch.
- Solution understanding:
  - [x] `src/screens/HomeScreen.tsx` detects `activeShiftMissingTemplate` from `localState.activeShift` and `localState.floorTemplates`.
  - [x] Home shows a warning on the active shift card when the saved template is missing.
  - [x] The existing `Resume` and `End shift` actions remain the recovery choices.
  - [x] Existing valid active shift and saved template behavior is unchanged.
  - [x] `docs/phase-2/tasks.md` marks Task 4.3 done.
- Broader context:
  - [x] This keeps restored local data from feeling broken or mysterious.
  - [x] Missing-template recovery is separate from Task 4.4 end-shift cleanup.
  - [x] The app remains local-only and does not add future-phase sync concepts.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Keep End Shift Local While Preserving Templates

- Task: Confirm ending a shift clears the active shift locally while saved templates remain available.
- Problem understanding:
  - [x] Active shift data and saved floor templates are different pieces of local state.
  - [x] Task 4.4 should clear the current shift only, not create previous-shift snapshots or carry-over suggestions.
  - [x] Ending a shift must stay local and should not introduce backend, sync, history, or archive concepts.
- Solution understanding:
  - [x] `src/screens/HomeScreen.tsx` already clears `activeShift`, `draftFloorTemplate`, and `isEditingActiveShiftTemplate` in `handleConfirmEndActiveShift`.
  - [x] `src/store/LocalStateContext.tsx` persists the cleared `activeShift` as `undefined`.
  - [x] Saved `floorTemplates` are preserved because the active-shift save path spreads the existing persisted state and only changes `activeShift`.
  - [x] No app code change was needed for this task because the existing Phase 1 end-shift action plus Tasks 4.1 and 4.2 already met the behavior.
  - [x] `docs/phase-2/tasks.md` marks Task 4.4 done.
- Broader context:
  - [x] This completes the active-shift persistence group.
  - [x] Previous-shift snapshots begin in Task 5.1, not Task 4.4.
  - [x] The app remains local-only and preserves saved reusable floor templates.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Store Previous-Shift Snapshots

- Task: Create a local previous-shift snapshot when ending a shift, keep one snapshot per template, and allow empty snapshots.
- Problem understanding:
  - [x] Carry-over suggestions need a small record of the ended shift before `activeShift` is cleared.
  - [x] Phase 2 should store only the latest snapshot per floor template, not a shift history list.
  - [x] Empty ended shifts should still produce a valid empty snapshot instead of crashing or inventing fake suggestions.
- Solution understanding:
  - [x] `src/screens/HomeScreen.tsx` builds a `PreviousShiftSnapshot` from the active shift before clearing it.
  - [x] Nurse suggestions store stable nurse profile fields, not max load or assignment teams.
  - [x] Patient suggestions store occupied patients with previous bed id, previous bed label, and acuity.
  - [x] `src/store/LocalStateContext.tsx` saves the snapshot through the local storage boundary.
  - [x] Saving a snapshot replaces any existing snapshot with the same `floorTemplateId`.
  - [x] Tasks 5.1, 5.2, and 5.3 are marked done in `docs/phase-2/tasks.md`.
- Broader context:
  - [x] This stores data for later carry-over review tasks without showing suggestion UI yet.
  - [x] The app remains local-only and does not add backend, sync, history, or analytics.
  - [x] Later tasks can read these snapshots when starting a new shift from the same template.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Add Carry-Over Review Screen

- Task: Route new shifts with a same-template previous snapshot to a read-only Carry-Over Review screen.
- Problem understanding:
  - [x] Starting a new shift needs a place to show previous-shift suggestions before normal setup.
  - [x] Suggestions must only come from the same floor template.
  - [x] Task 6.1 should not accept, dismiss, or convert suggestions yet.
- Solution understanding:
  - [x] `src/store/LocalStateContext.tsx` now restores `previousShiftSnapshots` into live local state.
  - [x] `src/screens/HomeScreen.tsx` checks for a same-template snapshot before deciding whether to route to Carry-Over Review or Start Shift.
  - [x] `src/screens/CarryOverReviewScreen.tsx` shows nurse and patient suggestions in separate read-only sections.
  - [x] Suggestions display as `Pending review` without storing review decisions yet.
  - [x] `docs/phase-2/tasks.md` marks Task 6.1 done.
- Broader context:
  - [x] This connects stored snapshots to visible setup workflow while staying local-only.
  - [x] It prepares the UI for Tasks 6.2 and 6.3 without implementing their behavior early.
  - [x] Templates with no snapshot still use the existing Start Shift flow.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Add Room Delete Swipe Cue

- Task: Make hidden room deletion more discoverable on the Rooms and Beds screen.
- Problem understanding:
  - [x] Room deletion already existed behind a swipe gesture.
  - [x] The UI did not clearly hint that the room row could be swiped to reveal delete.
  - [x] Hidden gestures are easy to miss, especially in a beginner-tested mobile prototype.
- Solution understanding:
  - [x] Each room row now shows a small visual cue with a chevron and trash icon.
  - [x] The cue points toward the existing right-swipe gesture that reveals the left-side remove action.
  - [x] The existing `SwipeRevealAction` behavior stayed unchanged.
  - [x] No new library or future-phase interaction pattern was added.
- Broader context:
  - [x] This improves discoverability without making delete the main room action.
  - [x] It keeps destructive behavior guarded by the existing swipe reveal pattern.
  - [x] It supports Phase 1 manual testing because testers can notice how room removal works.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Add Local End Shift Action

- Task: Add a confirmed local-only way to end the active shift.
- Problem understanding:
  - [x] Phase 1 had a way to start and resume an active shift, but no deliberate way to clear it.
  - [x] Restarting the app should not be the only way to leave an active-shift state.
  - [x] Ending a shift in Phase 1 should not imply history, archiving, backend persistence, or sync.
- Solution understanding:
  - [x] Local Workspace now shows an `End shift` action when an active shift exists.
  - [x] The action opens a confirmation dialog before clearing shift data.
  - [x] Confirming clears `activeShift`, `draftFloorTemplate`, and `isEditingActiveShiftTemplate`.
  - [x] Saved `floorTemplates` are preserved so the user can start another shift from the same template.
  - [x] `docs/phase-1/tasks.md` now includes completed Task 4.5.
- Broader context:
  - [x] This closes a basic lifecycle gap in the local prototype.
  - [x] It keeps the behavior Phase 1-sized: local cleanup, not shift history.
  - [x] The active shift is temporary working state; the floor template is reusable setup data.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Complete Phase 1 Task 9.x Manual Pass

- Task: Verify and mark Phase 1 tasks 9.1 through 9.5 complete.
- Problem understanding:
  - [x] The 9.x tasks are not new feature tasks; they prove the existing Phase 1 workflow works end to end.
  - [x] A passing typecheck alone would not prove the app can be manually used from empty state to floor board.
  - [x] Scope leaks can exist in config or dependencies even when screen code looks local-only.
- Solution understanding:
  - [x] The happy path was tested through the exported web app in the browser.
  - [x] Validation cases were checked for blank floor name, duplicate floor name, duplicate room, missing doctor side, invalid nurse max load, invalid patient age, and missing acuity.
  - [x] Assignment edge cases were checked against the real assignment utilities with crafted local shifts.
  - [x] Unused `expo-linking`, `expo-web-browser`, app scheme config, and a dead `hasPatientInfo` variable were removed.
  - [x] `docs/phase-1/tasks.md` now marks tasks 9.1 through 9.5 done.
- Broader context:
  - [x] Phase 1 is now validated as a local charge nurse prototype rather than only a collection of implemented screens.
  - [x] Removing scope leaks keeps future-phase concepts from silently entering Phase 1.
  - [x] The readability cleanup makes the patient/acuity screen easier for a beginner to explain.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-05 - Add Understanding Checkpoint Skill And Workflow

- Task: Add a required post-task teaching checkpoint to the repo instructions and create a reusable `$teaching-checkpoint` Codex skill.
- Problem understanding:
  - [x] The previous workflow ended at refactor and did not explicitly require teaching verification.
  - [x] The done criteria required explanations, but did not define how to confirm the human could explain the work herself.
  - [x] A repo-only rule makes the checkpoint required for NurseFlow, but does not make the method reusable across projects.
  - [x] A skill-only solution would be reusable, but future NurseFlow sessions might not reliably trigger it unless `AGENTS.md` anchors the requirement.
  - [x] The checklist template and process can be reusable, but the actual running checklist should stay with the project.
- Solution understanding:
  - [x] `AGENTS.md` now includes `Understanding checkpoint` as workflow step 11.
  - [x] `AGENTS.md` tells Codex to use `$teaching-checkpoint` when that skill is available.
  - [x] `C:\Users\psito\.codex\skills\teaching-checkpoint\SKILL.md` defines the reusable teaching workflow and checklist template.
  - [x] The new checkpoint asks for problem, solution, and broader-context understanding.
  - [x] The checklist file creates a durable place to track what was taught and verified.
  - [x] If `AskUserQuestion` is unavailable, direct chat questions are the fallback.
  - [x] The official skill validator could not run because the available Python runtimes do not have PyYAML; the frontmatter and TODO checks were inspected manually.
- Broader context:
  - [x] Future coding tasks should close only after implementation, validation, task tracking, and understanding verification.
  - [x] This supports the project goal of learning without over-automating.
  - [x] The skill makes the teaching checkpoint portable to other projects, while `AGENTS.md` keeps it mandatory here.
  - [x] The project checklist preserves task-specific learning history in the repo instead of hiding it inside a global skill.
  - [x] The checklist should stay concise so it helps learning instead of becoming busywork.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Handle Carry-Over Patient Missing Previous Bed

- Task: Handle carry-over patient suggestions whose previous beds no longer exist.
- Problem understanding:
  - [x] If a floor template is edited to remove a bed, patient suggestions from the previous shift using that bed cannot map to any existing `BedState`.
  - [x] Presenting them in the carry-over list would create complex resolution flows or risk data inconsistency.
  - [x] Simply omitting suggestions whose previous beds no longer exist keeps the shift setup workflow clean and lightweight.
- Solution understanding:
  - [x] `src/screens/CarryOverReviewScreen.tsx` filters `patientSuggestions` by checking if the suggestion's `previousBedId` still exists in the active shift's beds (`activeShift.beds`).
  - [x] Suggestions for deleted beds are discarded automatically by being filtered out of the Carry-Over Review list.
  - [x] No new unassigned patient models, custom sections, or complex validation blocks were added to `src/types/models.ts` or `src/screens/PatientsAndAcuityScreen.tsx`.
  - [x] `docs/phase-2/tasks.md` marks Task 6.4 done.
- Broader context:
  - [x] This maintains a simplified local-only design system without over-automating carry-over recovery.
  - [x] It supports charge nurse template updates without creating technical debt or complex corner-case UX handling.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Preserve Manual Add Flows

- Task: Verify that manual nurse and patient additions still function correctly alongside accepted carry-over suggestions.
- Problem understanding:
  - [x] Carrying over data must not lock the lists or prevent the charge nurse from entering new/temporary shift info manually.
  - [x] Carried-over suggestions and manually added items must blend into the same data model so the assignment resolver treats them uniformly.
- Solution understanding:
  - [x] Accepted suggestions are committed directly into `activeShift.nurses` and `activeShift.bedStates`.
  - [x] Since `NursesScreen.tsx` and `PatientsAndAcuityScreen.tsx` observe and mutate the same local state fields, they automatically support manual adds and edits on top of carried-over suggestions.
  - [x] No new components or changes were needed because the clean Phase 1 and Phase 2 data model integration already preserved these flows natively.
  - [x] `docs/phase-2/tasks.md` marks Task 6.5 done.
- Broader context:
  - [x] Keeping data representation uniform allows simple local-first screens to remain highly reusable and easy to understand.
- Verification:
  - [x] Human restated understanding first.
  - [x] Code-specific question or walkthrough completed.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-07 - Complete Phase 2 Manual Pass

- Task: Verify Phase 2 templates, shifts, carry-over, edge cases, scope, and readability end-to-end.
- Problem understanding:
  - [x] A manual pass is required to verify that local persistence, template reuse, and carry-over work correctly under realistic usage scenarios.
  - [x] We must ensure no scope leaks from future phases (such as backend connectivity, authentication, deep links, push notifications, etc.) have entered the local-only phase.
- Solution understanding:
  - [x] Verified template persistence (Task 7.1): Creating, reloading, editing, and starting shifts from saved templates.
  - [x] Verified active shift restore (Task 7.2): Resuming shifts from setup or board views after app restart.
  - [x] Verified carry-over happy path (Task 7.3): Ending a shift and starting a new one from the same template successfully carries over accepted nurses and patients.
  - [x] Verified carry-over edge cases (Task 7.4): Deleting previous beds correctly filters out suggestions, and empty shifts carry over without crashing.
  - [x] Verified local-only scope (Task 7.5): Confirmed no dependencies or UI elements for auth, backend sync, WebSocket, push notifications, etc.
  - [x] Verified beginner readability (Task 7.6): Code structure and data persistence remain local-first and easy to explain.
- Broader context:
  - [x] Establishing a thorough manual test pass ensures that the local prototype is robust and stable before any networked features are introduced in future phases.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Create Phase 3 Planning Docs

- Task: Create Phase 3 planning docs for local nurse view simulation.
- Problem understanding:
  - [x] Phase 3 needs to plan the regular nurse experience without adding real accounts, invite links, backend, realtime, push notifications, or multi-device behavior.
  - [x] The plan must preserve Phase 1 assignment behavior and Phase 2 local persistence/carry-over behavior.
  - [x] The implementation tasks need to stay small enough for one focused session each.
- Solution understanding:
  - [x] `docs/phase-3/user-stories.md` defines local role switching, nurse assignment visibility, mock issue flags, mock swap requests, charge nurse review, local decisions, and compatibility.
  - [x] `docs/phase-3/data-model.md` documents simulated role state, optional active-shift `nurseRequests`, request statuses, and derived nurse assignment view data.
  - [x] `docs/phase-3/mobile-design.md` and `docs/phase-3/screens.md` describe the phone-first UI changes without future-phase infrastructure.
  - [x] `docs/phase-3/tasks.md` orders the work into small, independently testable tasks with manual validation checks.
- Broader context:
  - [x] Planning the simulated nurse flow locally helps prove the product behavior before real auth, invite links, and realtime collaboration are introduced later.
  - [x] Keeping nurse assignment display derived from existing active-shift assignment data avoids duplicating patient or acuity state.
  - [x] Mock request status updates teach the future communication flow without overbuilding infrastructure.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Confirm Phase 3 Current App Compatibility

- Task: Complete Phase 3 Task 0.2 by reviewing current app compatibility before implementation.
- Problem understanding:
  - [x] Phase 3 needs a compatibility review before adding simulated nurse screens.
  - [x] The review should identify connection points without changing assignment behavior.
  - [x] The task should stay documentation-only and avoid jumping into role switching or request features.
- Solution understanding:
  - [x] `docs/phase-3/setup-notes.md` documents current routes, state, storage, flags, assignment compatibility, and likely future files.
  - [x] `docs/phase-3/tasks.md` marks only Task 0.2 done.
  - [x] Mock issue and swap requests are planned for optional `activeShift.nurseRequests` later, while simulated role selection remains temporary UI state.
  - [x] No implementation code was changed for this task.
- Broader context:
  - [x] This review gives the next Phase 3 implementation task a clear boundary.
  - [x] Deriving nurse assignment views from existing active shift data preserves one source of truth.
  - [x] Keeping request records on the active shift avoids introducing server-like state too early.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Phase 3 Local Role Simulation State

- Task: Complete Phase 3 Tasks 1.1, 1.2, and 1.3.
- Problem understanding:
  - [ ] Phase 3 needs a local way to switch between charge view and regular nurse simulation before nurse screens exist.
  - [ ] Simulated role state must not become auth, accounts, invite links, backend state, or persisted user state.
  - [ ] The Floor Board should expose the simulation entry only when the current local shift can support it.
- Solution understanding:
  - [ ] `src/types/models.ts` defines `SimulatedRole` and `SimulatedSessionState`.
  - [ ] `src/store/LocalStateContext.tsx` stores temporary simulation state beside local app state, but does not persist it.
  - [ ] `LocalStateProvider` clears invalid regular-nurse simulation state when the active shift is missing, has no nurses, or the selected nurse no longer exists.
  - [ ] `src/screens/FloorBoardScreen.tsx` adds the local role simulation card with `View as nurse` and `Back to charge view`.
  - [ ] `docs/phase-3/tasks.md` marks only Tasks 1.1, 1.2, and 1.3 done.
- Broader context:
  - [ ] This sets up the next Phase 3 task, the simulated nurse picker, without building it early.
  - [ ] Keeping role simulation temporary protects the app from looking like it has real nurse accounts.
  - [ ] The existing assignment result remains the future source of truth for nurse-facing data.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-08 - Add Phase 3 Simulated Nurse Picker

- Task: Complete Phase 3 Tasks 2.1 and 2.2.
- Problem understanding:
  - [ ] Phase 3 needs a picker so the tester can choose one active-shift nurse for local simulation.
  - [ ] The picker should not build the nurse assignment detail screen yet.
  - [ ] The picker needs clear local empty states when the app is not ready for nurse simulation.
- Solution understanding:
  - [ ] `src/app/simulated-nurse-picker.tsx` adds the Expo Router route.
  - [ ] `src/screens/SimulatedNursePickerScreen.tsx` lists active-shift nurses with license, experience, assigned-bed count, and room coverage.
  - [ ] Selecting a nurse updates temporary `simulatedSessionState.selectedNurseId`.
  - [ ] `src/screens/FloorBoardScreen.tsx` now routes `View as nurse` to the picker.
  - [ ] `docs/phase-3/tasks.md` marks only Tasks 2.1 and 2.2 done.
- Broader context:
  - [ ] This prepares Task 3 by choosing the nurse whose assignment will later be derived from active shift data.
  - [ ] Keeping assignment details out of this task prevents jumping ahead.
  - [ ] The picker still uses local-only language and does not introduce accounts or invite links.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-08 - Separate Template Editing From Active Shift Setup

- Task: Remove active-shift template editing behavior and make Carry Over part of shift setup headers.
- Problem understanding:
  - [ ] Saved floor templates should be edited from the floor template flow only.
  - [ ] Active shifts should use their own copied floor structure and should not be silently synced when a saved template changes.
  - [ ] The active shift setup header should not show the floor-template `Review` step.
- Solution understanding:
  - [ ] `src/screens/TemplateReviewScreen.tsx` now saves only `draftFloorTemplate` to saved templates.
  - [ ] Active shift template sync helpers were removed.
  - [ ] `isEditingActiveShiftTemplate` was removed from live local state.
  - [ ] `shiftSetupFlow` no longer includes `Review`.
  - [ ] `carryOverReviewFlow` shows `Carry Over`, then `Shift`, `Nurses`, and `Patients`.
- Broader context:
  - [ ] This keeps reusable template edits separate from per-shift setup and patient assignment work.
  - [ ] It reduces accidental state coupling before future nurse-facing Phase 3 screens build on active shift data.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-08 - Add Phase 3 Simulated Nurse Assignment View

- Task: Complete Phase 3 Tasks 3.1, 3.2, and 3.3.
- Problem understanding:
  - [x] The simulated nurse assignment view should show one nurse's assignment without duplicating active shift data.
  - [x] The screen should handle missing shift, missing assignment, missing nurse, and invalid assignment references safely.
  - [x] Mock issue and swap forms should not be implemented yet.
- Solution understanding:
  - [x] `src/utils/nurseAssignmentView.ts` derives the selected nurse's assignment from active shift data.
  - [x] `src/screens/SimulatedNurseAssignmentScreen.tsx` displays the selected nurse summary, room coverage, assigned beds, patient info, and acuity.
  - [x] `src/app/simulated-nurse-assignment.tsx` adds the route.
  - [x] `src/screens/SimulatedNursePickerScreen.tsx` now opens the assignment view after nurse selection.
  - [x] `docs/phase-3/tasks.md` marks only Tasks 3.1, 3.2, and 3.3 done.
- Broader context:
  - [x] Deriving the nurse view from `activeShift.assignmentResult` keeps the charge board and nurse simulation consistent.
  - [x] Disabled issue/swap buttons preserve the planned workflow without jumping ahead to request forms.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Phase 3 Local Nurse Request Model

- Task: Complete Phase 3 Tasks 4.1 and 4.2.
- Problem understanding:
  - [x] Phase 3 needs a local data shape for mock issue flags and swap requests before request forms exist.
  - [x] Request records should live on the active shift as the single source of truth for today's local request state.
  - [x] Old Phase 2 active shifts may not have a `nurseRequests` field, so missing arrays must be handled safely.
- Solution understanding:
  - [x] `src/types/models.ts` defines local request status, request type, and `NurseRequest`.
  - [x] `Shift` now has optional `nurseRequests?: NurseRequest[]`.
  - [x] `src/helpers/shiftHelpers.ts` initializes new active shifts with `nurseRequests: []`.
  - [x] `src/utils/nurseRequests.ts` returns `[]` for shifts that do not have request data yet.
  - [x] No auth, invite, push, server, sync, or offline queue fields were added.
- Broader context:
  - [x] Future mock issue and swap forms can save records to one active-shift location.
  - [x] Active shift persistence can save and restore these records through the existing local JSON path.
  - [x] Previous-shift snapshots and saved floor templates remain separate from nurse request history.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Phase 3 Mock Issue Submission

- Task: Complete Phase 3 Tasks 5.1, 5.2, and 5.3.
- Problem understanding:
  - [x] The simulated nurse needed a local way to flag an issue without adding real messaging, notifications, backend, or charge-nurse review actions yet.
  - [x] Blank issue messages should not create request records.
  - [x] Optional bed context must come only from the selected nurse's assigned beds.
- Solution understanding:
  - [x] `src/screens/SimulatedNurseIssueScreen.tsx` adds the local mock issue form.
  - [x] The form saves a `NurseRequest` with `type: "issue"` and `status: "pending"` onto `activeShift.nurseRequests`.
  - [x] `src/screens/SimulatedNurseAssignmentScreen.tsx` opens the issue form and shows the selected nurse's local issue history.
  - [x] The issue screen uses `getSelectedNurseAssignmentView` so bed options come from the same derived nurse assignment data as the nurse view.
  - [x] Swap requests, charge-nurse review, accept/decline, notifications, and backend behavior were not added.
- Broader context:
  - [x] This proves the local nurse-to-charge request write path before adding swap requests or charge review.
  - [x] Keeping request records on `activeShift` preserves one source of truth for local request state.
  - [x] The active shift persistence path can restore submitted issues because they are part of the active shift.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Phase 3 Mock Swap Submission

- Task: Complete Phase 3 Tasks 6.1, 6.2, and 6.3.
- Problem understanding:
  - [ ] The simulated nurse needed a local way to request a swap without moving assignments or adding real messaging infrastructure.
  - [ ] A swap request must have a source bed, unlike an issue request where bed context can be optional.
  - [ ] The source bed must come from the selected nurse's assigned beds.
- Solution understanding:
  - [ ] `src/screens/SimulatedNurseSwapScreen.tsx` adds the local mock swap form.
  - [ ] The form saves a `NurseRequest` with `type: "swap"` and `status: "pending"` onto `activeShift.nurseRequests`.
  - [ ] `src/screens/SimulatedNurseAssignmentScreen.tsx` opens the swap form and shows issue and swap records in local request history.
  - [ ] The swap screen validates missing source bed, blank reason, and stale or invalid source-bed IDs before saving.
  - [ ] Charge-nurse review, accept/decline, reassignment, notifications, and backend behavior were not added.
- Broader context:
  - [ ] This completes the nurse-side local request creation path for Phase 3.
  - [ ] Keeping swaps as request records preserves assignment results until a later explicit decision task.
  - [ ] The same `activeShift.nurseRequests` list can support the upcoming charge-nurse request review tasks.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Fix Duplicate Nurse Request IDs

- Task: Fix the duplicate `nurse-request-1` key error after submitting local nurse requests.
- Problem understanding:
  - [ ] React list keys must be unique so rows keep stable identity across renders.
  - [ ] The in-memory `createLocalId` counter can reset after reload or Fast Refresh while saved requests remain on the active shift.
  - [ ] Saved request IDs should be checked against existing active-shift requests before creating another one.
- Solution understanding:
  - [ ] `src/utils/nurseRequests.ts` now creates the next unused nurse request ID from `activeShift.nurseRequests`.
  - [ ] Existing duplicate request IDs are repaired when request lists are read for display or saving.
  - [ ] `src/screens/SimulatedNurseIssueScreen.tsx` and `src/screens/SimulatedNurseSwapScreen.tsx` create request IDs inside the state update using the freshest active shift.
  - [ ] Request history can keep using `request.id` as the React key because the saved IDs are now unique.
- Broader context:
  - [ ] This preserves local persistence behavior without adding server IDs or future-phase infrastructure.
  - [ ] The same helper protects both issue and swap request creation.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Show Local Requests on Flags Screen

- Task: Complete Phase 3 Tasks 7.1 and 7.2.
- Problem understanding:
  - [ ] Charge nurse review needs to show both assignment-generated flags and local nurse requests.
  - [ ] Mock nurse requests should not replace imbalance, unassigned-bed, or other assignment flags.
  - [ ] This task should stay read-only and not add accept, decline, detail screens, reassignment, or future infrastructure.
- Solution understanding:
  - [ ] `src/screens/FlagsScreen.tsx` now builds list items for assignment flags, section headers, local request rows, and empty rows.
  - [ ] Assignment flags and local nurse requests appear in separate sections.
  - [ ] Local request filters show all requests, only mock issues, or only mock swaps without changing assignment flag filtering.
  - [ ] Local request rows show mock type, status, requester, bed context, timestamp, message, and `Local only`.
  - [ ] The combined empty state says `No flags or local requests yet` only when both assignment flags and local requests are empty.
- Broader context:
  - [ ] This lets the charge nurse see mock issue and swap requests before decision actions exist.
  - [ ] Keeping requests read-only preserves the Phase 3 build order for later accept/decline tasks.
  - [ ] The screen still uses the active shift as the local source of truth.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Local Request Detail View

- Task: Complete Phase 3 Task 7.3.
- Problem understanding:
  - [ ] Local request rows can get dense once they show requester, bed context, message, timestamp, type, and status.
  - [ ] The charge nurse needs more room to read one request without changing request status yet.
  - [ ] Accept, decline, reassignment, backend, notification, and sync behavior must stay out of this task.
- Solution understanding:
  - [ ] `src/screens/LocalRequestDetailScreen.tsx` shows a read-only detail view for one local request.
  - [ ] `src/screens/FlagsScreen.tsx` makes local request rows tappable and routes by request ID.
  - [ ] `src/utils/nurseRequestDisplay.ts` centralizes request labels, timestamps, and bed context so list rows and detail view stay consistent.
  - [ ] Missing or stale request IDs show a safe recovery state.
  - [ ] No active decision controls are shown for resolved requests or pending swaps in this task.
- Broader context:
  - [ ] This improves charge nurse review before local accept/decline actions are added later.
  - [ ] Keeping the detail view read-only preserves the Phase 3 build order.
  - [ ] The active shift remains the local source of truth for request data.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Resolve Mock Swap Requests Locally

- Task: Complete Phase 3 Tasks 8.1, 8.2, and 8.3.
- Problem understanding:
  - [ ] Pending mock swap requests need a local outcome so the simulated nurse can see whether charge accepted or declined the request.
  - [ ] Accepting a swap request in this phase should not move patients, beds, or assignment rows.
  - [ ] Already accepted or declined requests should not show active decision controls again.
- Solution understanding:
  - [ ] `src/utils/nurseRequests.ts` updates only pending swap requests to `accepted` or `declined`.
  - [ ] `src/screens/LocalRequestDetailScreen.tsx` shows Accept and Decline only for pending mock swaps.
  - [ ] Resolving a swap stores `resolvedAt` and a short local `resolutionNote`.
  - [ ] `src/screens/SimulatedNurseAssignmentScreen.tsx` already reads request status from the active shift, so the selected nurse sees accepted, declined, and pending statuses from the same request list.
  - [ ] Bed assignments stay unchanged.
- Broader context:
  - [ ] This completes the local request outcome loop before the manual Phase 3 test pass.
  - [ ] The feature remains local-first and avoids backend, sync, notification, invite, and drag-and-drop behavior.
  - [ ] Future reassignment behavior can be considered separately without hiding today's status-only decision.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Add Local Request Status Filters

- Task: Add pending, accepted, and declined filters for local nurse requests on the Flags screen.
- Problem understanding:
  - [ ] Once swap requests can be accepted or declined, charge review needs a quick way to find requests by status.
  - [ ] Request status filters should not affect assignment-generated flags.
  - [ ] Status filtering should stay local-only and should not add new decision behavior.
- Solution understanding:
  - [ ] `src/screens/FlagsScreen.tsx` adds `All`, `Pending`, `Accepted`, and `Declined` request status filters.
  - [ ] Request type filters and request status filters combine, so the user can filter to examples like pending swaps.
  - [ ] Assignment severity filters still apply only to assignment flags.
- Broader context:
  - [ ] This makes the charge nurse review screen easier to scan after local swap decisions exist.
  - [ ] The filter reads request state but does not mutate request or assignment data.
- Verification:
  - [x] Human restated understanding first.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Complete Phase 3 Manual Pass

- Task: Complete Phase 3 Tasks 9.1 through 9.7.
- Problem understanding:
  - [x] The final Phase 3 task block is a validation pass, not another feature build.
  - [x] The pass needs to prove local nurse simulation works while preserving Phase 1 and Phase 2 behavior.
  - [x] Any missing real-world swap constraints belong in later phases, not Phase 3.
- Solution understanding:
  - [x] `docs/phase-3/tasks.md` now marks Tasks 9.1 through 9.7 done.
  - [x] No feature code was added for Task 9 because the acceptance criteria are about manual validation, scope review, and readability.
  - [x] The reviewed code keeps role simulation local, derives nurse assignment visibility from the active assignment result, stores mock requests on the active shift, and updates swap request status without moving beds.
  - [x] Validation checks confirmed the app compiles, lints, exports for web, and starts without build errors.
- Broader context:
  - [x] This closes the local Phase 3 simulation before future backend, real roles, realtime, notification, or reassignment work.
  - [x] Keeping this pass small makes it easier to explain what Phase 3 proves and what it intentionally leaves for later.
- Verification:
  - [x] Human approved marking the checkpoint done.
  - [x] Gaps were explained.
  - [x] Code-specific question or walkthrough completed.
  - [x] Quiz or walkthrough completed.
- Status: verified

### 2026-06-08 - Plan Phase 4 Local Break Scheduling

- Task: Create Phase 4 planning docs for local break scheduling.
- Problem understanding:
  - [ ] Phase 4 should follow `docs/phases.md`, where Phase 4 is Break Scheduling.
  - [ ] The older `AGENTS.md` future-phase summary names backend/auth as Phase 4, but backend/auth belongs to Phase 5 in `docs/phases.md`.
  - [ ] Break scheduling should build on assigned local shift data without adding backend, auth, realtime, deep links, push notifications, offline sync, drag-and-drop, tablet layout, or AI.
- Solution understanding:
  - [ ] `docs/phase-4/user-stories.md` defines local break scheduling stories and acceptance criteria.
  - [ ] `docs/phase-4/data-model.md` documents optional active-shift break schedule state, entries, warnings, and derived views.
  - [ ] `docs/phase-4/mobile-design.md` documents the phone-first UI direction for break inputs, schedule review, warnings, floor board badges, and simulated nurse break display.
  - [ ] `docs/phase-4/screens.md` maps the Floor Board, Break Schedule, and Simulated Nurse Assignment changes.
  - [ ] `docs/phase-4/tasks.md` orders small implementation tasks with manual validation checks and marks only planning Task 0.1 done.
- Broader context:
  - [ ] Phase 4 connects staffing assignments to practical break planning while staying local-first.
  - [ ] Break schedule state belongs to the active shift, not saved floor templates.
  - [ ] Phase 4 should preserve Phase 1 assignment, Phase 2 persistence, and Phase 3 simulated nurse request behavior.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: pending

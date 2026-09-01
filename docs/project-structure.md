# Project Structure

This structure is for the actual NurseFlow app described in `docs/product-spec.md`. Phase folders in `docs/` describe planning and scope, but app code in `src/` should use stable folders that can grow across phases.

The app now follows the React Native folder responsibilities from the referenced DEV guide: assets, components, screens, navigation, store, hooks, services, helpers, and utils. Because this is an Expo Router app, `src/app/` stays as the route registry and points to screen files.

NurseFlow starts as a local charge nurse prototype, then grows toward the full product: charge nurse workflows, regular nurse views, auth, backend persistence, realtime collaboration, invite links, push notifications, offline resilience, drag-and-drop overrides, sharing, and tablet polish.

## Current Folders

- `assets/`
  - App images, icons, and other static files.

- `src/app/`
  - Expo Router screens and layouts.
  - Keep route files here, such as `index.tsx` and future screen routes.
  - Route files should stay thin and export the matching screen from `src/screens/`.

- `src/components/`
  - Reusable UI pieces shared across screens.
  - Examples: buttons, section headers, status chips, form rows.

- `src/screens/`
  - Full route-level UI screens.
  - Screens compose reusable components and own screen-specific styles.

- `src/navigation/`
  - Navigation-specific configuration when a task needs it.
  - Expo Router handles the current route setup, so this folder is intentionally light.

- `src/store/`
  - Shared app state containers when local screen state is no longer enough.
  - The server workspace uses one provider-scoped Zustand store so screens can
    subscribe to individual fields while provider unmount still owns session
    isolation and realtime cleanup.
  - Server mutation actions return promises, while the screen or dialog that
    starts an operation owns its pending and error UI state.
  - Small auth, notification-routing, and workflow-draft contexts remain React
    Context because their update patterns do not currently justify migration.

- `src/hooks/`
  - Reusable custom React hooks.
  - Add hooks here after logic becomes shared or repeated.

- `src/services/`
  - External or platform service wrappers.
  - Do not add backend, auth, realtime, push notifications, or deep links in Phase 1.

- `src/helpers/`
  - Helper functions that may involve side effects.
  - Future examples: storage helpers or platform helpers.

- `src/utils/`
  - Pure constants and deterministic helper functions.
  - Examples: workflow route definitions, screen names, validation helpers, assignment helpers, date/time formatters.

- `src/theme/`
  - Shared visual tokens.
  - Examples: colors, spacing, radius, and text sizes.

## Planned Product Folders

Add feature folders only when a task needs them:

- `src/features/`
  - Product workflow code when a workflow grows beyond one screen.
  - Good future feature folders:
    - `floor-templates`
    - `shift-setup`
    - `patients-acuity`
    - `assignment`
    - `floor-board`
    - `nurse-view`
    - `auth`
    - `invites`
    - `notifications`
    - `offline-sync`
    - `sharing`
  - Do not create future-phase feature folders until the current task needs them.

- `src/types/`
  - Shared TypeScript types for local app data.
  - Examples: floor templates, rooms, beds, shifts, nurses, patients, assignments, flags, and nurse views.

- `src/storage/`
  - Local persistence code.
  - Add in Phase 2 when floor templates, active shifts, and previous-shift carry-over need to survive app restarts.

## Product Domain Map

Use this map when deciding where new code belongs:

- Floor templates, rooms, beds, and doctor sides belong in `floor-templates`.
- Starting a shift, admitting side, load limits, nurses, patients, and acuity belong in `shift-setup`, `patients-acuity`, or nearby feature folders.
- Production team, room-coverage, and bed-assignment generation belongs in the
  separately deployable `optimizer-service/`. Mobile `src/utils/` keeps only
  assignment display, validation, effective-override projection, flag preview,
  and other client-owned behavior; it must not generate a baseline.
- Charge nurse board, board filters, inline flags, and workload summaries belong in `floor-board`.
- Regular nurse assignment, issue flags, and swap requests belong in `nurse-view` when that phase starts.
- Login, signup, sessions, real roles, backend persistence, realtime updates, invite links, push notifications, offline queues, sharing, and tablet layout are future-phase areas. Add their folders only when those phases begin.

## Phase 9 Assignment Boundary

- `optimizer-service/` owns normalization, OR-Tools solving, output validation,
  and protected atomic finalization.
- `optimizer-service/nurseflow_optimizer/search_hint.py` supplies deterministic
  feasible-start guidance only; exact constraints, objective order, and
  independent output validation still decide whether a result may be saved.
- `optimizer-service/scripts/benchmark_maximum_floor.py` owns synthetic ceiling
  measurement. The supported optimizer ceiling is 25 rooms, 50 beds, and 12
  nurses; larger server snapshots fail normalization before model construction.
- `src/services/optimizerRepository.ts` is the only mobile request boundary for
  both initial assignment and reruns.
- `src/store/serverWorkspaceStore.ts` refreshes the authoritative Supabase
  workspace after saved or stale optimizer outcomes, while
  `src/store/ServerWorkspaceContext.tsx` owns provider and realtime lifecycle.
- Mobile screens never calculate or submit a complete assignment result.
- Manual move previews continue to use the committed baseline plus active
  overrides and do not regenerate the baseline.

## Rule Of Thumb

Start simple. Add a folder when there is a real file that belongs there, not before. If code is only used by one screen, keep it close to that screen until it becomes shared.

For Phase 1, prefer local, plain TypeScript and React patterns. Do not introduce backend, auth, realtime, push notifications, deep links, invite links, offline sync, drag-and-drop, AI, sharing, or tablet layout folders early.

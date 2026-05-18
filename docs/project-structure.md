# Project Structure

This structure is for the actual NurseFlow app described in `docs/product-spec.md`. Phase folders in `docs/` describe planning and scope, but app code in `src/` should use stable folders that can grow across phases.

NurseFlow starts as a local charge nurse prototype, then grows toward the full product: charge nurse workflows, regular nurse views, break scheduling, auth, backend persistence, realtime collaboration, invite links, push notifications, offline resilience, drag-and-drop overrides, sharing, and tablet polish.

## Current Folders

- `src/app/`
  - Expo Router screens and layouts.
  - Keep route files here, such as `index.tsx` and future screen routes.
  - Routes should stay thin. Put most logic in feature, state, or utility files once a screen grows.

- `src/constants/`
  - Shared app constants that are not styling.
  - Examples: screen names, app labels, simple option lists.

- `src/theme/`
  - Shared visual tokens.
  - Examples: colors, spacing, radius, and text sizes.

## Planned Folders

Add these only when a task needs them:

- `src/components/`
  - Reusable UI pieces shared across screens.
  - Examples: buttons, section headers, status chips, form rows.

- `src/features/`
  - Product workflow code when a workflow grows beyond one screen.
  - Good future feature folders:
    - `floor-templates`
    - `shift-setup`
    - `patients-acuity`
    - `assignment`
    - `floor-board`
    - `nurse-view`
    - `break-scheduling`
    - `auth`
    - `invites`
    - `notifications`
    - `offline-sync`
    - `sharing`
  - Do not create future-phase feature folders until the current task needs them.

- `src/types/`
  - Shared TypeScript types for local app data.
  - Examples: floor templates, rooms, beds, shifts, nurses, patients, assignments, flags, nurse views, break schedules.

- `src/state/`
  - Shared app state containers.
  - Phase 1 should use simple React state or a beginner-friendly reducer.
  - Zustand or Redux Toolkit can be considered later if the app state becomes too hard to pass through screens.

- `src/storage/`
  - Local persistence code.
  - Add in Phase 2 when floor templates, active shifts, and previous-shift carry-over need to survive app restarts.

- `src/services/`
  - External or platform service wrappers.
  - Future examples: backend API, realtime client, push notifications, deep link handling, native sharing.
  - Do not add service wrappers in Phase 1.

- `src/utils/`
  - Small helper functions with no React UI.
  - Examples: local ID helper, validation helpers, census calculations, deterministic assignment helpers, date/time helpers.

## Product Domain Map

Use this map when deciding where new code belongs:

- Floor templates, rooms, beds, and doctor sides belong in `floor-templates`.
- Starting a shift, admitting side, load limits, nurses, patients, and acuity belong in `shift-setup`, `patients-acuity`, or nearby feature folders.
- Balanced teams, room coverage, bed assignments, deterministic tie-breakers, and assignment flags belong in `assignment`.
- Charge nurse board, board filters, inline flags, and workload summaries belong in `floor-board`.
- Regular nurse assignment, issue flags, and swap requests belong in `nurse-view` when that phase starts.
- Break generation and break visibility belong in `break-scheduling`.
- Login, signup, sessions, real roles, backend persistence, realtime updates, invite links, push notifications, offline queues, sharing, and tablet layout are future-phase areas. Add their folders only when those phases begin.

## Rule Of Thumb

Start simple. Add a folder when there is a real file that belongs there, not before. If code is only used by one screen, keep it close to that screen until it becomes shared.

For Phase 1, prefer local, plain TypeScript and React patterns. Do not introduce backend, auth, realtime, push notifications, deep links, invite links, offline sync, drag-and-drop, AI, sharing, or tablet layout folders early.

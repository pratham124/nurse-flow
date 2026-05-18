# Phase 1 Setup Notes

Phase 1 is a local-only charge nurse prototype. It runs on one device and uses local app state only.

## Scope Guardrails

Phase 1 includes the setup needed for:

- local floor templates
- local shift setup
- local nurse, patient, acuity, and assignment workflows
- local floor board and assignment flags

Phase 1 does not include planned screens or implementation for:

- login, signup, or user accounts
- invite links or regular nurse join flows
- realtime status or multi-device collaboration
- push notifications or notification inboxes
- deep links
- drag-and-drop assignment override
- offline sync queues
- AI assignment
- break scheduling
- board sharing
- tablet-specific layout

These guardrails match `docs/phase-1/tasks.md`, `docs/phase-1/screens.md`, and `docs/phase-1/mobile-design.md`.

## Folder Structure

Use `docs/project-structure.md` for the app folder structure. Phase 1 docs explain what to build now, but the source folders should be named for the real app so they can continue into later phases.

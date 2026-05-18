# AGENTS.md

## Project

NurseFlow is a React Native mobile app built with Expo and TypeScript.

The app helps hospital charge nurses manage:

- floor setup
- shift assignments
- patient acuity
- nurse workloads
- break scheduling
- nurse-facing shift views

## Goal

Help me build this project while learning. Do not over-automate or generate the full app at once.

## Learning Rules

- Plan before coding.
- Explain important concepts before major code changes.
- Implement one feature at a time.
- Do not jump ahead to future phases.
- Keep code readable and beginner-friendly.
- Avoid extra libraries unless clearly justified.
- Prefer simple local-first solutions before adding infrastructure.
- Never add code I cannot reasonably understand and explain.

## Workflow

Use this order:

1. Product spec review
2. Phase breakdown
3. User stories
4. Data model
5. Mobile design
6. Screens / wireframes
7. Task list
8. Implementation
9. Manual testing
10. Refactor

## Scope Control

- Follow the spec, but implement it in phases.
- Do not implement the full NurseFlow spec at once.
- For Phase 1, build a local charge nurse prototype only.
- Do not add backend, auth, real-time sync, push notifications, deep links, drag-and-drop, offline sync, or AI unless the current phase explicitly requires it.
- If something is ambiguous, choose the simplest local-first version.
- Preserve future architecture notes, but do not implement future-phase infrastructure early.

## Phase 1 Local MVP

Phase 1 proves the core charge nurse workflow locally on one device.

Include:

- Create a floor template
- Add rooms and beds
- Define doctor sides
- Start a shift from a floor template
- Add nurses
- Add patients
- Set bed-level acuity
- Assign rooms to nurses
- Set max patient load per nurse
- Run deterministic auto-assignment locally
- Show charge nurse floor board
- Show imbalance / unassigned-bed flags
- Save data locally if needed

Exclude:

- Email/password auth
- Real accounts
- Backend/database
- WebSockets or Supabase Realtime
- Push notifications
- Deep links
- Regular nurse invite flow
- Multi-device collaboration
- Drag-and-drop manual override
- Offline write queue/sync
- AI
- Tablet layout

## Future Phases

Phase 2:

- Local persistence
- Reuse floor templates
- Carry-over suggestions from previous shift

Phase 3:

- Local regular nurse view
- Simulated role switching
- Mock issue flags and swap requests

Phase 4:

- Backend
- Auth
- Server-side persistence
- Real charge nurse / regular nurse roles

Phase 5:

- Real-time collaboration
- Nurse invite links
- Deep linking

Phase 6:

- Push notifications
- Offline resilience and sync queue

Phase 7:

- Drag-and-drop manual override
- Share board snapshot
- Tablet layout
- UI polish

## Done Criteria

A task is done only when:

- The app runs without errors.
- The feature can be tested manually.
- Relevant acceptance criteria are met.
- Code changes are explained clearly.
- The implementation stays within the current phase.
- I can explain the changed code myself.

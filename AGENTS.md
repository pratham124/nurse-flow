# AGENTS.md

## Project

NurseFlow is a React Native mobile app built with Expo and TypeScript.

The app helps hospital charge nurses manage:

- floor setup
- shift assignments
- patient acuity
- nurse workloads
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

## Repository Expectations

- Use modern conventions (e.g., fetch latest docs via MCP server).
- Prefer named `ComponentNameProps` types for React component props so component boundaries stay easy to read and explain. Reserve inline object prop types for tiny non-component callbacks or helpers.

## Development And Testing Skills

- For any new React Native, Expo, TypeScript, navigation, state, component, styling, or app architecture development task, load and use `@building-react-native-apps` before planning or implementation when that skill is available.
- For any new testing, quality check, debugging, regression, test setup, lint, or verification task, load and use `@testing-react-native-apps` before changing tests or running validation when that skill is available.
- If either skill is unavailable in the current Codex session, say that briefly, then continue with the best local project guidance in this file.
- Keep the skill guidance subordinate to the learning rules, workflow order, Phase 1 scope, and done criteria in this file.

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
11. Understanding checkpoint

## Understanding Checkpoint

After finishing each task, add a short teaching checkpoint before considering the work done. Use `$teaching-checkpoint` when that skill is available.

Use `docs/understanding-checklist.md` as the running checklist of what the human should understand. Keep it incremental and tied to the task just completed.

For each completed task, verify understanding in three layers:

- Problem: what problem existed, why it existed, and what branches or alternatives were considered.
- Solution: what changed, why that solution was chosen, key design decisions, and important edge cases.
- Broader context: why the change matters, what it affects now, and what future work it may influence.

Before explaining everything, ask the human to restate her current understanding first. Then fill in gaps, answer questions, and adjust the explanation level when requested, such as ELI5, ELI14, or intern-level.

Use short open-ended or multiple-choice questions to check understanding. Include at least one code-specific question that references the changed file, function, state field, or helper, and asks the human to read or predict code behavior. If an `AskUserQuestion` tool is available, use it for quizzes and do not reveal the answer until after the human responds. If that tool is unavailable, ask concise questions directly in chat.

The session should not end until the human has demonstrated understanding of the checklist items for the completed task.

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
- The relevant task tracking document is updated with a done marker for the completed task.
- The understanding checkpoint is completed and `docs/understanding-checklist.md` is updated.

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

## Active Go Migration Handoff

On the `codex/go-migration` branch, `docs/go-migration/plan.md` defines the
active migration phase. For Go migration work, it supersedes the older Phase 1
scope below.

When the user says **"Continue the Go migration"** or an equivalent short
request:

1. Read `docs/go-migration/plan.md` for the current task and progress.
2. Inspect the branch, working tree, and files from the current task before
   editing.
3. Resume the first ready ticket in the approved milestone identified by the
   plan; preserve completed work and the milestone boundary.
4. Before implementing a new milestone, load the `grill-with-docs` skill. Use
   its `grilling` and `domain-modeling` workflow to settle decisions that are not
   already recorded and persist warranted terminology or architecture decisions.
   Do not reopen decisions the user already settled or create documentation for
   trivial choices.
5. After implementation, explain the change and verification results. Do not
   require quizzes, understanding checkpoints, or updates to the historical
   understanding checklist as a condition of completion.
6. Follow the milestone execution and learning protocol in the migration plan;
   it governs Go migration batching instead of the older one-feature rule.
7. Load the locally installed Supabase skills before relevant Supabase or PostgreSQL work.

## Learning Rules

- Plan before coding.
- Explain important concepts before major code changes.
- Implement one feature at a time.
- Do not jump ahead to future phases.
- Keep code readable and beginner-friendly.
- Prefer maintained, established libraries for standard functionality (such as UUID generation) when they reduce custom code and improve readability. Keep dependencies focused and explain why each is needed.
- Prefer simple local-first solutions before adding infrastructure.
- Never add code I cannot reasonably understand and explain.

## Repository Expectations

- Use modern conventions (e.g., fetch latest docs via MCP server).
- Prefer named `ComponentNameProps` types for React component props so component boundaries stay easy to read and explain. Reserve inline object prop types for tiny non-component callbacks or helpers.

## Tradeoff Log

Keep a running log of tradeoffs in `docs/tradeoffs.md` (create it if missing). The file is gitignored and stays local: never commit it, and don't reference it from committed docs. Its purpose is interview prep: I use it to answer questions like "what tradeoffs did you make on this project?" When we choose one approach over a real alternative (a library, a data shape, a simplification, something deferred, a known limitation we accept), add an entry in the same turn:

- **Date and topic**
- **Problem:** what we needed to solve, and the constraints that mattered
- **Chose:** what we did
- **Over:** the alternative(s) we passed on
- **Why:** the reasoning
- **Cost:** what we gave up
- **Would change if:** what would make a different choice better (scale, more users, a team, new requirements)

Write each entry in plain, specific language I could say out loud in an interview, tied to this project's details, with no jargon I couldn't explain.

Newest entries go at the top. Skip trivial choices: log a tradeoff only if a future reader might reasonably ask "why did we do it this way?" and the answer isn't obvious from the code. Naming, formatting, and picking between near-equivalent options don't qualify. Big architecture decisions still get an ADR in `docs/adr/`; link the ADR from the log entry.

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
- The relevant task tracking document is updated with a done marker for the completed task.

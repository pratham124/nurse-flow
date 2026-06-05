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
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

## Running Items

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

### 2026-06-05 - Add Room Delete Swipe Cue

- Task: Make hidden room deletion more discoverable on the Rooms and Beds screen.
- Problem understanding:
  - [ ] Room deletion already existed behind a swipe gesture.
  - [ ] The UI did not clearly hint that the room row could be swiped to reveal delete.
  - [ ] Hidden gestures are easy to miss, especially in a beginner-tested mobile prototype.
- Solution understanding:
  - [ ] Each room row now shows a small visual cue with a chevron and trash icon.
  - [ ] The cue points toward the existing right-swipe gesture that reveals the left-side remove action.
  - [ ] The existing `SwipeRevealAction` behavior stayed unchanged.
  - [ ] No new library or future-phase interaction pattern was added.
- Broader context:
  - [ ] This improves discoverability without making delete the main room action.
  - [ ] It keeps destructive behavior guarded by the existing swipe reveal pattern.
  - [ ] It supports Phase 1 manual testing because testers can notice how room removal works.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-05 - Add Local End Shift Action

- Task: Add a confirmed local-only way to end the active shift.
- Problem understanding:
  - [ ] Phase 1 had a way to start and resume an active shift, but no deliberate way to clear it.
  - [ ] Restarting the app should not be the only way to leave an active-shift state.
  - [ ] Ending a shift in Phase 1 should not imply history, archiving, backend persistence, or sync.
- Solution understanding:
  - [ ] Local Workspace now shows an `End shift` action when an active shift exists.
  - [ ] The action opens a confirmation dialog before clearing shift data.
  - [ ] Confirming clears `activeShift`, `draftFloorTemplate`, and `isEditingActiveShiftTemplate`.
  - [ ] Saved `floorTemplates` are preserved so the user can start another shift from the same template.
  - [ ] `docs/phase-1/tasks.md` now includes completed Task 4.5.
- Broader context:
  - [ ] This closes a basic lifecycle gap in the local prototype.
  - [ ] It keeps the behavior Phase 1-sized: local cleanup, not shift history.
  - [ ] The active shift is temporary working state; the floor template is reusable setup data.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-05 - Complete Phase 1 Task 9.x Manual Pass

- Task: Verify and mark Phase 1 tasks 9.1 through 9.5 complete.
- Problem understanding:
  - [ ] The 9.x tasks are not new feature tasks; they prove the existing Phase 1 workflow works end to end.
  - [ ] A passing typecheck alone would not prove the app can be manually used from empty state to floor board.
  - [ ] Scope leaks can exist in config or dependencies even when screen code looks local-only.
- Solution understanding:
  - [ ] The happy path was tested through the exported web app in the browser.
  - [ ] Validation cases were checked for blank floor name, duplicate floor name, duplicate room, missing doctor side, invalid nurse max load, invalid patient age, and missing acuity.
  - [ ] Assignment edge cases were checked against the real assignment utilities with crafted local shifts.
  - [ ] Unused `expo-linking`, `expo-web-browser`, app scheme config, and a dead `hasPatientInfo` variable were removed.
  - [ ] `docs/phase-1/tasks.md` now marks tasks 9.1 through 9.5 done.
- Broader context:
  - [ ] Phase 1 is now validated as a local charge nurse prototype rather than only a collection of implemented screens.
  - [ ] Removing scope leaks keeps future-phase concepts from silently entering Phase 1.
  - [ ] The readability cleanup makes the patient/acuity screen easier for a beginner to explain.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

### 2026-06-05 - Add Understanding Checkpoint Skill And Workflow

- Task: Add a required post-task teaching checkpoint to the repo instructions and create a reusable `$teaching-checkpoint` Codex skill.
- Problem understanding:
  - [ ] The previous workflow ended at refactor and did not explicitly require teaching verification.
  - [ ] The done criteria required explanations, but did not define how to confirm the human could explain the work herself.
  - [ ] A repo-only rule makes the checkpoint required for NurseFlow, but does not make the method reusable across projects.
  - [ ] A skill-only solution would be reusable, but future NurseFlow sessions might not reliably trigger it unless `AGENTS.md` anchors the requirement.
  - [ ] The checklist template and process can be reusable, but the actual running checklist should stay with the project.
- Solution understanding:
  - [ ] `AGENTS.md` now includes `Understanding checkpoint` as workflow step 11.
  - [ ] `AGENTS.md` tells Codex to use `$teaching-checkpoint` when that skill is available.
  - [ ] `C:\Users\psito\.codex\skills\teaching-checkpoint\SKILL.md` defines the reusable teaching workflow and checklist template.
  - [ ] The new checkpoint asks for problem, solution, and broader-context understanding.
  - [ ] The checklist file creates a durable place to track what was taught and verified.
  - [ ] If `AskUserQuestion` is unavailable, direct chat questions are the fallback.
  - [ ] The official skill validator could not run because the available Python runtimes do not have PyYAML; the frontmatter and TODO checks were inspected manually.
- Broader context:
  - [ ] Future coding tasks should close only after implementation, validation, task tracking, and understanding verification.
  - [ ] This supports the project goal of learning without over-automating.
  - [ ] The skill makes the teaching checkpoint portable to other projects, while `AGENTS.md` keeps it mandatory here.
  - [ ] The project checklist preserves task-specific learning history in the repo instead of hiding it inside a global skill.
  - [ ] The checklist should stay concise so it helps learning instead of becoming busywork.
- Verification:
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

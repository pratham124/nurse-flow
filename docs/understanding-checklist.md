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

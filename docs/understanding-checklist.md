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
  - [ ] `src/services/localStorageRepository.ts` defines a `LocalStorageAdapter` interface.
  - [ ] `src/services/localStorageRepository.ts` defines a `LocalStorageRepository` with load, save, and clear methods.
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
  - [ ] `src/services/localStorageRepository.ts` now has a small persisted-state type guard.
  - [ ] `src/services/localStorageRepository.ts` now parses saved JSON through `parsePersistedLocalAppState`.
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
  - [ ] Human restated understanding first.
  - [ ] Gaps were explained.
  - [ ] Quiz or walkthrough completed.
- Status: pending

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

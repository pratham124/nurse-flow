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
  - [ ] Code-specific question or walkthrough completed.
  - [ ] Quiz or walkthrough completed.
- Status: in progress

## Running Items

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

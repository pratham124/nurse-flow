# NurseFlow Phase 3 User Stories

These user stories cover Phase 3 only: a local simulation of the regular nurse experience, simulated role switching, mock issue flags, and mock swap requests.

Phase 3 preserves the Phase 1 charge nurse workflow and the Phase 2 local persistence and carry-over behavior. It does not include real auth, real nurse accounts, deep links, invite links, push notifications, backend, realtime collaboration, multi-device nurse joins, offline sync, break scheduling, drag-and-drop assignment override, board sharing, tablet layout, or AI.

## Story 1: Switch Between Local Roles

As a tester, I want to switch between the charge nurse view and a simulated regular nurse view on one device so I can understand both sides of the shift without adding accounts or invite links.

### Acceptance Criteria

- A local role switcher is available after an active shift has assigned nurses.
- The tester can choose `Charge nurse` or `Regular nurse`.
- Choosing `Regular nurse` requires selecting one nurse from the active shift.
- The selected simulated nurse is stored only as local UI state.
- Returning to `Charge nurse` shows the existing charge nurse workflow and full floor board.

### Validation and Edge Cases

- If no active shift exists, the role switcher should not show a regular nurse option.
- If the active shift has no nurses, the regular nurse option should be disabled or explain that nurses must be added first.
- If the selected nurse is removed from the shift, the app should clear the simulated nurse selection.
- Role switching must not create login, profile, invite, or server concepts.

## Story 2: Show Only the Selected Nurse's Assignment

As a regular nurse in the local simulation, I want to see only my assigned rooms, beds, patients, and acuity so the view matches what a real nurse should eventually see.

### Acceptance Criteria

- The simulated nurse view shows the selected nurse's name, license type, and experience level.
- The view shows the selected nurse's generated room coverage.
- The view shows only beds assigned to the selected nurse.
- Each assigned bed shows room label, bed label, patient info when present, and acuity color.
- Unassigned beds and other nurses' assigned beds are hidden from the simulated nurse view.
- Empty assigned beds can appear as empty if they are part of the selected nurse's assignment.

### Validation and Edge Cases

- If local assignment has not been run, show a clear empty state: `Run assignment before opening nurse view.`
- If the selected nurse has no assigned beds, show `No assigned beds for this nurse yet.`
- If a bed assignment references a missing bed or nurse, skip the invalid row and avoid crashing.
- The nurse view should read from the same local active shift data used by the charge nurse board.

## Story 3: Submit a Mock Issue Flag

As a regular nurse in the local simulation, I want to flag a concern about my assignment so the charge nurse can review it locally.

### Acceptance Criteria

- The simulated nurse can open a short issue form from the nurse view.
- The form includes an issue message.
- The nurse can optionally attach the issue to one of their assigned beds.
- Submitting the issue creates a local mock issue flag.
- The charge nurse can see the mock issue flag on the existing Flags screen or a Phase 3-updated flag review area.
- The mock issue includes nurse name, message, timestamp, and optional bed context.

### Validation and Edge Cases

- Blank issue messages are blocked.
- A nurse cannot submit an issue for a bed that is not assigned to them.
- Submitting an issue should not trigger push notifications or network calls.
- Mock issues are local shift data, not audit history or server records.

## Story 4: Submit a Mock Swap Request

As a regular nurse in the local simulation, I want to request a patient swap so the charge nurse can practice reviewing swap requests locally.

### Acceptance Criteria

- The simulated nurse can request a swap from one of their assigned beds.
- The request includes the source bed and a short reason.
- The request can optionally include a requested target nurse or target bed if the UI can keep that simple.
- Submitting the request creates a local mock swap request with status `pending`.
- The charge nurse can see pending mock swap requests.
- The request shows requesting nurse, source bed, reason, timestamp, and status.

### Validation and Edge Cases

- A swap request cannot be submitted without a source bed.
- A swap request cannot use a source bed outside the selected nurse's assignment.
- Optional target details should not require drag-and-drop, realtime collaboration, or a complex reassignment workflow.
- Submitting a swap request should not change assignments until the charge nurse accepts it.

## Story 5: Review Mock Requests as Charge Nurse

As a charge nurse, I want to review mock issue flags and swap requests from the simulated nurse view so I can understand nurse-to-charge communication before building real multi-device features.

### Acceptance Criteria

- The charge nurse can open a review area for local nurse messages.
- Mock issue flags and mock swap requests are clearly separated or labeled.
- Pending swap requests can be accepted or declined.
- Accepted and declined requests remain visible with their final status during the active shift.
- The charge nurse can return to the floor board without losing local request state.

### Validation and Edge Cases

- If there are no mock requests, show a useful empty state.
- The review UI should use local language such as `Mock request` or `Local simulation`.
- It should not mention push notifications, live nurse devices, server queues, or invite links.
- Existing assignment imbalance and unassigned-bed flags should continue to work.

## Story 6: Accept or Decline a Mock Swap Request Locally

As a charge nurse, I want accepting or declining a mock swap request to update local state so the request has a clear outcome.

### Acceptance Criteria

- Declining a request changes its status to `declined`.
- Accepting a request changes its status to `accepted`.
- Phase 3 acceptance may record the decision without automatically moving beds.
- If a simple local reassignment is implemented, it must update the bed assignment deterministically and raise existing imbalance flags when needed.
- The accepted or declined status is visible to both the charge nurse and the simulated requesting nurse.

### Validation and Edge Cases

- A request that is already accepted or declined cannot be accepted or declined again.
- If the source bed no longer exists, show the request as no longer actionable.
- If the requesting nurse no longer exists, show the saved requester name and prevent action.
- Do not add drag-and-drop assignment override in Phase 3.

## Story 7: Preserve Previous Phase Behavior

As a learner building NurseFlow, I want Phase 3 to layer local nurse simulation on top of existing local state so previous phase behavior remains understandable.

### Acceptance Criteria

- Phase 1 floor setup, assignment, board, and flags still work.
- Phase 2 local persistence, active shift restore, template reuse, and carry-over still work.
- Phase 3 request state belongs to the active shift or a small local UI boundary.
- Ending a shift clears active local simulation state.
- No new dependencies are added unless a clear beginner-friendly reason is documented.

### Validation and Edge Cases

- Restoring an active shift should not require a selected simulated nurse.
- A fresh app with no saved data should still show the local workspace empty state.
- Phase 3 must not make the app feel like it has real nurse accounts or connected devices.


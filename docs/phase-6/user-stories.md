# NurseFlow Phase 6 User Stories

These user stories cover Phase 6 only: realtime collaboration and nurse invite links after Phase 5 backend, auth, and server persistence are in place.

Phase source note: `docs/phases.md` defines Phase 6 as Realtime Collaboration and Nurse Invites. Push notifications, offline write queues, conflict resolution, drag-and-drop assignment override, AI, board sharing, and tablet layout belong to later phases and are intentionally excluded here.

Phase 6 preserves the Phase 1 charge nurse assignment workflow, Phase 2 carry-over behavior through server snapshots, Phase 3 nurse-facing request concepts, and Phase 5 auth/server persistence. It adds live multi-device participation for the active shift.

## Story 1: Enable Realtime Active Shift Updates

As a charge nurse, I want active shift changes to appear on connected devices without manual refresh so everyone sees the current assignment picture.

### Acceptance Criteria

- Connected charge nurse and nurse devices receive active shift updates while the app is open.
- Realtime updates cover the current active shift snapshot, nurse-scoped assignment views, request status, and assignment flags.
- Server state remains the source of truth after each write.
- Existing Phase 5 request-then-refresh behavior remains valid as a fallback for direct user actions.
- The UI shows a simple connection state such as connecting, live, reconnecting, or disconnected.
- Disconnected users are not promised offline write support in Phase 6.

### Validation and Edge Cases

- If one device updates patient acuity, another open device sees the changed board state.
- If a realtime message is missed, the app can recover by refetching the current server shift.
- If the connection drops, the app shows a readable disconnected state and avoids pretending changes are live.
- Do not add push notifications, background delivery, offline queues, conflict resolution, or local-first sync in this story.

## Story 2: Generate Nurse Invite Links

As a charge nurse, I want to generate an invite link for a specific nurse so that nurse can join the active shift from their own device.

### Acceptance Criteria

- The charge nurse can generate an invite link for one nurse in the active shift.
- The link is tied to the active shift and the target nurse record.
- The link can be copied or shared using the device share sheet.
- The link does not expose the full shift data by itself.
- Regenerating a link invalidates the previous active link for that nurse.
- Invite links expire when the shift ends.

### Validation and Edge Cases

- A link cannot be generated when there is no active shift.
- A link cannot be generated for a stale nurse that no longer exists in the active shift.
- A regenerated link should make the older link fail with a clear message.
- Ending the shift should make all links for that shift fail.
- Do not add push notification delivery or SMS automation. Sharing uses normal user-controlled copy/share behavior only.

## Story 3: Join a Shift From an Invite Link

As a regular nurse, I want to open an invite link and join my nurse assignment so I can view my current rooms, beds, patients, acuity, and requests on my own device.

### Acceptance Criteria

- Opening a valid invite link routes the user into a join flow.
- If the user is signed out, the app asks them to sign in or create an account before joining.
- After successful join, the app creates or updates the shift-specific nurse access record for that signed-in profile.
- The joined nurse can see only their nurse-scoped assignment view.
- The joined nurse cannot see the full charge nurse workspace, floor templates, or full board.
- A user already participating in another active shift sees a safe explanation instead of silently switching contexts.

### Validation and Edge Cases

- A valid unused invite link creates nurse access for the signed-in nurse.
- A link for an ended shift shows an expired state.
- A link for a deleted nurse or missing active shift shows a recovery state.
- A signed-in charge nurse account that owns an active shift cannot also join another active shift without leaving or ending the current participation.
- Do not add regular nurse permanent roles; nurse behavior remains shift-specific.

## Story 4: Keep Joined Nurse Assignments Live

As a joined nurse, I want assignment updates to appear while I am viewing my nurse screen so I do not need to ask the charge nurse to refresh or resend information.

### Acceptance Criteria

- Joined nurses receive live updates to their nurse-scoped assignment view.
- Assignment changes, patient changes, acuity changes, and request status changes update in the nurse view.
- The nurse view remains scoped to the joined nurse's access record after each update.
- If the nurse's access is removed or the shift ends, the nurse sees a safe ended or access-removed state.
- Live updates should not expose other nurses' full assignments.

### Validation and Edge Cases

- When the charge nurse reruns assignment, the affected joined nurse sees updated beds.
- When the charge nurse resolves a swap request, the requesting nurse sees the status change.
- If the nurse is no longer part of the active shift, the view exits to a clear access state.
- Do not add background push notifications for updates in this story.

## Story 5: Show In-App Live Requests to the Charge Nurse

As a charge nurse, I want issue flags and swap requests from joined nurses to appear in-app while the shift is active so I can respond during the shift.

### Acceptance Criteria

- Joined nurses can submit issue flags and swap requests through the existing nurse-facing request model.
- Charge nurse request views update in-app without manual refresh while connected.
- Pending, accepted, and declined request states remain visible.
- Accepting or declining a swap request updates the server and appears live for the requesting nurse.
- Assignment data does not change unless an existing approved workflow already changes it.

### Validation and Edge Cases

- A request submitted from a nurse device appears on the charge nurse device.
- A request resolution from the charge nurse appears on the nurse device.
- Duplicate submits are prevented or clearly handled.
- The charge nurse can still reload the shift if realtime reconnects.
- Do not send push notifications in Phase 6; these are foreground in-app updates only.

## Story 6: Regenerate and Reshare Nurse Links

As a charge nurse, I want to regenerate and reshare a nurse's invite link if the original link is lost or sent to the wrong person.

### Acceptance Criteria

- The charge nurse can see which nurses have an active invite link and which nurses have already joined.
- The charge nurse can regenerate an invite link for one nurse.
- Regenerating a link invalidates the previous link for that nurse.
- The nurse access record remains scoped to the same active shift and nurse.
- The UI explains that links expire when the shift ends.

### Validation and Edge Cases

- A nurse can join with the newest regenerated link.
- The previous regenerated link fails safely.
- Already joined nurses should not lose access simply because a link is regenerated unless the charge nurse explicitly removes access in a later task.
- Do not add a full user-management admin panel in Phase 6.

## Story 7: Preserve Previous Phase Behavior

As a learner building NurseFlow, I want realtime and invite behavior added without breaking the proven workflows from earlier phases.

### Acceptance Criteria

- Phase 1 floor setup, assignment, board, census, imbalance flags, and unassigned-bed flags still work.
- Phase 2 carry-over snapshots still work through server-backed previous shift data.
- Phase 3 nurse request behavior still maps to active-shift request records.
- Phase 5 auth, sessions, server templates, server active shifts, and nurse-scoped access boundaries remain intact.
- Realtime subscriptions are cleaned up when leaving a shift or signing out.

### Validation and Edge Cases

- Signing out clears active realtime listeners.
- Ending a shift expires invites and removes live shift participation.
- Server authorization still prevents joined nurses from loading the full charge board.
- Existing non-realtime save/retry states still help when a direct mutation fails.
- Do not add later-phase features while doing compatibility fixes.

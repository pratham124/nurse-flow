# NurseFlow Build Phases

NurseFlow should be built in small, testable phases. Each phase should prove one clear product capability before moving to the next one.

Phase 1 is intentionally local and charge-nurse-only. Backend, auth, realtime collaboration, push notifications, deep links, drag-and-drop, offline sync, and AI are future work.

## Phase 1: Local Charge Nurse Prototype

### Goal

Prove the core charge nurse workflow on one device using local in-memory state or very simple local storage if needed.

### Included Features

- Create a floor template.
- Add rooms to the floor template.
- Add beds to rooms.
- Define doctor sides.
- Assign rooms to doctor sides.
- Start a shift from a floor template.
- Add nurses for the shift.
- Add patients to beds.
- Set bed-level acuity: green, yellow, or red.
- Assign rooms to nurses.
- Set max patient load per nurse.
- Run deterministic local auto-assignment.
- Show a charge nurse floor board.
- Show census totals.
- Show imbalance flags.
- Show unassigned-bed flags.

### Excluded Features

- Email/password auth.
- Real user accounts.
- Backend or database.
- Server-side persistence.
- Realtime collaboration.
- WebSockets or Supabase Realtime.
- Push notifications.
- Deep links or invite links.
- Regular nurse invite flow.
- Regular nurse app experience.
- Multi-device collaboration.
- Drag-and-drop manual override.
- Offline sync or write queue.
- AI or external assignment services.
- Break scheduling.
- Board snapshot sharing.
- Tablet layout.

### Success Criteria

- A charge nurse can create a simple floor template.
- A charge nurse can start a shift from that template.
- A charge nurse can add nurses and patients locally.
- Beds can be marked with acuity.
- Nurses can be given assigned rooms and max patient loads.
- Auto-assignment runs deterministically without network access.
- The floor board clearly shows doctor sides, nurses, rooms, beds, acuity, and patient info.
- The app flags overloaded nurses and beds that could not be assigned.
- The feature can be manually tested on one local device.
- No Phase 1 excluded infrastructure is introduced.

## Phase 2: Local Persistence and Reuse

### Goal

Make the local prototype reusable across app launches and across shifts without adding backend infrastructure.

### Included Features

- Save floor templates locally.
- Reuse existing floor templates when starting a shift.
- Edit floor templates outside an active shift.
- Save active shift data locally.
- Restore the most recent active shift after closing and reopening the app.
- Store previous shift data locally.
- Show nurse carry-over suggestions from the previous shift.
- Show patient carry-over suggestions from the previous shift.
- Allow the charge nurse to accept or dismiss each carry-over suggestion.

### Excluded Features

- Backend or cloud database.
- Auth.
- Multi-device sync.
- Realtime collaboration.
- Push notifications.
- Deep links.
- Regular nurse invite flow.
- Offline write queue.
- AI.

### Success Criteria

- Floor templates remain available after the app restarts.
- An active shift can be restored after the app restarts.
- A new shift can be started from a saved template.
- Previous-shift nurses and patients appear as reviewable suggestions.
- Accepted carry-over data can be edited before the new shift is confirmed.
- Local persistence is understandable and does not require server concepts.

## Phase 3: Local Nurse View Simulation

### Goal

Add a local version of the regular nurse experience without real accounts, invite links, or multi-device collaboration.

### Included Features

- Simulated role switching between charge nurse and regular nurse.
- Local regular nurse view for assigned rooms and beds.
- Regular nurse view shows patient info and bed acuity.
- Mock issue flag submission.
- Mock swap request submission.
- Charge nurse can view mock issue flags.
- Charge nurse can view mock swap requests.
- Charge nurse can accept or decline mock swap requests locally.

### Excluded Features

- Real auth.
- Real nurse accounts.
- Deep links.
- Invite links.
- Push notifications.
- Backend.
- Realtime collaboration.
- Multi-device nurse joins.
- Offline sync.
- Break scheduling.

### Success Criteria

- A tester can switch between charge nurse and regular nurse views on one device.
- A regular nurse can see only their own assignment.
- Mock issue flags and swap requests appear for the charge nurse.
- Accepting or declining a mock swap request updates local state.
- The simulation makes future real nurse flows easier to understand without implementing infrastructure early.

## Phase 4: Break Scheduling

### Goal

Add local break scheduling after the assignment workflow is stable.

### Included Features

- Enter shift start time.
- Enter floor activity level: low, moderate, or high.
- Generate suggested break times.
- Keep breaks staggered across the shift.
- Avoid sending nurses covering the same room zone on break at the same time.
- Require at least one experienced nurse per doctor side to remain active when possible.
- Allow the charge nurse to refresh the break schedule.
- Show each nurse's break time on the charge nurse floor board.
- Show each nurse's own break time in the simulated nurse view.

### Excluded Features

- Push notifications for upcoming breaks.
- Backend break storage.
- Realtime break updates across devices.
- AI-generated schedules.

### Success Criteria

- A charge nurse can generate a local break schedule.
- The schedule respects the basic safety rules from the product spec.
- Break times are visible in the appropriate charge nurse and simulated nurse views.
- The break scheduler can be manually tested with several nurse and room setups.

## Phase 5: Backend, Auth, and Server Persistence

### Goal

Introduce real accounts and server-side data only after the local product flow is proven.

### Included Features

- Choose and document the backend approach.
- Email/password signup.
- Email/password login.
- Persistent sessions.
- Server-side floor templates.
- Server-side active shifts.
- Server-side nurse and patient shift data.
- Real charge nurse and regular nurse roles.
- Basic authorization so nurses only access appropriate shift data.

### Excluded Features

- Realtime collaboration.
- Push notifications.
- Deep links.
- Offline write queue.
- Drag-and-drop manual override.
- AI.

### Success Criteria

- A charge nurse can create an account and log in.
- Session state survives app close and reopen.
- Floor templates and shifts are stored on the server.
- A regular nurse role exists in the data model.
- Access rules prevent regular nurses from seeing the full charge nurse board.
- Existing local Phase 1-4 workflows still work after server persistence is introduced.

## Phase 6: Realtime Collaboration and Nurse Invites

### Goal

Allow multiple devices to participate in the same active shift.

### Included Features

- Realtime updates for active shift data.
- Nurse invite link generation.
- Deep link handling for nurse joins.
- Invite links expire when the shift ends.
- Charge nurse can regenerate and reshare nurse links.
- Regular nurses can join a shift from their own device.
- Assignment updates appear on connected nurse devices.
- Issue flags and swap requests update in-app for the charge nurse.

### Excluded Features

- Push notifications.
- Offline write queue and conflict resolution.
- Drag-and-drop manual override.
- AI.
- Tablet layout.

### Success Criteria

- A nurse can join an active shift from an invite link.
- Multiple devices see the same active shift data.
- Updates from the charge nurse appear on nurse devices without manual refresh.
- Issue flags and swap requests appear for the charge nurse in-app.
- Invite links stop working after the shift ends.

## Phase 7: Push Notifications and Offline Resilience

### Goal

Improve reliability and awareness when users are backgrounded or temporarily disconnected.

### Included Features

- Push notifications for issue flags.
- Push notifications for swap requests.
- Push notifications for assignment updates.
- Push notifications for upcoming breaks.
- Push notifications for admissions, discharges, imbalance alerts, and unassigned beds where useful.
- Offline read access to the most recent floor board.
- Offline write queue for supported actions.
- Sync queued writes when connectivity returns.
- Basic conflict handling for queued writes.

### Excluded Features

- Drag-and-drop manual override.
- Share board snapshot.
- Tablet layout.
- AI.

### Success Criteria

- Users receive important notifications when the app is backgrounded.
- The floor board remains viewable during a connection drop.
- Supported offline changes sync when the device reconnects.
- Sync behavior is understandable and manually testable.
- Conflicts do not silently corrupt shift data.

## Phase 8: Manual Override, Sharing, and Polish

### Goal

Add advanced interaction and presentation improvements after the core system is reliable.

### Included Features

- Drag-and-drop manual assignment override.
- Inline imbalance flags after manual moves.
- Non-blocking acknowledgement of override warnings.
- Share board snapshot.
- Improved visual polish for the charge nurse floor board.
- Tablet layout.
- Responsive layout improvements.
- Accessibility review.
- Performance cleanup for larger floors.

### Excluded Features

- AI-based assignment.
- EHR or EMR integration.
- Multi-hospital admin tools.
- Automated acuity from vitals.
- Shift handoff notes unless promoted into a future phase.

### Success Criteria

- A charge nurse can manually override assignments with drag-and-drop.
- The app clearly flags risky or imbalanced manual overrides.
- The charge nurse can share a readable board snapshot.
- The app remains usable on phone screens and gains a better tablet experience.
- The UI feels polished without changing the proven core workflow.

## Future Considerations

These ideas are intentionally outside the current build phases until the core product is stable:

- EHR or EMR integration.
- Automated acuity from vitals.
- Multi-hospital admin roles.
- Shift handoff or handover notes.
- AI-assisted staffing recommendations.
- Advanced analytics across many shifts.

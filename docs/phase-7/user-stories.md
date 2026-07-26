# NurseFlow Phase 7 User Stories

These user stories cover the revised Phase 7 scope: push notifications and lightweight connection resilience after Phase 6 realtime collaboration and nurse invite links are in place.

Phase source note: `docs/phases.md` originally listed a full offline write queue for Phase 7. Based on product review, this plan narrows Phase 7 to the parts that are most useful in a hospital setting: background alerts, notification routing, clear reconnect states, and read-only access to the most recently loaded board or nurse assignment.

Phase 7 preserves the Phase 1 charge nurse assignment workflow, Phase 2 persistence and carry-over behavior, Phase 3 nurse request concepts, Phase 5 auth/server persistence, and Phase 6 realtime/invite behavior.

## Story 1: Enable Push Notifications Safely

As a signed-in nurse or charge nurse, I want to choose whether NurseFlow can send push notifications so important shift events can reach me when the app is backgrounded.

### Acceptance Criteria

- The app explains why notifications are useful before asking for device permission.
- Permission status is visible in a simple account or active-shift area.
- A signed-in device can register a push token with the server.
- Push tokens are tied to the signed-in profile and device, not to a raw active shift snapshot.
- Signing out or revoking permission makes future notifications stop for that device.
- Permission denial leaves the app usable with foreground realtime updates.

### Validation and Edge Cases

- First permission request shows clear nurse-facing copy.
- Denied permission does not block active shift use.
- Signing out removes or disables the device token.
- Reinstalling or refreshing the app can update a changed device token.
- Do not add a global notification inbox or request-thread messaging in this story.

## Story 2: Notify Charge Nurses About Nurse Requests

As a charge nurse, I want push notifications for issue flags and swap requests so I can respond even if NurseFlow is backgrounded.

### Acceptance Criteria

- A submitted issue flag can notify the charge nurse for the active shift.
- A submitted swap request can notify the charge nurse for the active shift.
- Notification copy identifies the event type without exposing unnecessary patient details.
- Tapping the notification opens the relevant request or a safe recovery screen.
- Foreground realtime request updates from Phase 6 continue to work.

### Validation and Edge Cases

- If the charge nurse has permission enabled, submitting a request from a joined nurse can trigger a push.
- If the charge nurse has notifications disabled, the request still appears in-app while connected.
- If the request is already resolved before the notification is opened, the app shows the current request state.
- Do not add threaded conversations or global chat.

## Story 3: Notify Joined Nurses About Assignment Updates

As a joined nurse, I want push notifications when my assignment changes so I know to reopen the app and review my current shift view.

### Acceptance Criteria

- Assignment updates can notify affected joined nurses only.
- Notification taps route to the joined nurse assignment screen when access is still valid.
- Notifications never expose another nurse's full assignment.
- Ended shifts or removed access show a safe recovery state.

### Validation and Edge Cases

- Rerunning assignment notifies only nurses whose nurse-scoped assignment changed.
- A notification opened after shift end shows `Shift ended`.
- A notification opened after access removal shows `Access removed`.

## Story 4: Notify Charge Nurses About Floor Events and Safety Flags

As a charge nurse, I want push notifications for important floor changes and safety flags so I can return to the board when action may be needed.

### Acceptance Criteria

- Admissions and discharges can notify the charge nurse when useful.
- Imbalance and unassigned-bed flags can notify the charge nurse when they newly appear or worsen.
- Notification copy stays short and avoids sensitive patient details.
- Tapping the notification opens the floor board or flags/request screen.
- Duplicate or noisy notifications are avoided for unchanged flags.

### Validation and Edge Cases

- Adding an admission can trigger a charge notification.
- Discharging a patient can trigger a charge notification.
- A newly unassigned occupied bed can trigger a charge notification.
- Existing unchanged imbalance flags should not spam repeated pushes.

## Story 5: Keep the Most Recent View Readable During Brief Disconnects

As a charge nurse or joined nurse, I want to keep seeing the most recently loaded shift view during a temporary connection drop so the screen does not go blank.

### Acceptance Criteria

- The charge nurse can view the most recently loaded floor board during a connection drop.
- A joined nurse can view the most recently loaded nurse assignment during a connection drop.
- Cached views clearly say they may be stale.
- Cached views are read-only in Phase 7.
- Editing, request submission, invite generation, and assignment changes require an active server connection.
- Reconnecting refreshes from the server and clears stale labels when current data loads.

### Validation and Edge Cases

- Turning off network while viewing the board keeps the last board visible.
- Turning off network while viewing the joined nurse assignment keeps only that nurse's last assignment visible.
- Reopening the app offline can show a safe signed-in recovery state, but protected data should not be shown to the wrong user.
- A signed-out user cannot view cached protected shift data.
- Cached data does not replace server authorization after reconnect.

## Story 6: Show Clear Reconnect and Disabled-Action States

As a user in an active shift, I want the app to tell me when I am disconnected and which actions need a connection so I do not think a change was saved when it was not.

### Acceptance Criteria

- Connected screens show online, reconnecting, disconnected, or stale-copy states.
- Server-required actions are disabled while disconnected.
- Disabled actions use plain copy such as `Reconnect to save changes`.
- The app does not queue offline writes in Phase 7.
- Reconnect refreshes the current server-backed view.

### Validation and Edge Cases

- While disconnected, charge nurse edit actions do not silently save locally.
- While disconnected, joined nurse request submission does not silently create a queued request.
- Reconnect reloads the server-backed board or nurse view.
- If reconnect fails, the stale view remains readable with a clear warning.

## Story 7: Preserve Previous Phase Behavior

As a learner building NurseFlow, I want notifications and lightweight resilience added without disrupting the proven realtime, invite, assignment, and request workflows.

### Acceptance Criteria

- Phase 6 foreground realtime still works when the app is connected.
- Nurse invite links, join codes, and access rules still work.
- Server state remains the source of truth after reconnect.
- Existing assignment, request, flag, and carry-over flows still work.
- Notification and connection-state code paths are understandable and separately testable.

### Validation and Edge Cases

- Existing connected workflows still pass after notification and cache work.
- Push notification failure does not break in-app writes.
- Cached view failure does not break connected server reads.
- No offline write queue, drag-and-drop override, board snapshot sharing, tablet layout, AI, or request threads are added in Phase 7.

# Remaining Go migration milestones

Status: approved by the user on 2026-10-17. Milestones 2 and 3 (tickets 01–07) are done. The user closed milestone 3 on 2026-10-19 with the remaining manual checks and fixture cleanup deferred as recorded in shift-lifecycle.md. Milestone 4 (tickets 08–11) was completed on 2026-10-24 (see profiles-invites-access.md); Milestone 5 (tickets 12–15) was completed on 2026-10-24 (see moves-requests-threads.md); Milestone 6 (tickets 16–19) was implemented on 2026-10-25 (see assignment-runs.md): 16–17 verified, 18 deferred, 19 verified on web and Android; the user closed it on 2026-10-25. Milestone 7 was authorized on 2026-10-25 (see hosted-development.md): tickets 20 and 21 were done on 2026-10-29 against the hosted development stack, and 22–23 need separate approvals. A store-release milestone 8 is proposed, not authorized. Notifications are disabled by user decision on 2026-10-24: ticket 11's notification-target lookup, ticket 18, and ticket 19's notification navigation are deferred until the user re-enables them.
Prepared 2026-10-17 from existing code, the migration plan, database baseline, and ownership ADR.

## Session handoff

The agreed execution unit is one whole authorized milestone. Milestone 3 is done; see [shift lifecycle](shift-lifecycle.md) for implementation, applied development migrations, local/live evidence, and deferred manual checks. Milestone 4 requires authorization before implementation.
Tickets are complete vertical workflows; work can continue across their contexts without stopping at each familiar CRUD step.
Explain new Go concepts or complex rules before the affected major change and provide a focused walkthrough afterward.
No understanding quiz is required. The execution style and ticket breakdown are approved.

One published file per ticket is available under `.scratch/go-migration-next/issues/`.
Tickets 01–02 are complete, with verification in [template writes](template-writes.md). Tickets 03–07 are done with the verification limits above; tickets 08–23 remain `ready-for-agent` behind their milestone boundaries. The absent local milestone 3 ticket files were reconstructed under the existing issues directory.
This document is the approved index; each tracker ticket remains a separate file.

## Milestone grouping

- **Milestone 2: Template writes** — tickets 01–02. Review topics: JSON validation, GORM writes, write permissions, transactions.
- **Milestone 3: Charge shift lifecycle** — tickets 03–07. Review topics: Related reads, safe updates, row locks, stale state, multi-write transactions.
- **Milestone 4: Profiles, invites, and joined-nurse access** — tickets 08–11. Review topics: Profile provisioning, membership authorization, hashing, atomic acceptance.
- **Milestone 5: Manual moves, requests, and threads** — tickets 12–15. Review topics: Idempotency, state transitions, lock ordering, side effects.
- **Milestone 6: Optimizer and live integration** — tickets 16–19. Review topics: Go/Python boundaries, deadlines/cancellation, run coordination, events.
- **Milestone 7: Hosted verification, cutover, and retirement** — tickets 20–23. Review topics: Configuration, secrets, deployment health, rollout/rollback, cleanup.
- **Milestone 8 (proposed, not authorized): App Store / Play Store release.** Follows the cutover (22); scope and tickets come from its own grilling round.

Milestone order is the intended execution order. Blocking edges represent genuine technical gates, not a forced chain.
Unblocked tickets can use existing migrated or retained paths and development fixtures.

## Approved tickets

1. **[Done] Save floor templates through Go (Milestone 2)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** A charge nurse can create and update their own reusable floor template in Expo through Go, then reload the same saved layout.

2. **[Done] Delete owned floor templates through Go (Milestone 2)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** A charge nurse can delete an eligible saved template using the existing Expo action, with the same restrictions and visible failures.

3. **[Done] Load the charge shift workspace through Go (Milestone 3)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** The charge nurse resumes the current shift and sees carry-over suggestions through Go, with existing effective assignment overlays and workspace loading behavior.

4. **[Done] Start a shift through Go (Milestone 3)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** A charge nurse starts a shift from an owned saved template in Expo and can resume the persisted shift.

5. **[Done] Save shift setup through Go (Milestone 3)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** Existing shift setup screens save nurses, patients, acuity, side settings, and carry-over review through Go and reload the authoritative workspace.

6. **[Done] Reopen an assigned shift for editing through Go (Milestone 3)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** A charge nurse returns an assigned shift to editing through Go without applying a reset against an assignment that changed meanwhile.

7. **[Done] End a shift and retain carry-over through Go (Milestone 3)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** The existing End Shift flow retains useful carry-over, expires invites, closes the shift, and refreshes participation through Go.

8. **[Done] Load and provision the application profile through Go (Milestone 4)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** After Supabase sign-in or signup, Expo loads or creates the same application profile through Go while Supabase continues owning authentication and refresh.

9. **[Done] Manage nurse invites through Go (Milestone 4)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** The charge nurse sees invite/access status and generates or regenerates an eligible nurse's invite using Go.

10. **[Done] Validate and accept nurse invites through Go (Milestone 4)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** The existing code/deep-link join flow validates and accepts a nurse invite through Go and opens the joined workspace.

11. **[Done] Read the joined nurse workspace through Go (Milestone 4)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** A joined nurse sees only their own effective assignment through Go and receives the existing ended-shift/access-removed state on refresh or notification navigation.

12. **[Done] Confirm manual assignment moves through Go (Milestone 5)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** The charge nurse confirms a bed move through Go, receives the effective board, and sees a stale result if the assignment or current owner changed.

13. **[Done] Submit and review issue requests through Go (Milestone 5)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** A joined nurse submits an issue through Go and charge can review, resolve, or reopen it using the existing screens.

14. **[Done] Submit and resolve swap requests through Go (Milestone 5)**
   - **Blocked by:** 12: Confirm manual assignment moves through Go.
   - **What it delivers:** A joined nurse requests a swap, charge accepts or declines it through Go, and an accepted swap can complete through the migrated manual-move flow.

15. **[Done] Read and send request messages through Go (Milestone 5)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** The authorized nurse and charge can read and send messages in the existing request thread through Go.

16. **[Done] Run the first assignment through Go and Python (Milestone 6)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** Expo starts a first assignment through Go, retains the existing Python solver, and reloads only a committed authoritative result.

17. **[Done] Rerun assignments safely through Go (Milestone 6)**
   - **Blocked by:** 16: Run the first assignment through Go and Python.
   - **What it delivers:** The charge nurse reruns an assignment through Go while stale runs cannot overwrite newer setup, assignments, or moves.

18. **[Deferred: notifications disabled] Register and disable device notifications through Go (Milestone 6)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** The signed-in device registers its existing notification token through Go and disables it on sign-out as before.

19. **[Done on web and Android; notification parts deferred] Verify migrated workflows and live collaboration (Milestone 6)**
   - **Blocked by:** 01: Save floor templates through Go; 02: Delete owned floor templates through Go; 03: Load the charge shift workspace through Go; 04: Start a shift through Go; 05: Save shift setup through Go; 06: Reopen an assigned shift for editing through Go; 07: End a shift and retain carry-over through Go; 08: Load and provision the application profile through Go; 09: Manage nurse invites through Go; 10: Validate and accept nurse invites through Go; 11: Read the joined nurse workspace through Go; 12: Confirm manual assignment moves through Go; 13: Submit and review issue requests through Go; 14: Submit and resolve swap requests through Go; 15: Read and send request messages through Go; 16: Run the first assignment through Go and Python; 17: Rerun assignments safely through Go; 18: Register and disable device notifications through Go.
   - **What it delivers:** Charge and joined-nurse devices stay consistent across migrated writes, reconnects, and notification navigation using retained Supabase Realtime and delivery.

20. **[Done 2026-10-29: deployed and live checks passed] Run Expo against a hosted development Go API (Milestone 7)**
   - **Blocked by:** None (can start after the milestone is authorized).
   - **What it delivers:** Expo web and available native devices reach a hosted Go API backed only by the isolated development environment.

21. **[Done 2026-10-29: hosted matrix passed on web and Android; notification parts deferred] Verify all migrated workflows on hosted development (Milestone 7)**
   - **Blocked by:** 19: Verify migrated workflows and live collaboration; 20: Run Expo against a hosted development Go API.
   - **What it delivers:** The complete existing charge/joined-nurse workflow passes on the hosted development stack with documented behavior parity and rollback readiness.

22. **[Done 2026-10-30: production on Go, smoke checks passed] Enable the Go migration in the existing environment (Milestone 7)**
   - **Blocked by:** 21: Verify all migrated workflows on hosted development.
   - **What it delivers:** After explicit approval of the concrete cutover, the existing app uses the validated Go workflows against its existing environment.

23. **Retire obsolete client and database workflow paths (Milestone 7)**
   - **Blocked by:** 22: Enable the Go migration in the existing environment.
   - **What it delivers:** After the approved cutover and rollback window, unused direct client access and obsolete RPC implementations are removed while required infrastructure continues working.
   - **Note:** Once store builds exist (proposed milestone 8), installed old versions keep calling legacy paths. Retirement then also waits for a minimum-supported-version decision.


## Common acceptance rules

- Complete the existing workflow end to end: Go authorization/domain behavior, only necessary reviewed database access changes, Expo integration through shared Axios/Zod where applicable, and meaningful automated/manual verification.
- Preserve existing product behavior, models, mapping, state refresh, error visibility, and side effects; no hidden fallback or new product scope.
- Use isolated development and the least-privilege verified-identity transaction design. Retain Supabase Auth/refresh, Realtime, the Python solver, and notification delivery unless a specific reviewed boundary decision changes them.
- Settle unresolved contract, validation, concurrency, and transaction decisions before that milestone using current source and authoritative database definitions. Prefactor only demonstrated obstacles.
- Preserve existing locks, version checks, uniqueness, deduplication, and rollback behavior. Audit triggers before reproducing their effects in Go.
- Use established shared client defaults for ordinary requests; explicitly design long-running optimizer budgets. Add exact CORS methods/headers required by migrated routes.
- Mark complete after relevant checks and a manual/demo path pass. Distinguish real sessions/databases from test doubles and identify the devices actually exercised.
- Explain new Go concepts and complex behavior, then complete routine work within the authorized milestone without approval pauses between tickets. Discuss consequential unresolved choices and scope changes.

## Decisions to settle at the relevant milestone

- Writes: determine authoritative fields and review atomicity rather than blindly copying multiple client requests.
- Profiles/invites: preserve role support, identity mapping, and code compatibility; no new role model.
- Optimizer: agree Go/Python coordination and service authentication before changing protocols or credentials.
- Deployment: review host/costs before provisioning. Production enablement and irreversible retirement are separate explicit decisions.

## Approval and next session

The user approved the breakdown, completed milestone 2, and authorized milestone 3 on 2026-10-18. Its bounded design decisions are settled. Tickets 03–07 are implemented and locally verified; apply the prepared migration to development and complete the live checks before marking them done. Continue that verification when development access is available; do not start milestone 4.

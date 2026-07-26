# Phase 6 Manual Test Pass

Use this record for Phase 6 Tasks 7.1 through 7.6. Tasks 7.1 through 7.4
require two signed-in foreground sessions against the same Supabase project.

## Automated Validation Evidence

Run date: 2026-07-08

- TypeScript: `node_modules\.bin\tsc.cmd --noEmit` passed.
- Lint: `npm run lint` passed.
- Expo export: `npx expo export` passed for iOS, Android, and web bundles.
- Exported routes included `/nurse-invites`, `/join-active-session`, and
  `/regular-nurse-workspace`.

## Scope Review

No Phase 6 runtime implementation was found for these later-phase areas:

- Push notifications or background alerts.
- Offline write queues or conflict-resolution systems.
- Drag-and-drop assignment override.
- Board snapshot sharing.
- Tablet-specific layout.
- AI-assisted staffing or acuity suggestions.

Expected Phase 6 boundaries are still in place:

- `src/services/realtimeWorkspaceRepository.ts` owns charge and joined nurse
  realtime subscriptions.
- `src/services/shiftInviteRepository.ts` owns invite code generation,
  validation, acceptance, regeneration, revocation, and expiration helpers.
- `src/store/ServerWorkspaceContext.tsx` starts and stops realtime listeners
  from signed-in active shift or joined nurse access state.
- Joined nurses continue to load through the nurse-scoped assignment view
  instead of the full charge nurse active shift.

## Manual Checklist

### Task 7.1: Realtime Board Manual Test

- [ ] Open two foreground sessions as the same charge nurse on the active shift.
- [ ] Change acuity in session A and confirm session B updates without manual
  refresh.
- [ ] Change patients in session A and confirm session B updates without manual
  refresh.
- [ ] Change assignments in session A and confirm session B updates without
  manual refresh.
- [ ] Submit or resolve a flag/request change and confirm the other session
  updates without manual refresh.

### Task 7.2: Invite Link Manual Test

- [ ] Generate a nurse invite code from `/nurse-invites`.
- [ ] Copy the generated code.
- [ ] Share the generated code through the native share action.
- [ ] Join with the generated code from another signed-in user.
- [ ] Regenerate the nurse code and confirm the newest code works.
- [ ] Confirm the old regenerated code fails safely.
- [ ] End the shift and confirm active codes fail safely.

### Task 7.3: Joined Nurse Manual Test

- [ ] Join as a nurse from `/join-active-session` with a valid code.
- [ ] Confirm the joined nurse sees only the nurse-scoped assignment view.
- [ ] Change assignment, break, patient, and acuity data from charge and confirm
  the joined nurse screen updates live.
- [ ] Submit an issue request as the joined nurse and confirm charge sees it.
- [ ] Submit a swap request as the joined nurse and confirm charge sees it.
- [ ] Accept or decline the swap request as charge and confirm the joined nurse
  sees the status live.

### Task 7.4: Authorization Manual Test

- [ ] Confirm Charge Nurse A cannot manage invites for Charge Nurse B's active
  shift.
- [ ] Confirm a joined nurse cannot read the full active shift.
- [ ] Confirm a signed-out user cannot join without authenticating.
- [ ] Confirm a user already in another active shift sees a safe participation
  conflict state.

### Task 7.5: Scope Test

- [x] Review code and Phase 6 docs for later-phase scope leaks.
- [x] Confirm the app does not add Phase 6 runtime support for push,
  offline queue, conflict resolution, drag-and-drop override, board snapshot
  sharing, tablet layout, or AI.

### Task 7.6: Beginner Readability Pass

- [x] Review realtime, invite, server workspace, and joined nurse boundaries.
- [x] Add service documentation that explains which file owns each Phase 6
  responsibility.
- [x] Keep the pass documentation explicit that 7.1 through 7.4 require real
  manual two-session validation before they are marked done.

# Active Shift Edit Reset

Status: implementation and understanding checkpoint complete; Supabase
installation and two-session manual validation remain.

## Completed Implementation

- [x] Show a destructive confirmation before an assigned shift can be edited.
- [x] Clear the generated assignment and assignment flags before editing.
- [x] Supersede active manual assignment moves in the same transaction.
- [x] Expire active join codes and mark pending or linked nurse access removed.
- [x] Require a nurse to have at least one effectively assigned occupied bed
  before a code can be generated or regenerated.
- [x] Keep no-patient nurses visible on the invite screen with a clear disabled
  state.
- [x] Add focused eligibility and SQL contract regression tests.

## Server Installation

Run `supabase/active_shift_edit_reset.sql` in the Supabase SQL editor after the
existing active-shift, invite, nurse-access, and manual-override setup.

## Manual Validation

- [ ] From an assigned Floor Board, open Assign, Patients, Nurses, or Shift
  setup and confirm the warning appears before continuing.
- [ ] Cancel and confirm the existing board and joined-nurse access remain.
- [ ] Confirm the edit; verify assignment and flags are cleared and the shift
  opens in setup state.
- [ ] In a second signed-in nurse session, verify the nurse moves to the
  `Access removed` state.
- [ ] Verify previously active join codes no longer validate.
- [ ] Verify assignment must be run again before the board can resume.
- [ ] On Nurse Invites, verify a nurse with patients can generate a code and a
  nurse with zero patients has a disabled `No patients assigned` action.
- [ ] Move the only patient between nurses and verify eligibility follows the
  effective assignment after realtime refresh.

## Automated Validation

- [x] TypeScript: `node_modules\\.bin\\tsc.cmd --noEmit`
- [x] Lint: `npm run lint`
- [x] Focused Node regressions: 9/9 passed.
- [x] Expo web production export completed.

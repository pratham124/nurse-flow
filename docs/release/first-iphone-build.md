# First build on the user's iPhone (ticket 27)

Milestone 8, decisions 4, 5, 8, 14, 16, 20, 22, 24, 26 in
[milestone-8-testflight-demo.md](milestone-8-testflight-demo.md).

## Setup (2026-11-07)

- App Store Connect app "NurseFlow", bundle ID `com.pfrog123.nurseflow`, internal
  TestFlight group "Team (Expo)" with the user as the only tester.
- EAS sign-in with an Apple ID fails ("iTunes service key is empty", an
  Apple-side bug, expo/eas-cli#4392). Builds and submissions use an App Store
  Connect team API key instead, kept outside the repo. `eas.json` has an iOS
  submit profile with `ascAppId`, so `eas build --auto-submit` runs without
  prompts.
- Production Cloud Run caps confirmed: API min 0 / max 2 / concurrency 80;
  solver min 0 / max 1 / concurrency 1.

## On-device test (2026-11-09 to 2026-11-10)

The charge account (Smoke Charge) ran on the user's iPhone through TestFlight,
against production. The joined nurse (Smoke Nurse) ran on the Pixel 5 API 34
Android emulator, also against production.

Passed:

- No notification permission prompt at any point.
- Sign-in, and the session survives closing and reopening the app.
- Privacy and Terms links open, dated November 7, 2026; dummy-data notices show.
- Safe areas (notch and home bar), portrait lock.
- Template create and swipe delete (after the fix below).
- Shift setup and running assignment.
- Invite and join; live updates both ways: issue, conversation replies, issue
  reviewed and resolved, swap request and accept, End Shift ("Shift ended" on
  the nurse side within seconds).
- Account deletion with a throwaway account; signing in with it afterwards fails.

A swap could not be completed with an assignment move because the test floor had
one room and one nurse, so that path was not tested on the iPhone.

## iOS-only problems found and fixed (PR #13)

| Problem on iPhone | Cause | Fix |
|---|---|---|
| Swipe-to-delete rows were hard to trigger, a right swipe navigated back, and a short swipe did not close an open row | Rows used a JavaScript `PanResponder`, which loses the touch to the native iOS scroll view and the full-screen back gesture | Rows rebuilt on `ReanimatedSwipeable` (react-native-gesture-handler); action button uses the gesture handler's `Pressable` |
| A right swipe went back a screen, which felt wrong next to rows that swipe right to delete | Stack back gesture | Back gesture turned off; every screen has on-screen navigation |
| "Edit active shift?" flashed after running assignment | Saving the result while the review screen was still focused triggered the edit guard before the push to the board | Guard hidden while a run is in flight and until the screen is focused again |
| The reply box stayed under the keyboard | `KeyboardAvoidingView` shrank the screen but never scrolled to the input | ScrollViews use `automaticallyAdjustKeyboardInsets`, which scrolls the focused input into view |
| Request times showed seconds | `toLocaleString` ignored the format options on iOS | `Intl.DateTimeFormat` |
| A resolved issue still counted under Pending on Flags | Issues keep the stored status `pending`; resolution is a separate review status | Flags filter and count by a status group that puts resolved issues in their own group |

Builds: 1.0.0 (9) was the first test build. 1.0.0 (13), built from this PR,
contains all the fixes above; the user re-checked each fix on the iPhone on
2026-11-10 and all passed. Ticket 27 is done.

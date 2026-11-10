# Beta App Review answers (ticket 28)

Draft answers for App Store Connect before NurseFlow goes to external
TestFlight testers. Milestone 8 decisions 1, 10, 18, 25 and 28 in
[milestone-8-testflight-demo.md](milestone-8-testflight-demo.md). The user reviews
these before anything is submitted.

## TestFlight → Test Information

| Field | Answer |
|---|---|
| Beta App Description | NurseFlow helps a hospital charge nurse set up a floor, enter the nurses and patients for a shift, and assign beds to nurses in a balanced way. Nurses on the shift join with a code to see their assignment, flag issues, and ask for swaps. This beta is for a small group of nurses at one hospital and uses made-up (dummy) patient data only. |
| Feedback Email | pratham.sitoula03@gmail.com |
| Marketing URL | (blank) |
| Privacy Policy URL | https://pratham124.github.io/nurse-flow/privacy.html |

## TestFlight → Beta App Review Information

| Field | Answer |
|---|---|
| Contact first and last name | Pratham Sitoula |
| Contact phone | (the user's number; required by Apple) |
| Contact email | pratham.sitoula03@gmail.com |
| Sign-in required | Yes |
| User name | the Apple Reviewer account in the encrypted local store (`nurseflow.review.*@example.com`) |
| Password | from the encrypted local store; entered directly into App Store Connect, never committed |

### Review notes

> NurseFlow is a shift-assignment tool for hospital charge nurses. It is in a
> closed beta for about 20 nurses at one hospital. All patient data is made up:
> the app tells users throughout not to enter real patient information.
>
> The demo account is a charge nurse with a floor template ("Demo Unit 4W") and a
> shift that is already set up with 3 nurses and 7 dummy patients.
>
> To try the main flow with one device:
> 1. Sign in with the demo account.
> 2. On the home screen, tap "Resume" on the active shift. Tap "Continue"
>    through the setup steps (nurses, patients) to the Assign step, then tap
>    "Run assignment". The floor board shows which nurse covers which beds,
>    with load and acuity warnings.
> 3. On the board, swipe a bed left and tap "Move" to give it to another nurse.
> 4. The "Invites" tab creates a 6-character code that a second nurse enters on
>    their own phone to join the shift and see their assignment live. That side
>    needs a second device; it is not required to review the charge flow.
> 5. "End shift" on the home screen ends it. Starting a new shift from the
>    template sets one up again.
>
> Account deletion: Home → "Delete account" (type DELETE to confirm). Please
> don't delete the demo account, or other reviewers won't be able to sign in;
> you can sign up with any email to test deletion.
>
> Notifications are turned off in this build, so the app never asks for
> notification permission.

### What to Test (per build)

> Build 1.0.0 (14): first external beta. Please try setting up a shift, running
> the assignment, and moving a bed on the floor board.

## Settled outside this form

- **Encryption.** The build already declares no non-exempt encryption (HTTPS
  only), so App Store Connect asks no export compliance question (decision 28).
- **Tester access.** An external group with each nurse added by email, no public
  link (decision 1 as changed on 2026-11-07). Each invite email includes a
  redeem code for the TestFlight app.
- **App Privacy and age rating.** These are App Store listing items. If App
  Store Connect asks for them before external testing, use the answers below.

### App Privacy (if asked)

Data used for app functionality only, linked to the user, not used for tracking:

- Contact info: email address (sign-in).
- User content: names, shift setup, dummy patient details, requests and
  messages.
- Identifiers: user ID (the account).

No tracking, no advertising, no third-party analytics. Crash reports come only
from TestFlight's built-in reporting (decision 26).

### Age rating (if asked)

Every content question is "None" or "No": no violence, sexual content,
profanity, gambling, contests, horror, drugs, mature themes, unrestricted web
access, or user-generated content shared publicly. Medical/treatment
information: "Infrequent/Mild" (the app shows dummy diagnoses for staffing, not
medical advice). The expected rating is 4+ (or 12+ if Apple rates the medical
item higher).

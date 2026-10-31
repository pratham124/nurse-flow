# Milestone 8: TestFlight demo release (planning)

Status: planning complete and approved by the user on 2026-10-30. Implementation
has not started, and each ticket starts only after the user's go-ahead.

## What this release is

NurseFlow ships as an **iOS TestFlight demo for dummy data only**. Invited
testers install it through a TestFlight public link, and it is never listed in
App Store search. TestFlight builds expire after 90 days, so the demo stays
available by uploading a new build at least that often. There is no public App
Store listing, and the app must not be used with real patients.

## Why not real clinical use

The user considered letting a nurse friend use NurseFlow on real shifts. The
conclusion: any real-patient use needs the employer's approval, whatever data
the app keeps.

- In Alberta, patient information belongs to the employer (custodian) under the
  Health Information Act. Staff generally may not put it into unapproved apps.
- Acuity is health information too, because it is derived from the patient's
  condition, and the hospital can match "bed + date + acuity" to a patient. The
  solver needs acuity, so no data design makes real use approval-free.
- The servers are in the US, with no agreement with any health employer.

Real clinical use would be a separate, future pilot. It would need a unit
manager's approval, a privacy impact assessment, Canadian hosting, and data
agreements. Off-shift use with dummy data (for example, a nurse modelling
their real unit's layout with made-up patients) is fine.

## Decisions

| # | Area | Decision |
| --- | --- | --- |
| 1 | Audience | Closed testing only: TestFlight, external testers through a public link. Not a public App Store listing. |
| 2 | Patient data | Dummy data only. All current patient fields stay (initials, age, sex, diagnosis, acuity) for realism. Every place users see it, the app and the policies say real patient information is not allowed. Considered and rejected: bed number and acuity only. |
| 3 | Identity | Display name **NurseFlow**. iOS bundle ID and Android package **`com.pfrog123.nurseflow`**, replacing `com.pfrog123.firstapp`. Deep-link scheme `nurseflow`. These cannot change after the first upload. |
| 4 | Store accounts | Apple Developer Program only (individual, US$99/year). No Google Play account. |
| 5 | Platforms | iOS only, tested on the user's iPhone through TestFlight. Android testers are optional later through an EAS internal-distribution install link. |
| 6 | Account deletion | In scope: an in-app "Delete account" backed by Go, because Apple requires it for apps that let users create accounts. It removes everything the person owns, including their messages. A charge nurse's templates and shifts go too, including for nurses on those shifts. A regular nurse's shift slot stays but no longer links to them. Go calls a narrow database function that can only delete the signed-in user; Go does not get Supabase's admin key. Users type `DELETE` after a warning listing what will go. The three `ON DELETE RESTRICT` references (messages, manual assignment overrides, solver runs) must change first, or deletion fails. |
| 7 | Notifications | Ship with notifications off. Ticket 18 stays a follow-up after the first release. |
| 8 | Order | Ticket 23 (retiring the legacy database paths, around 2026-11-06) happens before the first build is submitted, so no TestFlight build ever depends on the legacy paths. After the first build, Go API changes must keep working for builds testers already have installed. |
| 9 | Data location | Stays in the US (Supabase `us-east-1`, Cloud Run `us-east4`), which is fine for dummy data. |
| 10 | Contact | A separate contact email, which the user is creating, for privacy and support requests. |
| 11 | Hints | The message box says "Don't include patient details". The nurse name field says "First names only". |
| 12 | End-of-shift deletion | Skipped, since the data is dummy. |
| 13 | Sign-up email | Email confirmation stays off for the demo, which avoids setting up an email provider. People can sign up with an address they don't own. Confirm the production setting during the build. |
| 14 | Builds | EAS cloud builds started by hand and uploaded with EAS Submit. Production's public settings are EAS environment variables, with notifications off. |
| 15 | Over-the-air updates | No EAS Update. Every fix is a new TestFlight build. It can be added in any later build. |
| 16 | Capacity and cost | Production keeps `min-instances 0` and the existing instance caps, and gains a Google Cloud budget alert. The public link is shared only with chosen people and has a tester limit. |
| 17 | Icon and splash | Made from `assets/images/nurseflow-mark.png`, replacing the template's, including `assets/expo.icon` on iOS. |
| 18 | Apple reviewer login | A dedicated production charge account with a dummy template and shift, created after ticket 23. Its password goes in the same encrypted local store as the smoke accounts. |
| 19 | Policy pages | Privacy policy and terms are hosted on GitHub Pages from this public repo. |
| 20 | Expo patches | Expo SDK 55 patch updates are applied and retested before the first build. |
| 21 | Forgotten passwords | No reset flow. A locked-out tester emails the contact address, and the user resets the password or deletes the account from the Supabase dashboard. The privacy policy gives this as the deletion route for anyone who can't sign in. |
| 22 | Notification code | Stays in the app, switched off by `EXPO_PUBLIC_NOTIFICATIONS_ENABLED`. Check on the iPhone that no permission prompt appears. If that check or Apple's review finds a problem, remove the `expo-notifications` plugin from that build. |
| 23 | Devices | iPhone only, locked to portrait. |
| 24 | First iOS test | All testing so far was on Android and web. The first build goes to the user alone through TestFlight internal testing, and passes the full charge nurse and regular nurse flows on the iPhone before Beta App Review. The second account can run on the Android emulator. |
| 25 | Older installed builds | API changes keep working for 90 days after the last build that uses the old behaviour. No forced-update screen. |
| 26 | Crash reporting | TestFlight's built-in crash reports and tester feedback only. No outside service. |
| 27 | Expo slug | Stays `first-app`, which testers never see and which is tied to the EAS project. |
| 28 | App Store Connect answers | Declare standard encryption only (HTTPS) and answer the age rating questions plainly. The user reviews the exact answers before submitting. |

## What users will see (policy items)

Required by Apple for external TestFlight testing:

- **Privacy policy**, at a public URL in App Store Connect **and** linked inside the app (signup screen and a profile or settings area). It covers:
  - what is collected (account email, display name, floor and shift setup, patient fields, staff names, requests and messages) and why;
  - that the app is a dummy-data demo;
  - storage with Supabase and Google Cloud in the US;
  - who can see what;
  - in-app account deletion;
  - how to ask to see or correct data;
  - the contact email.
- **In-app account deletion** (decision 6).
- **Support contact** (decision 10).
- **App Privacy answers** in App Store Connect: contact info (email) and user content, including health-related content. No tracking, no ads.

Recommended and planned:

- **Terms of use / disclaimer:**
  - NurseFlow is a planning aid, not a medical device;
  - assignments are suggestions, and the charge nurse's judgment decides;
  - dummy data only;
  - provided as-is during testing.
- **Consent line at signup:** "By creating an account you agree to the Terms and Privacy Policy," with links.
- **"Dummy data only" notices** at signup and on the patient entry screen.

Not needed: Apple's tracking permission prompt (no tracking), a notification permission explanation (notifications off), or a cookie banner.

## Tickets

| # | Ticket | Starts |
| --- | --- | --- |
| 24 | App identity and build setup | Any time, because it doesn't touch the production backend |
| 25 | Account deletion | After ticket 23, so it doesn't muddy the production watch period or overlap ticket 23's database changes |
| 26 | Policies and notices | Any time, though the policy text needs the contact email to be finished |
| 27 | First build on the user's iPhone | After tickets 23–26. Needs the Apple Developer Program |
| 28 | External TestFlight | After ticket 27 |

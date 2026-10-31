# Milestone 8: TestFlight demo release (planning)

Status: being planned, not authorized for implementation. Planning started on
2026-10-30 and paused partway through. The decisions below are settled. The open
questions at the end still need answers before any build work.

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
| 6 | Account deletion | In scope: an in-app "Delete account" backed by Go. Apple requires it for apps that let users create accounts. The mechanism and what happens to the user's data are still open. |
| 7 | Notifications | Ship with notifications off. Ticket 18 stays a follow-up after the first release. |
| 8 | Order | Ticket 23 (retiring the legacy database paths, around 2026-11-06) happens before the first build is submitted, so no TestFlight build ever depends on the legacy paths. After the first build, Go API changes must keep working for builds testers already have installed. |
| 9 | Data location | Stays in the US (Supabase `us-east-1`, Cloud Run `us-east4`), which is fine for dummy data. |
| 10 | Contact | A separate contact email, which the user is creating, for privacy and support requests. |

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

## Still open

- Account deletion: the mechanism (recommended: a narrow database function only Go can call, instead of giving Go Supabase's admin key) and what happens to the user's templates, shifts, requests and messages.
- Hints on message boxes ("don't include patient details") and nurse names ("first names only"). Proposed: yes.
- End-of-shift deletion of shift details. Proposed: skip, since the data is dummy.
- Builds: EAS cloud builds triggered by hand, EAS Update for over-the-air fixes, and production settings as EAS environment variables. Proposed, not confirmed.
- Production capacity: `min-instances 0` during TestFlight. Proposed.
- App icon and splash screen made from the existing NurseFlow artwork. Proposed.
- TestFlight setup: external group with a public link, and the production Smoke Charge account as Apple's reviewer demo login. Proposed.
- Where the privacy policy and terms pages are hosted.
- Expo SDK 55 patch updates, which Expo reports as behind, before the first build.

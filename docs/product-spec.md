NurseFlow — Product Specification
Overview
NurseFlow is a React Native mobile app for hospital charge nurses to manage shift assignments and patient acuity. It supports two roles — charge nurse and regular nurse — with real-time collaboration during an active shift. Targets both iOS and Android.

Tech Stack

Frontend: React Native (Expo)
State management: Zustand or Redux Toolkit
Real-time: WebSockets or Supabase Realtime
Push notifications: Expo Notifications / Firebase Cloud Messaging (FCM)
Deep linking: Expo Linking for invite link handling
Backend: To be defined — spec is backend-agnostic

Roles
Charge Nurse

Full control over floor setup, shift management, nurse assignments, and patient acuity
Drag and drop to override auto-assignments
Sees the full floor board
Receives flags and swap requests as push notifications

Regular Nurse

Joins a shift via a unique deep link (opens the app directly to the shift)
Sees their own assignment — rooms, beds, patients, and acuity
Can flag issues or request patient swaps

Auth & Onboarding

Email/password signup and login
Session persists across app closes — no re-login mid-shift

Floor Management
Create Floor (4-step flow)
Step 1 — Floor Details

Floor name (e.g. "4 North", "ICU")

Step 2 — Create Rooms
For each room:

Room number / name
Maximum number of beds (template default) — beds auto-labeled numerically (e.g. "101-1", "101-2")

Step 3 — Define Doctor Sides

Charge nurse defines doctor sides (e.g. "AB Side", "SK Side")
Each side is assigned a default set of rooms (e.g. AB Side: rooms 306–323, SK Side: rooms 309–322)
Side-to-room mapping saved on template, adjustable per shift

Step 4 — Review

Summary grouped by doctor side → rooms → beds
Charge nurse can go back and edit before saving

Relationships
Doctor Side → Rooms → Beds → Patient
Nurse → generated Balanced Team → generated Room Coverage → Beds

Each room belongs to one doctor side
Nurses receive room coverage during shift setup from a deterministic local room-assignment step
A nurse is first placed into a generated balanced team, and teams can cover rooms on one or both doctor sides as needed
More than one nurse can have generated coverage for the same room when needed
Final patient responsibility is assigned at the bed level, not the room level
Bed eligibility check: bed's room must be in the nurse's generated room coverage

Floor Templates

Saved persistently and reused across shifts
Editable anytime outside an active shift
Per-shift edits do not modify the base template

Patient Data
Each bed can have a patient assigned with the following non-sensitive info:

Initials (e.g. "D.M.")
Age
Sex
Diagnosis — single or multiple (e.g. "Diabetes", "Diabetes, Hypertension")

Patient info is entered at shift start or when a new admission comes in mid-shift. A bed with no patient is marked empty.

Room & Acuity System
Acuity is set at the bed level. Rooms are containers — beds carry the color:

🟢 Green — stable
🟡 Yellow — moderate
🔴 Red — critical

Acuity is shift-specific — not stored on the floor template. Set at shift start, updatable mid-shift. Updates reflect in real time on all connected devices.
Charge nurse can bulk-set all beds in a room to the same acuity if uniform, or set each bed individually.

Bed & Census Management

At shift start, charge nurse inputs the active bed count per room — may differ from the template default
Census tracks occupied vs. total beds (e.g. 38/38 at shift start)
During the shift:

Discharge — patient is removed, bed stays active but marked empty and ready for admission. Census updates automatically (e.g. 38/38 → 34/38 after 4 discharges)
Admission — charge nurse adds patient info to an empty bed. Census updates automatically (e.g. 34/38 → 36/38 after 2 admissions)
New bed added — charge nurse can add a bed to a room mid-shift if needed

Any census change triggers auto-assignment to re-run automatically
All connected devices reflect changes in real time

Carry-Over System (Across Shifts)
At the start of a new shift on the same floor, the app surfaces suggestions from the previous shift for both nurses and patients. The charge nurse reviews each and accepts or dismisses individually.
Nurse Carry-Over

App shows all nurses from the previous shift as suggestions
Charge nurse accepts nurses who are working the current shift, dismisses those who are not
Accepted nurse profiles carry over: name, license type (RN / LPN), experience level (new grad / mid / experienced)
Generated balanced teams, generated room coverage, and max load are reset — configured fresh each shift
New nurses can still be added manually at shift start

Patient Carry-Over

App shows all patients from the previous shift as suggestions
Charge nurse accepts patients still admitted, dismisses those who were discharged overnight
Accepted patients carry over: initials, age, sex, diagnosis, previous bed assignment, and acuity
Charge nurse can edit any carried-over patient's info or acuity before confirming
New patients (fresh admissions) can still be added manually

Starting a Shift

Charge nurse taps Start Shift
Selects a floor
Makes any per-shift edits to rooms or doctor side mappings (does not affect base template)
Designates which doctor side is the admitting side for this shift
Reviews default side-based nurse load limits and can override them for the shift:
Nurses covering the admitting side default to a 4-5 patient limit
Nurses covering only the non-admitting side default to a 6-7 patient limit
Reviews nurse suggestions from previous shift — accepts or dismisses each, adds any new nurses
Reviews patient suggestions from previous shift — accepts or dismisses each, adds any new patients
Inputs active bed count per room
Confirms or updates acuity per bed (🟢 / 🟡 / 🔴) — carried-over acuity is pre-filled, bulk or individual edits allowed
Sets max patient load per nurse
Local assignment runs to generate balanced teams, room coverage, and bed assignments
Charge nurse shares a unique deep link per nurse via SMS, clipboard, or share sheet
Nurse taps link → app opens → joins the active shift
Invite links remain valid for the duration of the active shift and expire automatically when the shift ends. If a nurse loses their link, the charge nurse can regenerate and reshare it
Shift stays active until charge nurse ends it

Auto-Assignment Algorithm
Pure deterministic greedy algorithm — no AI or external API calls. Runs locally, works offline, no latency.

The charge nurse runs assignment as one action. Internally, the assignment process balances nurse teams, generates room coverage, assigns occupied beds, and raises local flags.

Phase 1 implementation details live in `docs/phase-1/assignment-algorithm.md`.

Assignment Edge Cases
Not enough experienced RNs for all critical beds

First pass: assign 🔴 beds to experienced RNs
Fallback 1: mid-level RNs
Fallback 2: new grad RNs
LPNs never assigned to 🔴 regardless
If no RNs available: bed marked unassigned, charge nurse alerted to resolve manually

Admitting side nurses at max load but admissions keep coming

New admission assigned to least loaded admitting-side nurse even if it exceeds target
Imbalance flag raised on that nurse's card
Charge nurse notified to adjust inputs and re-run assignment

Short staffed — not enough nurses for census

System calculates total bed count vs. total nurse capacity
Distributes as evenly as possible, flags every overloaded nurse
Floor-level alert: "Floor is understaffed — X beds unassigned or over limit"

Nurse max load set too low

Algorithm respects the cap but flags that remaining beds can't be covered
Prevents silent failures where beds go unassigned without explanation

LPN with no critical patients available to assign

LPN assigned moderate and stable beds only
If only remaining unassigned beds are critical, LPN is skipped
Bed flagged unassigned, charge nurse alerted

Nurse covering rooms across both doctor sides

If a nurse has even one generated room on the admitting side → the admitting-side nurse load limit applies
May cause slight under-utilization when generated room coverage straddles sides

Drag-and-Drop Assignment Override

Charge nurse can drag and drop beds/patients between nurses on the floor board
After any move, app flags load imbalances inline on affected nurse cards
Flags are non-blocking — charge nurse can acknowledge and keep the override

Nurse-Facing View
Accessed after joining via deep link:

Generated balanced team, generated room coverage, and assigned beds with individual acuity colors per bed
Patient info per bed — initials, age, sex, diagnosis
Flag Issue — short form describing a concern, sent to charge nurse as push notification
Request Swap — nominate a specific bed/patient and send swap request to charge nurse

Charge nurse receives push notifications for all flags and swap requests with in-app accept/decline. Accepting a swap triggers a rebalance check.

Floor Board (Charge Nurse View)

Scrollable visual board grouped by: Doctor Side → Nurse → Rooms → Beds (with acuity color and patient info per bed)
Each nurse card shows license type (RN / LPN), experience level, generated balanced team, generated room coverage, current load, and max load
Admitting side highlighted on the board
Census counter visible at the top of the board (e.g. 36/38 occupied)
A room with mixed acuity shows individual bed colors side by side (e.g. 🟢🔴)
Real-time updates across all connected devices
Imbalance flags shown inline on affected nurse cards
Share button — snapshots the board via react-native-view-shot and shares via native share sheet

Push Notifications & Alerts
EventRecipientNurse joins via invite linkCharge nurseSwap request submittedCharge nurseIssue flaggedCharge nurseSwap accepted / declinedRequesting nurseAssignment updatedAffected nurseLoad imbalance detectedCharge nurseAdmission — new patient addedCharge nurseDischarge — bed now emptyCharge nurseBed unassigned — needs manual resolutionCharge nurse
Notifications delivered via FCM when app is backgrounded or closed.

Mobile-Specific Considerations

Offline resilience — floor board remains viewable if connectivity drops; writes queue and sync on reconnect
Deep link handling — invite links work whether the app is installed or not via Expo universal links / app links
Screen size — floor board uses compact card layout optimized for phone; horizontal scroll within doctor sides if needed
Drag and drop — react-native-reanimated + react-native-gesture-handler for drag-and-drop assignment override
Share sheet — react-native-view-shot to snapshot board, then React Native Share API
Tablet layout (v1 nice-to-have) — larger floor board for better at-a-glance visibility plus side-by-side panels (e.g. floor board on the left, nurse detail on the right). Implemented via responsive breakpoints — phone layout ships first, tablet layered on top

Out of Scope (v1)

EHR / EMR integration
Automated acuity from vitals
Multi-hospital admin roles
Shift handoff / handover notes

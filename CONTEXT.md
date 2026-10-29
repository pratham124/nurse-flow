# NurseFlow

NurseFlow helps hospital charge nurses set up floors, run shifts, and share each nurse's assignment with the nurses working that shift.

## Language

### People and access

**Application profile**:
The NurseFlow record tied one-to-one to a Supabase Auth user, holding the person's display name and role.
_Avoid_: Account, user (when the NurseFlow record is meant)

**Joined nurse**:
A signed-in application profile with linked nurse access to another charge nurse's active shift. It is a mode of an ordinary charge-nurse profile, not a separate role.
_Avoid_: Regular nurse, staff nurse

**Nurse access**:
The record connecting one nurse slot on a shift to the application profile allowed to view that slot; it is pending, linked, or removed.
_Avoid_: Membership, seat

**Invite code**:
A single-use, 6-character credential for one nurse slot on one shift; only its hash is stored.
_Avoid_: Join token, invite link (the link only carries the code)

### Assignments and requests

**Generated assignment**:
The optimizer's bed-to-nurse result stored on the shift; it is the baseline every manual move is checked against.
_Avoid_: Original assignment, plan

**Assignment run**:
One request by the charge nurse to calculate a generated assignment for the shift as it was when they reviewed it. A run is running, succeeded, failed, or stale. Repeating the same request returns the same run instead of starting another.
_Avoid_: Optimization, job, solve (the solver's calculation is only one step of a run)

**Rerun**:
An assignment run on a shift that already has a generated assignment. When it succeeds it replaces that assignment, and every active manual move becomes superseded.
_Avoid_: Regenerate, reassign

**Manual move**:
A charge nurse's confirmed reassignment of one bed to another nurse. Only the newest move for a bed is active; earlier ones are kept as superseded history.
_Avoid_: Override (in conversation), drag

**Effective nurse**:
The nurse a bed belongs to right now: the active manual move's target, otherwise the generated assignment's nurse.
_Avoid_: Current owner, assigned nurse (when the generated one is meant)

**Nurse request**:
Something a joined nurse asks the charge nurse for on the current shift; either an issue request or a swap request.
_Avoid_: Ticket, message

**Issue request**:
A nurse request reporting a problem; the charge nurse moves it between open, reviewed and resolved.
_Avoid_: Complaint, flag

**Swap request**:
A nurse request asking to hand one of the nurse's own beds to someone else. Accepting it only approves the swap; it is completed later by a manual move of that bed.
_Avoid_: Trade, transfer

**Request thread**:
The messages exchanged about one nurse request, visible only to the shift's charge nurse and the requesting nurse while they have access.
_Avoid_: Chat, conversation

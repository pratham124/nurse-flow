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

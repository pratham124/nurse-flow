package database

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/pratham124/nurse-flow/backend/internal/invites"
	"gorm.io/gorm"
)

func TestJoinedWorkspaceIntegration(t *testing.T) {
	f := openAccessFixture(t)
	ctx := contextForTest()
	workspace := func(who Profile) *JoinedAssignment {
		t.Helper()
		assignment, err := f.store.JoinedWorkspace(ctx, who.AuthUserID, who.ID)
		if err != nil {
			t.Fatal(err)
		}
		return assignment
	}
	bedIDs := func(assignment *JoinedAssignment) []string {
		t.Helper()
		ids := []string{}
		for _, bed := range assignment.AssignedBeds {
			var parsed struct{ ID string }
			if err := json.Unmarshal(bed.Bed, &parsed); err != nil {
				t.Fatal(err)
			}
			ids = append(ids, parsed.ID)
		}
		return ids
	}
	join := func(owner Profile, shift string, nurse string) Profile {
		t.Helper()
		code, _ := f.issue(t, owner, shift, nurse, false)
		joiner := f.newProfile(t, "Joined "+nurse)
		if result, err := f.store.AcceptInvite(ctx, joiner.AuthUserID, joiner.ID, invites.HashCode(code)); err != nil || result.Status != "joined" {
			t.Fatalf("join: %+v, %v", result, err)
		}
		return joiner
	}

	shift := f.stageShift(t, f.alpha.ID, accessSnapshot)
	ninaProfile := join(f.alpha, shift, "n1")

	t.Run("joined nurse sees only the nurse's own beds and requests", func(t *testing.T) {
		got := workspace(ninaProfile)
		if got == nil {
			t.Fatal("no workspace")
		}
		assertMatchesSQLView(t, f, ninaProfile, got)
		if got.ShiftID != shift || got.FloorName != "Test Floor" || got.NurseName != "Nina" ||
			got.Access.NurseID != "n1" || got.Access.Status != "linked" || got.Access.NurseProfileID == nil || *got.Access.NurseProfileID != ninaProfile.ID {
			t.Fatalf("workspace = %+v", got)
		}
		if ids := bedIDs(got); len(ids) != 2 || ids[0] != "b1" || ids[1] != "b3" {
			t.Fatalf("beds = %v", ids)
		}
		encoded, err := json.Marshal(got)
		if err != nil {
			t.Fatal(err)
		}
		var shape map[string]json.RawMessage
		if err := json.Unmarshal(encoded, &shape); err != nil {
			t.Fatal(err)
		}
		for _, key := range []string{"access", "shiftId", "floorName", "nurseName", "assignedBeds", "requestHistory"} {
			if _, ok := shape[key]; !ok {
				t.Fatalf("response lacks %s", key)
			}
		}
		var access map[string]json.RawMessage
		_ = json.Unmarshal(shape["access"], &access)
		for _, key := range []string{"id", "shiftId", "nurseId", "nurseName", "nurseProfileId", "nurseEmail", "status", "createdAt", "updatedAt"} {
			if _, ok := access[key]; !ok {
				t.Fatalf("access lacks %s", key)
			}
		}
		// b3 has no bed state: it must be explicit null, not missing.
		var beds []map[string]json.RawMessage
		_ = json.Unmarshal(shape["assignedBeds"], &beds)
		if string(beds[1]["bedState"]) != "null" || string(beds[0]["bedState"]) == "null" {
			t.Fatalf("bed states = %s / %s", beds[0]["bedState"], beds[1]["bedState"])
		}
		// Omar's request (q2) and Nina's two requests, in snapshot order; Omar's blank-initials bed is not shown.
		var requests []map[string]json.RawMessage
		_ = json.Unmarshal(shape["requestHistory"], &requests)
		if len(requests) != 2 || string(requests[0]["id"]) != `"q1"` || string(requests[1]["id"]) != `"q3"` {
			t.Fatalf("requests = %s", shape["requestHistory"])
		}
		// q1's completed override is not active (it was never created), so it is flagged.
		if string(requests[0]["completedAssignmentChangedLater"]) != "true" {
			t.Fatal("changed-later flag missing")
		}
		if _, flagged := requests[1]["completedAssignmentChangedLater"]; flagged {
			t.Fatal("request without a completed override was flagged")
		}
	})

	t.Run("an active override moves beds between nurses", func(t *testing.T) {
		overrideID := f.stageOverride(t, shift, f.alpha.ID, "b3", "n1", "n2")
		got := workspace(ninaProfile)
		if ids := bedIDs(got); len(ids) != 1 || ids[0] != "b1" {
			t.Fatalf("beds after losing b3 = %v", ids)
		}
		assertMatchesSQLView(t, f, ninaProfile, got)
		// Reassigned away from every bed: still a workspace, with no beds.
		secondOverride := f.stageOverride(t, shift, f.alpha.ID, "b1", "n1", "n2")
		got = workspace(ninaProfile)
		if got == nil || len(bedIDs(got)) != 0 {
			t.Fatalf("workspace after losing all beds = %+v", got)
		}
		assertMatchesSQLView(t, f, ninaProfile, got)
		// The flag clears when the completed override is active again.
		f.exec(t, "UPDATE public.active_shifts SET shift_snapshot = replace(shift_snapshot::text, '00000000-0000-4000-8000-0000000000aa', $2)::jsonb WHERE id = $1", shift, overrideID)
		got = workspace(ninaProfile)
		encoded, _ := json.Marshal(got.RequestHistory)
		if string(encoded) == "" || json.Valid(encoded) == false {
			t.Fatal("invalid request history")
		}
		var requests []map[string]json.RawMessage
		_ = json.Unmarshal(encoded, &requests)
		if _, flagged := requests[0]["completedAssignmentChangedLater"]; flagged {
			t.Fatal("flag stayed after the completed override became active")
		}
		// Superseded overrides no longer count.
		f.exec(t, "UPDATE public.manual_assignment_overrides SET status = 'superseded', superseded_at = now() WHERE id IN ($1, $2)", overrideID, secondOverride)
		if ids := bedIDs(workspace(ninaProfile)); len(ids) != 2 {
			t.Fatalf("beds after supersede = %v", ids)
		}
	})

	t.Run("no workspace without active linked access", func(t *testing.T) {
		if got := workspace(f.beta); got != nil {
			t.Fatalf("a profile with no access received %+v", got)
		}
		stranger := f.newProfile(t, "Stranger")
		if got := workspace(stranger); got != nil {
			t.Fatalf("stranger received %+v", got)
		}
		f.exec(t, "UPDATE public.shift_nurse_access SET status = 'removed' WHERE nurse_profile_id = $1", ninaProfile.ID)
		if got := workspace(ninaProfile); got != nil {
			t.Fatalf("removed access received %+v", got)
		}
		f.exec(t, "UPDATE public.shift_nurse_access SET status = 'linked' WHERE nurse_profile_id = $1", ninaProfile.ID)
		if got := workspace(ninaProfile); got == nil {
			t.Fatal("relinked access lost the workspace")
		}
		f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", shift)
		if got := workspace(ninaProfile); got != nil {
			t.Fatalf("ended shift received %+v", got)
		}
	})

	t.Run("newest linked access wins and users stay isolated", func(t *testing.T) {
		older := f.stageShift(t, f.alpha.ID, accessSnapshot)
		newer := f.stageShift(t, f.beta.ID, accessSnapshot)
		joiner := f.newProfile(t, "Two links")
		other := f.newProfile(t, "Bystander")
		for shiftID, age := range map[string]string{older: "1 hour", newer: "0 hours"} {
			f.exec(t, `INSERT INTO public.shift_nurse_access(shift_id, nurse_id, nurse_name, nurse_profile_id, status, updated_at)
				VALUES ($1, 'n1', 'Nina', $2, 'linked', now() - $3::interval)`, shiftID, joiner.ID, age)
		}
		got := workspace(joiner)
		if got == nil || got.ShiftID != newer {
			t.Fatalf("workspace = %+v, want shift %s", got, newer)
		}
		if workspace(other) != nil {
			t.Fatal("bystander received someone else's workspace")
		}
		// Database level: the joined nurse reads only the shifts they are linked to.
		visibleShifts := 0
		err := f.store.WithIdentity(ctx, other.AuthUserID, func(tx *gorm.DB) error {
			return tx.Raw("SELECT count(*) FROM public.active_shifts").Scan(&visibleShifts).Error
		})
		if err != nil || visibleShifts != 0 {
			t.Fatalf("bystander sees %d shifts (err %v)", visibleShifts, err)
		}
		err = f.store.WithIdentity(ctx, joiner.AuthUserID, func(tx *gorm.DB) error {
			return tx.Raw("SELECT count(*) FROM public.active_shifts").Scan(&visibleShifts).Error
		})
		if err != nil || visibleShifts != 2 {
			t.Fatalf("joiner sees %d shifts (err %v)", visibleShifts, err)
		}
	})
}

// assertMatchesSQLView compares Go's projection with the retained SQL function,
// ignoring only timestamp formatting.
func assertMatchesSQLView(t *testing.T, f *accessFixture, who Profile, got *JoinedAssignment) {
	t.Helper()
	sqlJSON := f.rpcAs(t, who.AuthUserID, "SELECT public.get_joined_nurse_assignment_view()::text")
	normalize := func(raw []byte) map[string]any {
		var view map[string]any
		if err := json.Unmarshal(raw, &view); err != nil {
			t.Fatal(err)
		}
		// Deliberate difference: for a nurse with no beds the SQL function returns
		// null, which the app rejects as invalid. Go returns an empty list.
		if view["assignedBeds"] == nil {
			view["assignedBeds"] = []any{}
		}
		if access, ok := view["access"].(map[string]any); ok {
			delete(access, "createdAt")
			delete(access, "updatedAt")
		}
		return view
	}
	goJSON, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	if want, have := normalize([]byte(sqlJSON)), normalize(goJSON); !reflect.DeepEqual(want, have) {
		t.Fatalf("Go view differs from the SQL function\n sql: %v\n go:  %v", want, have)
	}
}

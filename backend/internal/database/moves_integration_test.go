package database

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"sync"
	"testing"

	"github.com/pratham124/nurse-flow/backend/internal/invites"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
)

// moveSnapshot is an assigned shift. Nina (n1, RN) holds b1 (red) and b2, Omar
// (n2, RN, max 3) holds b3, and Pia (n3, LPN) holds nothing. Everyone covers both
// rooms. r1 is on the admitting side d1. requests is the nurseRequests JSON.
func moveSnapshot(requests string) string {
	return fmt.Sprintf(`{
  "floorName": "Move Floor",
  "futureField": {"keep": true},
  "admittingDoctorSideId": "d1",
  "sideLoadLimits": {"admitting":{"min":1,"max":5},"nonAdmitting":{"min":1,"max":5}},
  "doctorSides": [{"id":"d1","name":"A"},{"id":"d2","name":"B"}],
  "rooms": [{"id":"r1","doctorSideId":"d1","label":"101"},{"id":"r2","doctorSideId":"d2","label":"102"}],
  "beds": [{"id":"b1","roomId":"r1","label":"101A"},{"id":"b2","roomId":"r1","label":"101B"},{"id":"b3","roomId":"r2","label":"102A"}],
  "nurses": [
    {"id":"n1","name":"Nina","licenseType":"RN","maxPatientLoad":3},
    {"id":"n2","name":"Omar","licenseType":"RN","maxPatientLoad":3},
    {"id":"n3","name":"Pia","licenseType":"LPN","maxPatientLoad":3}],
  "bedStates": [
    {"id":"s1","bedId":"b1","patient":{"initials":"AB"},"acuity":"red"},
    {"id":"s2","bedId":"b2","patient":{"initials":"CD"},"acuity":"green"},
    {"id":"s3","bedId":"b3","patient":{"initials":"EF"},"acuity":"yellow"}],
  "assignmentResult": {"id":"res1",
    "bedAssignments":[{"bedId":"b1","nurseId":"n1"},{"bedId":"b2","nurseId":"n1"},{"bedId":"b3","nurseId":"n2"}],
    "roomCoverage":[{"roomId":"r1","nurseIds":["n1","n2","n3"]},{"roomId":"r2","nurseIds":["n1","n2","n3"]}]},
  "nurseRequests": %s
}`, requests)
}

const acceptedSwap = `{"id":"sw1","type":"swap","status":"accepted","requestingNurseId":"n1","requestingNurseName":"Nina","sourceBedId":"b1","message":"swap","createdAt":"2026-10-24T10:00:00Z","futureKey":1}`

// world is one charge nurse with an assigned shift.
type world struct {
	f      *accessFixture
	charge Profile
	shift  string
}

func newWorld(t *testing.T, f *accessFixture, requests string) world {
	t.Helper()
	charge := f.newProfile(t, "Charge")
	return world{f: f, charge: charge, shift: f.stageShift(t, charge.ID, moveSnapshot(requests))}
}

// joinNurse links a fresh profile to the nurse slot through the real invite flow.
func (w world) joinNurse(t *testing.T, nurseID string) Profile {
	t.Helper()
	code, _ := w.f.issue(t, w.charge, w.shift, nurseID, false)
	joiner := w.f.newProfile(t, "Joined "+nurseID)
	if result, err := w.f.store.AcceptInvite(contextForTest(), joiner.AuthUserID, joiner.ID, invites.HashCode(code)); err != nil || result.Status != "joined" {
		t.Fatalf("join: %+v, %v", result, err)
	}
	return joiner
}

func (w world) move(bed, from, to, mutation string, acknowledgements string, swap *string) (MoveOutcome, error) {
	return w.f.store.MoveAssignment(contextForTest(), w.charge.AuthUserID, w.charge.ID, w.shift, shifts.MoveRequest{
		BaselineAssignmentResultID: "res1", BedID: bed, FromNurseID: from, ToNurseID: to,
		WarningAcknowledgements: json.RawMessage(acknowledgements), RelatedSwapRequestID: swap, ClientMutationID: mutation,
	})
}

func (w world) activeOverrides(t *testing.T) int {
	t.Helper()
	return w.f.count(t, "SELECT count(*) FROM public.manual_assignment_overrides WHERE shift_id = $1 AND status = 'active'", w.shift)
}

func (w world) snapshot(t *testing.T) map[string]json.RawMessage {
	t.Helper()
	var decoded map[string]json.RawMessage
	if err := json.Unmarshal([]byte(w.f.text(t, "SELECT shift_snapshot::text FROM public.active_shifts WHERE id = $1", w.shift)), &decoded); err != nil {
		t.Fatal(err)
	}
	return decoded
}

// requestByID reads one stored request from the committed snapshot.
func (w world) requestByID(t *testing.T, id string) map[string]any {
	t.Helper()
	var requests []map[string]any
	if err := json.Unmarshal(w.snapshot(t)["nurseRequests"], &requests); err != nil {
		t.Fatal(err)
	}
	for _, request := range requests {
		if request["id"] == id {
			return request
		}
	}
	t.Fatalf("request %s not found", id)
	return nil
}

func ruleCode(t *testing.T, err error) (code, message string) {
	t.Helper()
	var rule *shifts.RuleError
	if !errors.As(err, &rule) {
		t.Fatalf("want a rule error, got %v", err)
	}
	return rule.Code, rule.Message
}

func str(s string) *string { return &s }

func TestMoveAssignmentIntegration(t *testing.T) {
	f := openAccessFixture(t)

	t.Run("saves one override and bumps only the revision", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		before := f.text(t, "SELECT shift_snapshot::text FROM public.active_shifts WHERE id = $1", w.shift)
		outcome, err := w.move("b2", "n1", "n2", "m1", `[]`, nil)
		if err != nil || outcome.Saved == nil {
			t.Fatalf("%+v %v", outcome, err)
		}
		saved := outcome.Saved.Override
		if saved.BedID != "b2" || saved.FromNurseID != "n1" || saved.ToNurseID != "n2" || saved.Status != "active" ||
			saved.CreatedByProfileID != w.charge.ID || saved.ShiftID != w.shift || saved.BaselineAssignmentResultID != "res1" || saved.ServerSequence == 0 {
			t.Fatalf("%+v", saved)
		}
		if len(outcome.Saved.ActiveAssignmentOverridesByBedID) != 1 || outcome.Saved.ActiveAssignmentOverridesByBedID["b2"].ID != saved.ID {
			t.Fatalf("%+v", outcome.Saved.ActiveAssignmentOverridesByBedID)
		}
		encoded, _ := json.Marshal(outcome.Saved)
		for _, key := range []string{`"shiftId"`, `"bedId"`, `"serverSequence"`, `"warningAcknowledgements":[]`, `"relatedSwapRequestId":null`, `"activeAssignmentOverridesByBedId"`} {
			if !strings.Contains(string(encoded), key) {
				t.Fatalf("response lacks %s: %s", key, encoded)
			}
		}
		if strings.Contains(string(encoded), "supersededAt") {
			t.Fatal("a first save has no supersededAt")
		}
		if after := f.text(t, "SELECT shift_snapshot::text FROM public.active_shifts WHERE id = $1", w.shift); after != before {
			t.Fatal("a plain move must not rewrite the snapshot")
		}
		if same := f.count(t, "SELECT count(*) FROM public.active_shifts s JOIN public.manual_assignment_overrides o ON o.shift_id = s.id WHERE s.id = $1 AND s.updated_at = o.created_at", w.shift); same != 1 {
			t.Fatal("created_at and updated_at must share one timestamp")
		}
	})

	t.Run("a repeated mutation ID replays the first override", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		first, err := w.move("b2", "n1", "n2", "m1", `[]`, nil)
		if err != nil {
			t.Fatal(err)
		}
		// A different payload with the same mutation ID still replays, as in the original.
		again, err := w.move("b1", "n1", "n3", "m1", `[]`, nil)
		if err != nil || again.Saved == nil {
			t.Fatalf("%+v %v", again, err)
		}
		replayed := again.Saved.Override
		if replayed.ID != first.Saved.Override.ID || replayed.BedID != "b2" {
			t.Fatalf("%+v", replayed)
		}
		if replayed.SupersededAt != nil {
			t.Fatalf("an unsuperseded replay has no supersededAt: %+v", replayed)
		}
		if got := f.count(t, "SELECT count(*) FROM public.manual_assignment_overrides WHERE shift_id = $1", w.shift); got != 1 {
			t.Fatalf("%d overrides", got)
		}
	})

	t.Run("a later move supersedes the bed's active override", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		if _, err := w.move("b2", "n1", "n2", "m1", `[]`, nil); err != nil {
			t.Fatal(err)
		}
		outcome, err := w.move("b2", "n2", "n3", "m2", `[]`, nil)
		if err != nil || outcome.Saved == nil {
			t.Fatalf("%+v %v", outcome, err)
		}
		if w.activeOverrides(t) != 1 || f.count(t, "SELECT count(*) FROM public.manual_assignment_overrides WHERE shift_id = $1 AND status = 'superseded' AND superseded_at IS NOT NULL", w.shift) != 1 {
			t.Fatal("expected one active and one superseded override")
		}
		// The superseded first override now replays with its supersededAt set.
		replay, _ := w.move("b2", "n2", "n3", "m1", `[]`, nil)
		if encoded, _ := json.Marshal(replay.Saved.Override); !strings.Contains(string(encoded), `"supersededAt":"`) {
			t.Fatalf("a superseded replay includes supersededAt: %s", encoded)
		}
	})

	t.Run("stale baseline and stale effective nurse are normal results", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		stale, err := w.f.store.MoveAssignment(contextForTest(), w.charge.AuthUserID, w.charge.ID, w.shift, shifts.MoveRequest{
			BaselineAssignmentResultID: "old", BedID: "b2", FromNurseID: "n1", ToNurseID: "n2",
			WarningAcknowledgements: json.RawMessage(`[]`), ClientMutationID: "m1",
		})
		if err != nil || stale.Stale == nil || *stale.Stale.CurrentBaselineAssignmentResultID != "res1" || *stale.Stale.CurrentEffectiveNurseID != "n1" ||
			stale.Stale.Message != "The generated assignment changed. Review the current board and try again." {
			t.Fatalf("%+v %v", stale.Stale, err)
		}
		if _, err := w.move("b2", "n1", "n2", "m2", `[]`, nil); err != nil {
			t.Fatal(err)
		}
		stale, err = w.move("b2", "n1", "n3", "m3", `[]`, nil)
		if err != nil || stale.Stale == nil || *stale.Stale.CurrentEffectiveNurseID != "n2" ||
			stale.Stale.Message != "This bed assignment changed. Review the current board and try again." || len(stale.Stale.ActiveAssignmentOverridesByBedID) != 1 {
			t.Fatalf("%+v %v", stale.Stale, err)
		}
		if w.f.count(t, "SELECT count(*) FROM public.manual_assignment_overrides WHERE shift_id = $1", w.shift) != 1 {
			t.Fatal("a stale move must not write")
		}
	})

	t.Run("rules are rejected as 422 without writing", func(t *testing.T) {
		w := newWorld(t, f, `[`+acceptedSwap+`]`)
		for _, tt := range []struct {
			name, bed, from, to, acks string
			swap                      *string
			message                   string
		}{
			{"target not on shift", "b2", "n1", "ghost", `[]`, nil, "The selected nurse is no longer on this shift."},
			{"red bed to LPN", "b1", "n1", "n3", `[]`, nil, "A red-acuity bed must be assigned to an RN."},
			{"unknown swap", "b2", "n1", "n2", `[]`, str("nope"), "Only an accepted swap for this bed can be linked."},
			{"swap for another bed", "b2", "n1", "n2", `[]`, str("sw1"), "Only an accepted swap for this bed can be linked."},
		} {
			_, err := w.move(tt.bed, tt.from, tt.to, "rule-"+tt.name, tt.acks, tt.swap)
			if code, message := ruleCode(t, err); code != "invalid_move" || message != tt.message {
				t.Fatalf("%s: %s / %s", tt.name, code, message)
			}
		}
		if f.count(t, "SELECT count(*) FROM public.manual_assignment_overrides WHERE shift_id = $1", w.shift) != 0 {
			t.Fatal("rejected moves must not write")
		}
	})

	t.Run("load warnings need acknowledgement and are normalized", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		f.exec(t, `UPDATE public.active_shifts SET shift_snapshot = jsonb_set(shift_snapshot, '{nurses,1,maxPatientLoad}', '1') WHERE id = $1`, w.shift)
		_, err := w.move("b2", "n1", "n2", "m1", `[]`, nil)
		if _, message := ruleCode(t, err); message != "Acknowledge the max-load warning before confirming." {
			t.Fatal(message)
		}
		f.exec(t, `UPDATE public.active_shifts SET shift_snapshot = jsonb_set(shift_snapshot, '{sideLoadLimits,admitting,max}', '1') WHERE id = $1`, w.shift)
		_, err = w.move("b2", "n1", "n2", "m1", `[{"warningType":"over_max_load"}]`, nil)
		if _, message := ruleCode(t, err); message != "Acknowledge the side-load warning before confirming." {
			t.Fatal(message)
		}
		outcome, err := w.move("b2", "n1", "n2", "m1", `[{"warningType":"over_max_load","message":"x"},{"warningType":"over_side_load_limit"},{"warningType":"bogus"}]`, nil)
		if err != nil {
			t.Fatal(err)
		}
		var acks []map[string]any
		if err := json.Unmarshal(outcome.Saved.Override.WarningAcknowledgements, &acks); err != nil || len(acks) != 2 {
			t.Fatalf("%v %v", acks, err)
		}
		if acks[0]["message"] != "Omar has 2 assigned patients, above their max load of 1." || acks[1]["message"] != "Omar has 2 assigned patients, above the side load limit of 1." ||
			acks[0]["acknowledgedByProfileId"] != w.charge.ID {
			t.Fatalf("%v", acks)
		}
	})

	t.Run("other owners and unavailable shifts", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		stranger := f.newProfile(t, "Stranger")
		_, err := f.store.MoveAssignment(contextForTest(), stranger.AuthUserID, stranger.ID, w.shift, shifts.MoveRequest{
			BaselineAssignmentResultID: "res1", BedID: "b2", FromNurseID: "n1", ToNurseID: "n2", WarningAcknowledgements: json.RawMessage(`[]`), ClientMutationID: "m1"})
		if !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("cross-owner: %v", err)
		}
		f.exec(t, "UPDATE public.active_shifts SET status = 'setup' WHERE id = $1", w.shift)
		if _, err := w.move("b2", "n1", "n2", "m1", `[]`, nil); !errors.Is(err, ErrShiftNotAssigned) {
			t.Fatalf("setup shift: %v", err)
		}
		f.exec(t, "UPDATE public.active_shifts SET status = 'assigned', ended_at = now() WHERE id = $1", w.shift)
		if _, err := w.move("b2", "n1", "n2", "m1", `[]`, nil); !errors.Is(err, ErrShiftNotAssigned) {
			t.Fatalf("ended shift: %v", err)
		}
		missing := f.store
		if _, err := missing.MoveAssignment(contextForTest(), w.charge.AuthUserID, w.charge.ID, "00000000-0000-4000-8000-00000000dead", shifts.MoveRequest{}); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("missing shift: %v", err)
		}
	})

	t.Run("concurrent moves of one bed: one wins, one is stale", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		results := make([]MoveOutcome, 2)
		errs := make([]error, 2)
		var wg sync.WaitGroup
		for i, target := range []string{"n2", "n3"} {
			wg.Add(1)
			go func() {
				defer wg.Done()
				results[i], errs[i] = w.move("b2", "n1", target, fmt.Sprintf("race-%d", i), `[]`, nil)
			}()
		}
		wg.Wait()
		saved, stale := 0, 0
		for i := range results {
			if errs[i] != nil {
				t.Fatal(errs[i])
			}
			if results[i].Saved != nil {
				saved++
			}
			if results[i].Stale != nil {
				stale++
			}
		}
		if saved != 1 || stale != 1 || w.activeOverrides(t) != 1 {
			t.Fatalf("saved=%d stale=%d active=%d", saved, stale, w.activeOverrides(t))
		}
	})

	t.Run("a failure after superseding rolls everything back", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		f.exec(t, `CREATE FUNCTION public.m5_forced_failure() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN IF NEW.client_mutation_id = 'boom' THEN RAISE EXCEPTION 'forced failure'; END IF; RETURN NEW; END $$`)
		f.exec(t, `CREATE TRIGGER m5_forced_failure BEFORE INSERT ON public.manual_assignment_overrides
			FOR EACH ROW EXECUTE FUNCTION public.m5_forced_failure()`)
		t.Cleanup(func() {
			f.exec(t, "DROP TRIGGER IF EXISTS m5_forced_failure ON public.manual_assignment_overrides")
			f.exec(t, "DROP FUNCTION IF EXISTS public.m5_forced_failure()")
		})
		if _, err := w.move("b2", "n1", "n2", "m1", `[]`, nil); err != nil {
			t.Fatal(err)
		}
		revision := f.text(t, "SELECT updated_at::text FROM public.active_shifts WHERE id = $1", w.shift)
		if _, err := w.move("b2", "n2", "n3", "boom", `[]`, nil); err == nil {
			t.Fatal("the forced failure must surface")
		}
		if w.activeOverrides(t) != 1 || f.count(t, "SELECT count(*) FROM public.manual_assignment_overrides WHERE shift_id = $1 AND status = 'superseded'", w.shift) != 0 ||
			f.text(t, "SELECT updated_at::text FROM public.active_shifts WHERE id = $1", w.shift) != revision {
			t.Fatal("the failed move changed stored data")
		}
	})

	t.Run("completing an accepted swap stamps it exactly once", func(t *testing.T) {
		w := newWorld(t, f, `[`+acceptedSwap+`]`)
		outcome, err := w.move("b1", "n1", "n2", "m1", `[]`, str("sw1"))
		if err != nil || outcome.Saved == nil {
			t.Fatalf("%+v %v", outcome, err)
		}
		saved := outcome.Saved.Override
		request := w.requestByID(t, "sw1")
		if request["completedOverrideId"] != saved.ID || request["swapCompletedByProfileId"] != w.charge.ID || request["swapCompletedAt"] == nil || request["futureKey"] != float64(1) {
			t.Fatalf("%v", request)
		}
		if string(w.snapshot(t)["futureField"]) != `{"keep": true}` {
			t.Fatal("unknown snapshot keys must survive")
		}
		if f.count(t, "SELECT count(*) FROM public.active_shifts s JOIN public.manual_assignment_overrides o ON o.shift_id = s.id WHERE s.id = $1 AND s.updated_at = o.created_at", w.shift) != 1 {
			t.Fatal("the swap completion and the move must share one revision time")
		}
		// The swap is complete: another move cannot complete it again.
		_, err = w.move("b1", "n2", "n3", "m2", `[]`, str("sw1"))
		if code, _ := ruleCode(t, err); code != "invalid_move" {
			t.Fatalf("second completion: %v", err)
		}
		if w.requestByID(t, "sw1")["completedOverrideId"] != saved.ID {
			t.Fatal("the completion must not change")
		}
	})

	t.Run("matches the original SQL function", func(t *testing.T) {
		acks := `[{"warningType":"over_max_load","message":"x"}]`
		goWorld := newWorld(t, f, `[`+acceptedSwap+`]`)
		sqlWorld := newWorld(t, f, `[`+acceptedSwap+`]`)
		for _, w := range []world{goWorld, sqlWorld} {
			f.exec(t, `UPDATE public.active_shifts SET shift_snapshot = jsonb_set(shift_snapshot, '{nurses,1,maxPatientLoad}', '1') WHERE id = $1`, w.shift)
		}
		goBefore := f.sideEffects(t, goWorld.shift)
		sqlBefore := f.sideEffects(t, sqlWorld.shift)
		if _, err := goWorld.move("b1", "n1", "n2", "m1", acks, str("sw1")); err != nil {
			t.Fatal(err)
		}
		result := f.rpcCommit(t, sqlWorld.charge.AuthUserID,
			"SELECT public.confirm_manual_assignment_override($1::uuid, 'res1', 'b1', 'n1', 'n2', $2::jsonb, 'sw1', 'm1')::text", sqlWorld.shift, acks)
		if goEffects, sqlEffects := f.sideEffects(t, goWorld.shift).minus(goBefore), f.sideEffects(t, sqlWorld.shift).minus(sqlBefore); goEffects != sqlEffects || goEffects.realtime == 0 {
			t.Fatalf("side effects differ: go=%+v sql=%+v", goEffects, sqlEffects)
		}
		var sqlSaved struct {
			Status   string
			Override struct {
				WarningAcknowledgements []map[string]any
				BedID, ToNurseID        string
			}
		}
		if err := json.Unmarshal([]byte(result), &sqlSaved); err != nil || sqlSaved.Status != "saved" {
			t.Fatalf("%s %v", result, err)
		}
		goRequest, sqlRequest := goWorld.requestByID(t, "sw1"), sqlWorld.requestByID(t, "sw1")
		if !reflect.DeepEqual(keysOf(goRequest), keysOf(sqlRequest)) {
			t.Fatalf("request keys differ: %v vs %v", keysOf(goRequest), keysOf(sqlRequest))
		}
		var goAcks []map[string]any
		_ = json.Unmarshal([]byte(f.text(t, "SELECT warning_acknowledgements::text FROM public.manual_assignment_overrides WHERE shift_id = $1", goWorld.shift)), &goAcks)
		if len(goAcks) != 1 || len(sqlSaved.Override.WarningAcknowledgements) != 1 ||
			goAcks[0]["message"] != sqlSaved.Override.WarningAcknowledgements[0]["message"] ||
			!reflect.DeepEqual(keysOf(goAcks[0]), keysOf(sqlSaved.Override.WarningAcknowledgements[0])) {
			t.Fatalf("go=%v sql=%v", goAcks, sqlSaved.Override.WarningAcknowledgements)
		}
	})
}

func keysOf(object map[string]any) []string {
	keys := make([]string, 0, len(object))
	for key := range object {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// effects counts the realtime broadcasts and queued notifications for one shift.
type effects struct{ realtime, notifications int }

func (e effects) minus(other effects) effects {
	return effects{e.realtime - other.realtime, e.notifications - other.notifications}
}

func (f *accessFixture) sideEffects(t *testing.T, shiftID string) effects {
	t.Helper()
	return effects{
		realtime:      f.count(t, "SELECT count(*) FROM realtime.messages WHERE topic LIKE '%' || $1 || '%'", shiftID),
		notifications: f.count(t, "SELECT count(*) FROM public.notification_events WHERE shift_id = $1", shiftID),
	}
}

// rpcCommit runs a retained SQL function as the user and commits, so its effects
// can be compared with Go's. It is used only for comparison.
func (f *accessFixture) rpcCommit(t *testing.T, authUserID, query string, args ...any) string {
	t.Helper()
	tx, err := f.admin.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err := tx.Exec("SELECT set_config('request.jwt.claim.sub', $1, true)", authUserID); err != nil {
		t.Fatal(err)
	}
	var value sql.NullString
	if err := tx.QueryRow(query, args...).Scan(&value); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	return value.String
}

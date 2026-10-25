package shifts

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

// moveFixture is a small assigned shift. Nina (n1, RN, max 2) has beds b1 (red) and
// b2; Omar (n2, LPN, max 1) has the empty bed b3; Pia (n3, RN, max 5) has nothing.
// Room r1 is on the admitting side d1 (limit 2) and r2 is on d2 (limit 3).
func moveFixture() map[string]any {
	return map[string]any{
		"admittingDoctorSideId": "d1",
		"sideLoadLimits": map[string]any{
			"admitting":    map[string]any{"min": 1, "max": 2},
			"nonAdmitting": map[string]any{"min": 1, "max": 3},
		},
		"futureField": map[string]any{"keep": true},
		"rooms": []any{
			map[string]any{"id": "r1", "doctorSideId": "d1"},
			map[string]any{"id": "r2", "doctorSideId": "d2"},
		},
		"beds": []any{
			map[string]any{"id": "b1", "roomId": "r1"},
			map[string]any{"id": "b2", "roomId": "r1"},
			map[string]any{"id": "b3", "roomId": "r2"},
		},
		"nurses": []any{
			map[string]any{"id": "n1", "name": "Nina", "licenseType": "RN", "maxPatientLoad": 2},
			map[string]any{"id": "n2", "name": "Omar", "licenseType": "LPN", "maxPatientLoad": 1},
			map[string]any{"id": "n3", "name": " Pia ", "licenseType": "RN", "maxPatientLoad": 5},
		},
		"bedStates": []any{
			map[string]any{"id": "s1", "bedId": "b1", "patient": map[string]any{"initials": "AB"}, "acuity": "red"},
			map[string]any{"id": "s2", "bedId": "b2", "patient": map[string]any{"initials": "CD"}, "acuity": "green"},
			map[string]any{"id": "s3", "bedId": "b3", "patient": map[string]any{"initials": "  "}},
		},
		"assignmentResult": map[string]any{
			"id": "res1",
			"bedAssignments": []any{
				map[string]any{"bedId": "b1", "nurseId": "n1"},
				map[string]any{"bedId": "b2", "nurseId": "n1"},
				map[string]any{"bedId": "b3", "nurseId": "n2"},
			},
			"roomCoverage": []any{
				map[string]any{"roomId": "r1", "nurseIds": []any{"n1", "n3"}},
				map[string]any{"roomId": "r2", "nurseIds": []any{"n2", "n3"}},
			},
		},
		"nurseRequests": []any{
			map[string]any{"id": "swap-ok", "type": "swap", "status": "accepted", "sourceBedId": "b1", "requestingNurseId": "n1"},
			map[string]any{"id": "swap-done", "type": "swap", "status": "accepted", "sourceBedId": "b1", "requestingNurseId": "n1", "completedOverrideId": "o9"},
			map[string]any{"id": "swap-pending", "type": "swap", "status": "pending", "sourceBedId": "b1", "requestingNurseId": "n1"},
			map[string]any{"id": "swap-other-nurse", "type": "swap", "status": "accepted", "sourceBedId": "b1", "requestingNurseId": "n2"},
		},
	}
}

func decodeFixture(t *testing.T, change func(map[string]any)) Snapshot {
	t.Helper()
	data := moveFixture()
	if change != nil {
		change(data)
	}
	raw, err := json.Marshal(data)
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := Decode(raw)
	if err != nil {
		t.Fatal(err)
	}
	return snapshot
}

func validMove() MoveRequest {
	return MoveRequest{
		BaselineAssignmentResultID: "res1", BedID: "b2", FromNurseID: "n1", ToNurseID: "n3",
		WarningAcknowledgements: json.RawMessage(`[]`), ClientMutationID: "m1",
	}
}

var moveTime = time.Date(2026, 10, 24, 12, 0, 0, 123456000, time.UTC)

func ruleMessage(t *testing.T, err error) string {
	t.Helper()
	var rule *RuleError
	if !errors.As(err, &rule) {
		t.Fatalf("want a RuleError, got %v", err)
	}
	return rule.Message
}

func TestMoveRequestValidate(t *testing.T) {
	for _, tt := range []struct {
		name   string
		change func(*MoveRequest)
		want   string
	}{
		{"valid", func(*MoveRequest) {}, ""},
		{"blank baseline", func(r *MoveRequest) { r.BaselineAssignmentResultID = "  " }, "The generated assignment baseline is required."},
		{"blank bed", func(r *MoveRequest) { r.BedID = "" }, "Choose a bed, current nurse, and target nurse."},
		{"blank from", func(r *MoveRequest) { r.FromNurseID = " " }, "Choose a bed, current nurse, and target nurse."},
		{"blank to", func(r *MoveRequest) { r.ToNurseID = "" }, "Choose a bed, current nurse, and target nurse."},
		{"same nurse", func(r *MoveRequest) { r.ToNurseID = "n1" }, "Choose a different nurse for this bed."},
		{"blank mutation", func(r *MoveRequest) { r.ClientMutationID = " " }, "A client mutation ID is required."},
		{"missing acknowledgements", func(r *MoveRequest) { r.WarningAcknowledgements = nil }, "Warning acknowledgements must be an array."},
		{"null acknowledgements", func(r *MoveRequest) { r.WarningAcknowledgements = json.RawMessage(`null`) }, "Warning acknowledgements must be an array."},
		{"object acknowledgements", func(r *MoveRequest) { r.WarningAcknowledgements = json.RawMessage(`{}`) }, "Warning acknowledgements must be an array."},
	} {
		t.Run(tt.name, func(t *testing.T) {
			request := validMove()
			tt.change(&request)
			err := request.Validate()
			if tt.want == "" {
				if err != nil {
					t.Fatal(err)
				}
				return
			}
			if got := ruleMessage(t, err); got != tt.want {
				t.Fatalf("got %q want %q", got, tt.want)
			}
		})
	}
}

func TestPlanMoveStale(t *testing.T) {
	snapshot := decodeFixture(t, nil)
	t.Run("baseline changed", func(t *testing.T) {
		request := validMove()
		request.BaselineAssignmentResultID = "old"
		plan, err := snapshot.PlanMove(request, nil, "profile", moveTime)
		if err != nil || plan.Stale == nil {
			t.Fatalf("plan=%+v err=%v", plan, err)
		}
		if plan.Stale.Message != "The generated assignment changed. Review the current board and try again." ||
			*plan.Stale.CurrentBaselineID != "res1" || *plan.Stale.CurrentEffectiveNurseID != "n1" {
			t.Fatalf("%+v", plan.Stale)
		}
	})
	t.Run("effective nurse changed by an override", func(t *testing.T) {
		overrides := []ActiveOverride{{ID: "o1", BedID: "b2", ToNurseID: "n3"}}
		plan, err := snapshot.PlanMove(validMove(), overrides, "profile", moveTime)
		if err != nil || plan.Stale == nil {
			t.Fatalf("plan=%+v err=%v", plan, err)
		}
		if plan.Stale.Message != "This bed assignment changed. Review the current board and try again." || *plan.Stale.CurrentEffectiveNurseID != "n3" {
			t.Fatalf("%+v", plan.Stale)
		}
	})
	t.Run("bed without an assignment has no effective nurse", func(t *testing.T) {
		request := validMove()
		request.BedID = "unknown"
		plan, err := snapshot.PlanMove(request, nil, "profile", moveTime)
		if err != nil || plan.Stale == nil || plan.Stale.CurrentEffectiveNurseID != nil {
			t.Fatalf("plan=%+v err=%v", plan, err)
		}
	})
}

func TestPlanMoveRules(t *testing.T) {
	for _, tt := range []struct {
		name   string
		change func(map[string]any)
		move   func(*MoveRequest)
		want   string
	}{
		{"bed removed from the shift", func(d map[string]any) { d["beds"] = []any{} }, nil, "This bed is no longer part of the active shift."},
		{"no bed state", func(d map[string]any) { d["bedStates"] = []any{} }, nil, "Only an occupied bed can be moved."},
		{"blank patient", nil, func(r *MoveRequest) { r.BedID, r.FromNurseID = "b3", "n2" }, "Only an occupied bed can be moved."},
		{"target not on shift", nil, func(r *MoveRequest) { r.ToNurseID = "ghost" }, "The selected nurse is no longer on this shift."},
		{"target does not cover room", nil, func(r *MoveRequest) { r.ToNurseID = "n2" }, "The selected nurse does not cover this room."},
		{"red bed needs an RN", func(d map[string]any) {
			d["assignmentResult"].(map[string]any)["roomCoverage"] = []any{map[string]any{"roomId": "r1", "nurseIds": []any{"n1", "n2"}}}
		}, func(r *MoveRequest) { r.BedID, r.ToNurseID = "b1", "n2" }, "A red-acuity bed must be assigned to an RN."},
		{"swap does not exist", nil, func(r *MoveRequest) { r.RelatedSwapRequestID = ptr("nope") }, "Only an accepted swap for this bed can be linked."},
		{"swap still pending", nil, func(r *MoveRequest) { r.BedID, r.RelatedSwapRequestID = "b1", ptr("swap-pending") }, "Only an accepted swap for this bed can be linked."},
		{"swap for another bed", nil, func(r *MoveRequest) { r.RelatedSwapRequestID = ptr("swap-ok") }, "Only an accepted swap for this bed can be linked."},
		{"swap owned by another nurse", nil, func(r *MoveRequest) { r.BedID, r.RelatedSwapRequestID = "b1", ptr("swap-other-nurse") }, "Only an uncompleted accepted swap owned by the current nurse can be completed."},
		{"swap already completed", nil, func(r *MoveRequest) { r.BedID, r.RelatedSwapRequestID = "b1", ptr("swap-done") }, "Only an uncompleted accepted swap owned by the current nurse can be completed."},
		{"over max load without acknowledgement", func(d map[string]any) {
			d["nurses"].([]any)[2].(map[string]any)["maxPatientLoad"] = 0
		}, nil, "Acknowledge the max-load warning before confirming."},
		{"over side limit without acknowledgement", func(d map[string]any) {
			d["sideLoadLimits"].(map[string]any)["admitting"] = map[string]any{"min": 1, "max": 0}
		}, nil, "Acknowledge the side-load warning before confirming."},
	} {
		t.Run(tt.name, func(t *testing.T) {
			request := validMove()
			if tt.move != nil {
				tt.move(&request)
			}
			snapshot := decodeFixture(t, tt.change)
			_, err := snapshot.PlanMove(request, nil, "profile", moveTime)
			if got := ruleMessage(t, err); got != tt.want {
				t.Fatalf("got %q want %q", got, tt.want)
			}
		})
	}
}

func ptr(s string) *string { return &s }

func TestPlanMoveLoadUsesEffectiveNurses(t *testing.T) {
	// n3 already holds b3 through an override; moving b2 makes two beds on n3,
	// above the admitting-side limit of 1 set here (n3 covers r1, an admitting room).
	snapshot := decodeFixture(t, func(d map[string]any) {
		d["sideLoadLimits"].(map[string]any)["admitting"] = map[string]any{"min": 1, "max": 1}
	})
	overrides := []ActiveOverride{{ID: "o1", BedID: "b3", ToNurseID: "n3"}}
	_, err := snapshot.PlanMove(validMove(), overrides, "profile", moveTime)
	if got := ruleMessage(t, err); got != "Acknowledge the side-load warning before confirming." {
		t.Fatal(got)
	}
	// Without the override n3 would hold one bed, which is within the limit.
	if _, err := snapshot.PlanMove(validMove(), nil, "profile", moveTime); err != nil {
		t.Fatal(err)
	}
}

func TestPlanMoveSideLimitUsesNonAdmittingForOtherSide(t *testing.T) {
	// Moving b3 (room r2, non-admitting side) to n3, who also covers only r2 for it.
	snapshot := decodeFixture(t, func(d map[string]any) {
		d["assignmentResult"].(map[string]any)["roomCoverage"] = []any{
			map[string]any{"roomId": "r1", "nurseIds": []any{"n1"}},
			map[string]any{"roomId": "r2", "nurseIds": []any{"n2", "n3"}},
		}
		d["bedStates"].([]any)[2] = map[string]any{"id": "s3", "bedId": "b3", "patient": map[string]any{"initials": "EF"}}
		d["sideLoadLimits"].(map[string]any)["admitting"] = map[string]any{"min": 1, "max": 0}
	})
	request := validMove()
	request.BedID, request.FromNurseID = "b3", "n2"
	if _, err := snapshot.PlanMove(request, nil, "profile", moveTime); err != nil {
		t.Fatalf("the admitting limit must not apply: %v", err)
	}
}

func TestPlanMoveNormalizesAcknowledgements(t *testing.T) {
	snapshot := decodeFixture(t, func(d map[string]any) {
		d["nurses"].([]any)[2].(map[string]any)["maxPatientLoad"] = 0
		d["sideLoadLimits"].(map[string]any)["admitting"] = map[string]any{"min": 1, "max": 0}
	})
	request := validMove()
	request.WarningAcknowledgements = json.RawMessage(`[
		{"id":"keep-me","warningType":"over_max_load","message":"client text","nurseId":"n3","bedId":"b2"},
		{"warningType":"over_side_load_limit","message":"client text"},
		{"warningType":"team_imbalance","message":"  uneven  "},
		{"warningType":"team_imbalance","message":"   "},
		{"warningType":"made_up","message":"drop"},
		"not an object"]`)
	plan, err := snapshot.PlanMove(request, nil, "profile-1", moveTime)
	if err != nil {
		t.Fatal(err)
	}
	var acks []map[string]any
	if err := json.Unmarshal(plan.Acknowledgements, &acks); err != nil {
		t.Fatal(err)
	}
	if len(acks) != 3 {
		t.Fatalf("got %d acknowledgements: %s", len(acks), plan.Acknowledgements)
	}
	if acks[0]["id"] != "keep-me" || acks[0]["message"] != "Pia has 1 assigned patients, above their max load of 0." ||
		acks[0]["nurseId"] != "n3" || acks[0]["bedId"] != "b2" {
		t.Fatalf("%v", acks[0])
	}
	// "override-warning-" followed by 32 hex digits of a UUID.
	if generated := acks[1]["id"].(string); !strings.HasPrefix(generated, "override-warning-") || len(generated) != len("override-warning-")+32 {
		t.Fatalf("generated id %v", acks[1]["id"])
	}
	if acks[1]["message"] != "Pia has 1 assigned patients, above the side load limit of 0." {
		t.Fatalf("%v", acks[1])
	}
	if _, has := acks[1]["nurseId"]; has {
		t.Fatal("absent nurseId must stay absent")
	}
	if acks[2]["message"] != "  uneven  " {
		t.Fatalf("%v", acks[2])
	}
	for _, ack := range acks {
		if ack["acknowledgedByProfileId"] != "profile-1" || ack["acknowledgedAt"] != "2026-10-24T12:00:00.123456Z" {
			t.Fatalf("%v", ack)
		}
	}
}

func TestPlanMoveSuccessWithLinkedSwap(t *testing.T) {
	snapshot := decodeFixture(t, nil)
	request := validMove()
	request.BedID, request.ToNurseID, request.RelatedSwapRequestID = "b1", "n3", ptr("swap-ok")
	plan, err := snapshot.PlanMove(request, nil, "profile", moveTime)
	if err != nil || plan.Stale != nil || string(plan.Acknowledgements) != "[]" {
		t.Fatalf("plan=%+v ack=%s err=%v", plan, plan.Acknowledgements, err)
	}
}

func TestFormatTime(t *testing.T) {
	if got := FormatTime(moveTime); got != "2026-10-24T12:00:00.123456Z" {
		t.Fatal(got)
	}
}

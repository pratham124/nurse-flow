package shifts

import (
	"encoding/json"
	"testing"
	"time"
)

var requestTime = time.Date(2026, 10, 24, 13, 30, 0, 0, time.UTC)

// requestsOf reads the request objects out of a snapshot produced by the code under test.
func requestsOf(t *testing.T, raw json.RawMessage) []map[string]any {
	t.Helper()
	var snapshot struct {
		NurseRequests []map[string]any `json:"nurseRequests"`
	}
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		t.Fatal(err)
	}
	return snapshot.NurseRequests
}

func objectOf(t *testing.T, raw json.RawMessage) map[string]any {
	t.Helper()
	var object map[string]any
	if err := json.Unmarshal(raw, &object); err != nil {
		t.Fatal(err)
	}
	return object
}

var nina = NurseSlot{ID: "n1", Name: "Nina"}

func TestAddIssueRequest(t *testing.T) {
	snapshot := decodeFixture(t, func(d map[string]any) {
		d["nurseRequests"] = []any{map[string]any{"id": "old", "type": "issue", "status": "pending", "requestingNurseId": "n1", "message": "Pump broken", "futureKey": 7}}
	})
	change, err := snapshot.AddIssueRequest(nina, "  Need help  ", requestTime)
	if err != nil {
		t.Fatal(err)
	}
	requests := requestsOf(t, change.Snapshot)
	if len(requests) != 2 || requests[0]["futureKey"] != float64(7) {
		t.Fatalf("existing request must be preserved: %v", requests)
	}
	added := objectOf(t, change.Request)
	id, _ := added["id"].(string)
	if len(id) != len("nurse-request-")+32 || id[:14] != "nurse-request-" {
		t.Fatalf("id %q", id)
	}
	for key, want := range map[string]any{"type": "issue", "status": "pending", "requestingNurseId": "n1", "requestingNurseName": "Nina", "message": "Need help", "createdAt": "2026-10-24T13:30:00Z"} {
		if added[key] != want {
			t.Fatalf("%s = %v, want %v", key, added[key], want)
		}
	}
	if _, has := added["sourceBedId"]; has {
		t.Fatal("an issue has no source bed")
	}
	if requests[1]["id"] != id {
		t.Fatal("the new request must be last")
	}
	if objectOf(t, change.Snapshot)["futureField"] == nil {
		t.Fatal("unknown snapshot keys must be preserved")
	}
}

func TestAddIssueRequestRules(t *testing.T) {
	snapshot := decodeFixture(t, func(d map[string]any) {
		d["nurseRequests"] = []any{
			map[string]any{"id": "p", "type": "issue", "status": "pending", "requestingNurseId": "n1", "message": "Pump  Broken"},
			map[string]any{"id": "r", "type": "issue", "status": "resolved", "requestingNurseId": "n1", "message": "old issue"},
			map[string]any{"id": "bed", "type": "issue", "status": "pending", "requestingNurseId": "n1", "message": "bed note", "sourceBedId": "b1"},
			map[string]any{"id": "o", "type": "issue", "status": "pending", "requestingNurseId": "n2", "message": "other nurse"},
		}
	})
	if _, err := snapshot.AddIssueRequest(nina, "   ", requestTime); ruleMessage(t, err) != "Add issue details before submitting." {
		t.Fatal(err)
	}
	var rule *RuleError
	for message, wantErr := range map[string]bool{"pump  broken": true, "  PUMP  BROKEN ": true, "Pump Broken": false, "old issue": false, "bed note": false, "other nurse": false} {
		_, err := snapshot.AddIssueRequest(nina, message, requestTime)
		if wantErr {
			if ruleMessage(t, err) != "This issue is already pending." {
				t.Fatalf("%q: %v", message, err)
			}
			rule = err.(*RuleError)
			if rule.Code != "request_pending" {
				t.Fatal(rule.Code)
			}
		} else if err != nil {
			t.Fatalf("%q: %v", message, err)
		}
	}
}

func TestAddSwapRequest(t *testing.T) {
	snapshot := decodeFixture(t, nil)
	if _, err := snapshot.AddSwapRequest(nina, " ", "note", nil, requestTime); ruleMessage(t, err) != "Choose the assigned bed for this swap request." {
		t.Fatal(err)
	}
	if _, err := snapshot.AddSwapRequest(nina, "b1", " ", nil, requestTime); ruleMessage(t, err) != "Add swap details before submitting." {
		t.Fatal(err)
	}
	change, err := snapshot.AddSwapRequest(nina, "b1", " Please swap ", nil, requestTime)
	if err != nil {
		t.Fatal(err)
	}
	added := objectOf(t, change.Request)
	if added["type"] != "swap" || added["sourceBedId"] != "b1" || added["message"] != "Please swap" || added["status"] != "pending" {
		t.Fatalf("%v", added)
	}
	if got := len(requestsOf(t, change.Snapshot)); got != 5 {
		t.Fatalf("expected the new request after the 4 existing ones, got %d", got)
	}
}

func TestAddSwapRequestUsesEffectiveNurse(t *testing.T) {
	snapshot := decodeFixture(t, nil)
	moved := []ActiveOverride{{ID: "o1", BedID: "b1", ToNurseID: "n3"}}
	for _, tt := range []struct {
		name      string
		nurse     NurseSlot
		bed       string
		overrides []ActiveOverride
		ok        bool
	}{
		{"generated owner", nina, "b1", nil, true},
		{"bed moved away", nina, "b1", moved, false},
		{"bed moved to the nurse", NurseSlot{ID: "n3", Name: "Pia"}, "b1", moved, true},
		{"someone else's bed", nina, "b3", nil, false},
		{"bed without an assignment", nina, "nope", nil, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, err := snapshot.AddSwapRequest(tt.nurse, tt.bed, "please", tt.overrides, requestTime)
			if tt.ok && err != nil {
				t.Fatal(err)
			}
			if !tt.ok && ruleMessage(t, err) != "Choose one of your assigned beds for the swap." {
				t.Fatal(err)
			}
		})
	}
}

func TestAddSwapRequestDuplicate(t *testing.T) {
	snapshot := decodeFixture(t, nil) // contains pending "swap-pending" for b1 with no message
	first, err := snapshot.AddSwapRequest(nina, "b1", "Please", nil, requestTime)
	if err != nil {
		t.Fatal(err)
	}
	again, err := Decode(first.Snapshot)
	if err != nil {
		t.Fatal(err)
	}
	_, err = again.AddSwapRequest(nina, "b1", " please ", nil, requestTime)
	if ruleMessage(t, err) != "This swap request is already pending." {
		t.Fatal(err)
	}
	if _, err := again.AddSwapRequest(nina, "b2", "please", nil, requestTime); err != nil {
		t.Fatalf("a different bed is not a duplicate: %v", err)
	}
}

func issueSnapshot(t *testing.T, status string) Snapshot {
	t.Helper()
	return decodeFixture(t, func(d map[string]any) {
		issue := map[string]any{"id": "i1", "type": "issue", "status": "pending", "requestingNurseId": "n1", "extra": "keep"}
		if status != "" {
			issue["issueReviewStatus"] = status
		}
		d["nurseRequests"] = []any{issue, map[string]any{"id": "swap1", "type": "swap", "status": "pending"}}
	})
}

func TestSetIssueStatusTransitions(t *testing.T) {
	for _, tt := range []struct {
		name, from, to string
		changed        bool
		message        string
	}{
		{"open to reviewed", "", "reviewed", true, ""},
		{"open to resolved", "open", "resolved", true, ""},
		{"reviewed to resolved", "reviewed", "resolved", true, ""},
		{"resolved to open", "resolved", "open", true, ""},
		{"no-op", "reviewed", "reviewed", false, ""},
		{"default open no-op", "", "open", false, ""},
		{"reviewed to open", "reviewed", "open", false, "That issue status change is not allowed."},
		{"resolved to reviewed", "resolved", "reviewed", false, "That issue status change is not allowed."},
	} {
		t.Run(tt.name, func(t *testing.T) {
			change, err := issueSnapshot(t, tt.from).SetIssueStatus(" i1 ", tt.to, "profile", requestTime)
			if tt.message != "" {
				if ruleMessage(t, err) != tt.message {
					t.Fatal(err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if (change.Snapshot != nil) != tt.changed {
				t.Fatalf("changed=%v want %v", change.Snapshot != nil, tt.changed)
			}
			if change.Snapshot == nil {
				if change.Snapshot != nil || objectOf(t, change.Request)["id"] != "i1" {
					t.Fatalf("a no-op must not rewrite the snapshot: %+v", change)
				}
				return
			}
			request := requestsOf(t, change.Snapshot)[0]
			if request["issueReviewStatus"] != tt.to || request["extra"] != "keep" {
				t.Fatalf("%v", request)
			}
		})
	}
}

func TestSetIssueStatusAuditFields(t *testing.T) {
	reviewed, err := issueSnapshot(t, "").SetIssueStatus("i1", "reviewed", "p1", requestTime)
	if err != nil {
		t.Fatal(err)
	}
	request := objectOf(t, reviewed.Request)
	if request["reviewedAt"] != "2026-10-24T13:30:00Z" || request["reviewedByProfileId"] != "p1" {
		t.Fatalf("%v", request)
	}
	again, _ := Decode(reviewed.Snapshot)
	resolved, err := again.SetIssueStatus("i1", "resolved", "p2", requestTime)
	if err != nil {
		t.Fatal(err)
	}
	request = objectOf(t, resolved.Request)
	if request["issueResolvedAt"] == nil || request["issueResolvedByProfileId"] != "p2" || request["reviewedAt"] == nil {
		t.Fatalf("resolving keeps the review audit: %v", request)
	}
	again, _ = Decode(resolved.Snapshot)
	reopened, err := again.SetIssueStatus("i1", "open", "p3", requestTime)
	if err != nil {
		t.Fatal(err)
	}
	request = objectOf(t, reopened.Request)
	for _, key := range []string{"reviewedAt", "reviewedByProfileId", "issueResolvedAt", "issueResolvedByProfileId"} {
		if _, has := request[key]; has {
			t.Fatalf("%s must be dropped: %v", key, request)
		}
	}
	if request["issueReviewStatus"] != "open" || request["extra"] != "keep" {
		t.Fatalf("%v", request)
	}
	// Reviewing again after a resolve drops the resolved audit fields.
	again, _ = Decode(resolved.Snapshot)
	back := again
	back["nurseRequests"] = mustJSON(t, []map[string]any{{"id": "i1", "type": "issue", "issueReviewStatus": "open", "issueResolvedAt": "x", "issueResolvedByProfileId": "y"}})
	reviewedAgain, err := back.SetIssueStatus("i1", "reviewed", "p4", requestTime)
	if err != nil {
		t.Fatal(err)
	}
	request = objectOf(t, reviewedAgain.Request)
	if _, has := request["issueResolvedAt"]; has || request["reviewedByProfileId"] != "p4" {
		t.Fatalf("%v", request)
	}
}

func mustJSON(t *testing.T, value any) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestSetIssueStatusErrors(t *testing.T) {
	snapshot := issueSnapshot(t, "")
	if err := ValidateIssueStatus("closed"); ruleMessage(t, err) != "Choose open, reviewed, or resolved." {
		t.Fatal(err)
	}
	for _, id := range []string{"missing", "swap1", ""} {
		_, err := snapshot.SetIssueStatus(id, "reviewed", "p", requestTime)
		if ruleMessage(t, err) != "The issue request is unavailable." || err.(*RuleError).Code != "request_not_found" {
			t.Fatalf("%q: %v", id, err)
		}
	}
}

func TestResolveSwap(t *testing.T) {
	snapshot := decodeFixture(t, nil)
	if err := ValidateResolution("done"); ruleMessage(t, err) != "Choose accepted or declined." {
		t.Fatal(err)
	}
	for status, note := range map[string]string{"accepted": "Accepted by charge", "declined": "Declined by charge"} {
		change, err := snapshot.ResolveSwap("swap-pending", status, requestTime)
		if err != nil {
			t.Fatal(err)
		}
		request := objectOf(t, change.Request)
		if request["status"] != status || request["resolutionNote"] != note || request["resolvedAt"] != "2026-10-24T13:30:00Z" || request["sourceBedId"] != "b1" {
			t.Fatalf("%v", request)
		}
		if got := len(requestsOf(t, change.Snapshot)); got != 4 {
			t.Fatalf("got %d requests", got)
		}
	}
	for _, id := range []string{"swap-ok", "missing"} {
		_, err := snapshot.ResolveSwap(id, "accepted", requestTime)
		if ruleMessage(t, err) != "Only pending swap requests can be resolved." || err.(*RuleError).Code != "request_not_pending" {
			t.Fatalf("%q: %v", id, err)
		}
	}
}

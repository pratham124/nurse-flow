package shifts

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/templates"
)

func testSnapshot(t *testing.T) (Snapshot, Setup) {
	t.Helper()
	var layout templates.Snapshot
	if err := json.Unmarshal([]byte(`{"id":"template","name":"Floor","doctorSides":[{"id":"a","name":"A"},{"id":"b","name":"B"}],"rooms":[{"id":"r","doctorSideId":"a","label":"101","bedCount":2}],"beds":[{"id":"one","roomId":"r","label":"101-1","bedNumber":1},{"id":"two","roomId":"r","label":"101-2","bedNumber":2}]}`), &layout); err != nil {
		t.Fatal(err)
	}
	raw, err := New(layout, "server-id", time.Date(2026, 10, 18, 12, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := Decode(raw)
	if err != nil {
		t.Fatal(err)
	}
	var setup Setup
	if err := json.Unmarshal(raw, &setup); err != nil {
		t.Fatal(err)
	}
	return snapshot, setup
}

func TestNewShiftAndSetupPreserveAuthority(t *testing.T) {
	s, setup := testSnapshot(t)
	if string(s["id"]) != `"server-id"` || string(s["floorTemplateId"]) != `"template"` || string(s["status"]) != `"setup"` {
		t.Fatal("server metadata missing")
	}
	if setup.Nurses == nil || len(setup.Nurses) != 0 || len(setup.BedStates) != 2 || setup.BedStates[0].ID == setup.BedStates[1].ID || setup.SideLoadLimits.Admitting != (LoadRange{4, 5}) {
		t.Fatal("defaults changed")
	}
	for _, key := range []string{"nurses", "flags", "nurseRequests"} {
		if string(s[key]) != "[]" {
			t.Fatalf("%s must start as an empty JSON array", key)
		}
	}
	if string(s["floorName"]) != `"Floor"` || string(s["startedAt"]) != `"2026-10-18T12:00:00Z"` || string(s["admittingDoctorSideId"]) != `""` {
		t.Fatal("initial snapshot JSON fields changed")
	}
	_ = s.set("nurseRequests", []any{map[string]any{"id": "request", "status": "accepted"}})
	_ = s.set("futureField", map[string]any{"keep": true})
	protected := map[string]json.RawMessage{}
	for _, key := range []string{"id", "floorTemplateId", "floorName", "startedAt", "doctorSides", "rooms", "beds", "status", "nurseRequests", "futureField", "flags"} {
		protected[key] = s[key]
	}
	setup.AdmittingDoctorSideID = "b"
	setup.Nurses = []Nurse{{"n", "Nurse", "LPN", "experienced", 5}}
	setup.BedStates[0].Patient = &Patient{Initials: "AB"}
	setup.BedStates[0].Acuity = "red"
	raw, err := s.ApplySetup(setup)
	if err != nil {
		t.Fatal(err)
	}
	result, err := Decode(raw)
	if err != nil {
		t.Fatal(err)
	}
	for key, value := range protected {
		var before, after any
		_ = json.Unmarshal(value, &before)
		_ = json.Unmarshal(result[key], &after)
		if !reflect.DeepEqual(before, after) {
			t.Fatalf("setup changed protected %s", key)
		}
	}
}

func TestSetupValidation(t *testing.T) {
	for _, test := range []struct {
		name   string
		change func(*Setup)
	}{
		{"foreign side", func(s *Setup) { s.AdmittingDoctorSideID = "foreign" }},
		{"inverted limits", func(s *Setup) { s.SideLoadLimits.Admitting = LoadRange{6, 5} }},
		{"limits too large", func(s *Setup) { s.SideLoadLimits.NonAdmitting.Max = 13 }},
		{"missing nurses", func(s *Setup) { s.Nurses = nil }},
		{"missing bed", func(s *Setup) { s.BedStates = s.BedStates[:1] }},
		{"foreign bed", func(s *Setup) { s.BedStates[0].BedID = "foreign" }},
		{"duplicate bed", func(s *Setup) { s.BedStates[0].BedID = s.BedStates[1].BedID }},
		{"duplicate state", func(s *Setup) { s.BedStates[0].ID = s.BedStates[1].ID }},
		{"invalid acuity", func(s *Setup) { s.BedStates[0].Acuity = "purple" }},
		{"negative age", func(s *Setup) { age := -1; s.BedStates[0].Patient = &Patient{Initials: "AB", Age: &age} }},
		{"initials over two characters", func(s *Setup) { s.BedStates[0].Patient = &Patient{Initials: "ABC"} }},
		{"invalid license", func(s *Setup) { s.Nurses = []Nurse{{"n", "Nurse", "doctor", "mid", 5}} }},
		{"duplicate nurse", func(s *Setup) { n := Nurse{"n", "Nurse", "RN", "mid", 5}; s.Nurses = []Nurse{n, n} }},
	} {
		t.Run(test.name, func(t *testing.T) {
			snapshot, setup := testSnapshot(t)
			test.change(&setup)
			if _, err := snapshot.ApplySetup(setup); !errors.Is(err, ErrInvalidSetup) {
				t.Fatal("invalid setup accepted")
			}
		})
	}
	// Incomplete carry-over is intentionally saved before later review screens.
	s, setup := testSnapshot(t)
	setup.Nurses = []Nurse{{"n", "Nurse", "RN", "new_grad", 0}}
	setup.BedStates[0].Patient = &Patient{Initials: ""}
	if err := setup.Validate(s); err != nil {
		t.Fatal("unfinished setup rejected")
	}
	// The two-character limit counts trimmed characters, not bytes.
	setup.BedStates[0].Patient = &Patient{Initials: " ÉÖ "}
	if err := setup.Validate(s); err != nil {
		t.Fatal("two accented initials rejected")
	}
}

func TestReopenAndCarryOver(t *testing.T) {
	s, setup := testSnapshot(t)
	setup.Nurses = []Nurse{{"n", "Nurse", "RN", "mid", 5}}
	setup.BedStates[0].Patient = &Patient{Initials: " AB ", Diagnosis: "Example"}
	setup.BedStates[0].Acuity = "yellow"
	setup.BedStates[1].Patient = &Patient{Initials: "  "}
	if _, err := s.ApplySetup(setup); err != nil {
		t.Fatal(err)
	}
	_ = s.set("assignmentResult", map[string]any{"id": " baseline "})
	_ = s.set("flags", []string{"flag"})
	_ = s.set("nurseRequests", []string{"keep"})
	if s.BaselineID() != "baseline" {
		t.Fatal("baseline normalization changed")
	}
	nurses, patients, err := s.CarryOver()
	if err != nil || len(nurses) != 1 || len(patients) != 1 || nurses[0].PreviousNurseID != "n" || patients[0].PreviousBedLabel != "101-1" || patients[0].Patient.Initials != " AB " || patients[0].Acuity != "yellow" {
		t.Fatalf("carry-over changed: %v", err)
	}
	if nurses[0].ID == nurses[0].PreviousNurseID {
		t.Fatal("suggestion reused nurse identity")
	}
	raw, err := s.Reopen()
	if err != nil {
		t.Fatal(err)
	}
	reset, _ := Decode(raw)
	if reset.BaselineID() != "" || string(reset["status"]) != `"setup"` || string(reset["flags"]) != "[]" || string(reset["nurseRequests"]) != `["keep"]` {
		t.Fatal("reopen lost workflow state")
	}
}

func TestBaselineIDFallback(t *testing.T) {
	for _, test := range []struct {
		name string
		raw  json.RawMessage
		want string
	}{
		{"missing", nil, ""},
		{"null", json.RawMessage(`null`), ""},
		{"missing ID", json.RawMessage(`{}`), ""},
		{"malformed JSON", json.RawMessage(`{"id":`), ""},
		{"wrong ID type", json.RawMessage(`{"id":42}`), ""},
		{"wrong result shape", json.RawMessage(`[]`), ""},
		{"trimmed ID", json.RawMessage(`{"id":" baseline "}`), "baseline"},
	} {
		t.Run(test.name, func(t *testing.T) {
			snapshot := Snapshot{"assignmentResult": test.raw}
			if got := snapshot.BaselineID(); got != test.want {
				t.Fatalf("BaselineID()=%q, want %q", got, test.want)
			}
		})
	}
}

package shifts

import (
	"encoding/json"
	"testing"
)

func mustSnapshot(t *testing.T, raw string) Snapshot {
	t.Helper()
	snapshot, err := Decode(json.RawMessage(raw))
	if err != nil {
		t.Fatal(err)
	}
	return snapshot
}

// Three beds: b1 holds a patient, b2 has blank initials, b3 has no patient.
// n1 starts with b1 and b3; n2 starts with b2.
const assignedSnapshot = `{
  "floorName": "4 West",
  "nurses": [{"id":"n1","name":"Nina"},{"id":"n2","name":"Omar"}],
  "bedStates": [
    {"id":"s1","bedId":"b1","patient":{"initials":"AB"},"acuity":"red"},
    {"id":"s2","bedId":"b2","patient":{"initials":"  "}},
    {"id":"s3","bedId":"b3"}
  ],
  "assignmentResult": {"id":"r1","bedAssignments":[
    {"bedId":"b1","nurseId":"n1"},{"bedId":"b2","nurseId":"n2"},{"bedId":"b3","nurseId":"n1"}
  ]}
}`

func TestNurseName(t *testing.T) {
	snapshot := mustSnapshot(t, assignedSnapshot)
	if name, ok := snapshot.NurseName("n2"); !ok || name != "Omar" {
		t.Fatalf("got %q, %v", name, ok)
	}
	if _, ok := snapshot.NurseName("missing"); ok {
		t.Fatal("unknown nurse found")
	}
	if _, ok := mustSnapshot(t, `{}`).NurseName("n1"); ok {
		t.Fatal("snapshot without nurses found a nurse")
	}
}

func TestAssignedPatientCount(t *testing.T) {
	for _, tt := range []struct {
		name      string
		snapshot  string
		nurse     string
		overrides []ActiveOverride
		want      int
	}{
		{"counts only occupied beds", assignedSnapshot, "n1", nil, 1},
		{"blank initials are not occupied", assignedSnapshot, "n2", nil, 0},
		{"override moves an occupied bed away", assignedSnapshot, "n1", []ActiveOverride{{ID: "o1", BedID: "b1", ToNurseID: "n2"}}, 0},
		{"override moves an occupied bed in", assignedSnapshot, "n2", []ActiveOverride{{ID: "o1", BedID: "b1", ToNurseID: "n2"}}, 1},
		{"override for an unassigned bed is ignored", assignedSnapshot, "n2", []ActiveOverride{{ID: "o1", BedID: "other", ToNurseID: "n2"}}, 0},
		{"no assignment result", `{"bedStates":[{"id":"s","bedId":"b1","patient":{"initials":"AB"}}]}`, "n1", nil, 0},
		{"unknown nurse", assignedSnapshot, "nobody", nil, 0},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got, err := mustSnapshot(t, tt.snapshot).AssignedPatientCount(tt.nurse, tt.overrides)
			if err != nil || got != tt.want {
				t.Fatalf("got %d, %v; want %d", got, err, tt.want)
			}
		})
	}
}

func TestAssignedPatientCountRejectsMalformedAssignments(t *testing.T) {
	if _, err := mustSnapshot(t, `{"assignmentResult":{"bedAssignments":"nope"}}`).AssignedPatientCount("n1", nil); err == nil {
		t.Fatal("malformed assignment result accepted")
	}
}

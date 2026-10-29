package shifts

import (
	"encoding/json"
	"reflect"
	"testing"
)

const joinedSnapshot = `{
  "floorName": "4 West",
  "doctorSides": [{"id":"d1","name":"A"}],
  "rooms": [{"id":"r1","doctorSideId":"d1","label":"101"},{"id":"r2","doctorSideId":"missing-side","label":"102"}],
  "beds": [
    {"id":"b1","roomId":"r1","label":"101A"},
    {"id":"b2","roomId":"r1","label":"101B"},
    {"id":"b3","roomId":"r2","label":"102A"},
    {"id":"b4","roomId":"missing-room","label":"?"}
  ],
  "bedStates": [{"id":"s1","bedId":"b1","patient":{"initials":"AB"}}, {"id":"s2","bedId":"b3"}],
  "assignmentResult": {"id":"res","bedAssignments":[
    {"bedId":"b2","nurseId":"n1"},
    {"bedId":"b1","nurseId":"n1"},
    {"bedId":"b3","nurseId":"n1"},
    {"bedId":"b4","nurseId":"n1"},
    {"bedId":"gone","nurseId":"n1"}
  ]},
  "nurseRequests": [
    {"id":"q1","requestingNurseId":"n1","completedOverrideId":"o-active"},
    {"id":"q2","requestingNurseId":"n2"},
    {"id":"q3","requestingNurseId":"n1","completedOverrideId":"o-old"},
    {"id":"q4","requestingNurseId":"n1","completedOverrideId":""},
    {"id":"q5","requestingNurseId":"n1"}
  ]
}`

func bedLabels(t *testing.T, beds []AssignedBed) []string {
	t.Helper()
	labels := []string{}
	for _, bed := range beds {
		var parsed struct{ Label string }
		if err := json.Unmarshal(bed.Bed, &parsed); err != nil {
			t.Fatal(err)
		}
		labels = append(labels, parsed.Label)
	}
	return labels
}

func TestJoinedViewAssignedBeds(t *testing.T) {
	for _, tt := range []struct {
		name      string
		nurse     string
		overrides []ActiveOverride
		want      []string
	}{
		{"baseline order, dropping beds with a missing room or side", "n1", nil, []string{"101B", "101A"}},
		{"override moves a bed in", "n2", []ActiveOverride{{ID: "o", BedID: "b1", ToNurseID: "n2"}}, []string{"101A"}},
		{"override moves a bed away", "n1", []ActiveOverride{{ID: "o", BedID: "b2", ToNurseID: "n2"}}, []string{"101A"}},
		{"reassigned away from everything", "n1", []ActiveOverride{{ID: "o1", BedID: "b1", ToNurseID: "n2"}, {ID: "o2", BedID: "b2", ToNurseID: "n2"}}, []string{}},
		{"nurse with no beds", "n9", nil, []string{}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			view, err := mustSnapshot(t, joinedSnapshot).JoinedView(tt.nurse, tt.overrides)
			if err != nil {
				t.Fatal(err)
			}
			if got := bedLabels(t, view.AssignedBeds); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("beds = %v, want %v", got, tt.want)
			}
			if view.FloorName != "4 West" {
				t.Fatalf("floor name = %q", view.FloorName)
			}
		})
	}
}

func TestJoinedViewBedState(t *testing.T) {
	view, err := mustSnapshot(t, joinedSnapshot).JoinedView("n1", nil)
	if err != nil {
		t.Fatal(err)
	}
	// The first bed (b2) has no state, so it must serialize as null; b1 has one.
	encoded, err := json.Marshal(view.AssignedBeds)
	if err != nil {
		t.Fatal(err)
	}
	var beds []map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &beds); err != nil {
		t.Fatal(err)
	}
	if string(beds[0]["bedState"]) != "null" {
		t.Fatalf("missing bed state must be null, got %s", beds[0]["bedState"])
	}
	if string(beds[1]["bedState"]) == "null" {
		t.Fatal("bed state of b1 was dropped")
	}
	for _, key := range []string{"bed", "bedState", "doctorSide", "room"} {
		if _, ok := beds[0][key]; !ok {
			t.Fatalf("response lacks %q", key)
		}
	}
}

func TestJoinedViewRequestHistory(t *testing.T) {
	overrides := []ActiveOverride{{ID: "o-active", BedID: "b1", ToNurseID: "n1"}}
	view, err := mustSnapshot(t, joinedSnapshot).JoinedView("n1", overrides)
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	var flagged []bool
	for _, raw := range view.RequestHistory {
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			t.Fatal(err)
		}
		var id string
		_ = json.Unmarshal(fields["id"], &id)
		ids = append(ids, id)
		_, present := fields["completedAssignmentChangedLater"]
		flagged = append(flagged, present)
	}
	// Snapshot order, only this nurse's requests. The flag appears only for q3,
	// whose completed override is no longer active (never as false).
	if want := []string{"q1", "q3", "q4", "q5"}; !reflect.DeepEqual(ids, want) {
		t.Fatalf("requests = %v, want %v", ids, want)
	}
	if want := []bool{false, true, false, false}; !reflect.DeepEqual(flagged, want) {
		t.Fatalf("flag presence = %v, want %v", flagged, want)
	}
}

func TestJoinedViewWithoutOptionalSections(t *testing.T) {
	view, err := mustSnapshot(t, `{"floorName":"Empty"}`).JoinedView("n1", nil)
	if err != nil {
		t.Fatal(err)
	}
	if view.AssignedBeds == nil || len(view.AssignedBeds) != 0 || view.RequestHistory == nil || len(view.RequestHistory) != 0 {
		t.Fatalf("expected empty non-nil lists, got %+v", view)
	}
}

func TestJoinedViewRejectsMalformedSections(t *testing.T) {
	if _, err := mustSnapshot(t, `{"beds":"nope","assignmentResult":{"bedAssignments":[{"bedId":"b","nurseId":"n"}]}}`).JoinedView("n", nil); err == nil {
		t.Fatal("malformed beds accepted")
	}
}

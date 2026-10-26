package shifts

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// runSnapshot has two rooms, three nurses (n3 is an LPN), and three beds: b1 is red,
// b2 is green, and b3 has no patient. Nurse n1 may take at most two beds.
const runSnapshot = `{
  "futureField": {"keep": true},
  "status": "setup",
  "rooms": [{"id":"r1"},{"id":"r2"}],
  "beds": [{"id":"b1","roomId":"r1"},{"id":"b2","roomId":"r1"},{"id":"b3","roomId":"r2"}],
  "nurses": [
    {"id":"n1","licenseType":"RN","maxPatientLoad":2},
    {"id":"n2","licenseType":"RN","maxPatientLoad":"3"},
    {"id":"n3","licenseType":"LPN","maxPatientLoad":3}],
  "bedStates": [
    {"bedId":"b1","patient":{"initials":"AB"},"acuity":"red"},
    {"bedId":"b2","patient":{"initials":"CD"},"acuity":"green"},
    {"bedId":"b3","patient":{"initials":"  "},"acuity":"yellow"}]
}`

const runResult = `{"id":"res-1",
  "generatedTeams":[{"id":"res-1-t1","label":"Team 1","nurseIds":["n1","n2"]},{"id":"res-1-t2","label":"Team 2","nurseIds":["n3"]}],
  "roomCoverage":[{"id":"res-1-c1","roomId":"r1","nurseIds":["n1","n2","n3"]},{"id":"res-1-c2","roomId":"r2","nurseIds":[]}],
  "bedAssignments":[{"id":"res-1-a1","bedId":"b1","nurseId":"n1"},{"id":"res-1-a2","bedId":"b2","nurseId":"n3"}]}`

const runFlags = `[{"id":"res-1-f1","type":"x","severity":"warning","message":"m"}]`

const runObjectives = `{"unassignedCount":0,"maxNurseAcuityLoad":3,"maxNursePatientCount":1,"redBedOwnerRankSum":2,
  "sideGuidanceTotalExcess":0,"sideGuidanceNurseCount":0,"teamWeightedAcuityGap":0,"teamPatientCountGap":0,
  "teamRnCountGap":0,"teamExperienceDistributionGap":0,"teamCapacityGap":0}`

func TestOutputValidationError(t *testing.T) {
	replace := func(source, old, replacement string) string {
		if !strings.Contains(source, old) {
			t.Fatalf("test fixture does not contain %q", old)
		}
		return strings.Replace(source, old, replacement, 1)
	}
	tests := []struct {
		name                         string
		snapshot, result, flags, obj string
		want                         string
	}{
		{"valid output", runSnapshot, runResult, runFlags, runObjectives, ""},
		{"capacity given as text is accepted", runSnapshot, runResult, runFlags, runObjectives, ""},
		{"result is not an object", runSnapshot, `[]`, runFlags, runObjectives, "invalid_output_shape"},
		{"flags are not an array", runSnapshot, runResult, `{}`, runObjectives, "invalid_output_shape"},
		{"objectives are null", runSnapshot, runResult, runFlags, `null`, "invalid_output_shape"},
		{"blank result id", runSnapshot, replace(runResult, `"id":"res-1",`, `"id":"  ",`), runFlags, runObjectives, "invalid_assignment_result"},
		{"teams are not an array", runSnapshot, `{"id":"res-1","generatedTeams":"none","roomCoverage":[],"bedAssignments":[]}`, runFlags, runObjectives, "invalid_assignment_result"},
		{"child id has wrong prefix", runSnapshot, replace(runResult, `"res-1-a2"`, `"other-a2"`), runFlags, runObjectives, "invalid_output_ids"},
		{"child id is missing", runSnapshot, replace(runResult, `"id":"res-1-a2",`, ``), runFlags, runObjectives, "invalid_output_ids"},
		{"child id is repeated", runSnapshot, replace(runResult, `"res-1-a2"`, `"res-1-a1"`), runFlags, runObjectives, "invalid_output_ids"},
		{"flag id repeats a child id", runSnapshot, runResult, replace(runFlags, `res-1-f1`, `res-1-a1`), runObjectives, "invalid_output_ids"},
		{"team without label", runSnapshot, replace(runResult, `"label":"Team 1"`, `"label":" "`), runFlags, runObjectives, "invalid_team_shape"},
		{"team nurse ids not an array", runSnapshot, replace(runResult, `"nurseIds":["n3"]`, `"nurseIds":"n3"`), runFlags, runObjectives, "invalid_team_shape"},
		{"coverage without room id", runSnapshot, replace(runResult, `"roomId":"r2"`, `"roomId":""`), runFlags, runObjectives, "invalid_coverage_shape"},
		{"coverage nurse ids not an array", runSnapshot, replace(runResult, `"roomId":"r2","nurseIds":[]`, `"roomId":"r2","nurseIds":{}`), runFlags, runObjectives, "invalid_coverage_shape"},
		{"nurse on no team", runSnapshot, replace(runResult, `"nurseIds":["n3"]`, `"nurseIds":[]`), runFlags, runObjectives, "invalid_team_membership"},
		{"nurse on two teams", runSnapshot, replace(runResult, `"nurseIds":["n3"]`, `"nurseIds":["n3","n1"]`), runFlags, runObjectives, "invalid_team_membership"},
		{"team has unknown nurse", runSnapshot, replace(runResult, `"nurseIds":["n3"]`, `"nurseIds":["n3","ghost"]`), runFlags, runObjectives, "unknown_team_nurse"},
		{"room has no coverage", runSnapshot, replace(runResult, `{"id":"res-1-c2","roomId":"r2","nurseIds":[]}`, `{"id":"res-1-c2","roomId":"r1","nurseIds":[]}`), runFlags, runObjectives, "invalid_room_coverage"},
		{"coverage for unknown room", replace(runSnapshot, `"rooms": [{"id":"r1"},{"id":"r2"}]`, `"rooms": [{"id":"r1"}]`), runResult, runFlags, runObjectives, "unknown_coverage_room"},
		{"coverage has unknown nurse", runSnapshot, replace(runResult, `"nurseIds":[]`, `"nurseIds":["ghost"]`), runFlags, runObjectives, "unknown_coverage_nurse"},
		{"assignment to unknown bed", runSnapshot, replace(runResult, `"bedId":"b2"`, `"bedId":"b9"`), runFlags, runObjectives, "unknown_assignment_bed"},
		{"assignment to empty bed", runSnapshot, replace(runResult, `"bedId":"b2"`, `"bedId":"b3"`), runFlags, runObjectives, "assignment_to_empty_bed"},
		{"assignment to bed with unknown acuity", replace(runSnapshot, `"acuity":"green"`, `"acuity":"blue"`), runResult, runFlags, runObjectives, "assignment_to_empty_bed"},
		{"assignment to unknown nurse", runSnapshot, replace(runResult, `"nurseId":"n3"`, `"nurseId":"ghost"`), runFlags, runObjectives, "unknown_assignment_nurse"},
		{"red bed given to LPN", runSnapshot, replace(runResult, `"nurseId":"n1"`, `"nurseId":"n3"`), runFlags, runObjectives, "red_bed_requires_rn"},
		{"nurse does not cover the room", runSnapshot, replace(runResult, `"roomId":"r1","nurseIds":["n1","n2","n3"]`, `"roomId":"r1","nurseIds":["n2","n3"]`), runFlags, runObjectives, "assignment_without_coverage"},
		{"bed assigned twice", runSnapshot, replace(runResult, `{"id":"res-1-a2","bedId":"b2","nurseId":"n3"}`, `{"id":"res-1-a2","bedId":"b1","nurseId":"n1"}`), runFlags, runObjectives, "duplicate_bed_assignment"},
		{"nurse capacity is not a number", replace(runSnapshot, `"maxPatientLoad":2`, `"maxPatientLoad":2.5`), runResult, runFlags, runObjectives, "invalid_nurse_capacity"},
		{"nurse capacity is missing", replace(runSnapshot, `"licenseType":"RN","maxPatientLoad":2`, `"licenseType":"RN"`), runResult, runFlags, runObjectives, "invalid_nurse_capacity"},
		{"nurse capacity exceeded", replace(runSnapshot, `"maxPatientLoad":2`, `"maxPatientLoad":0`), runResult, runFlags, runObjectives, "nurse_capacity_exceeded"},
		{"objective is not a number", runSnapshot, runResult, runFlags, replace(runObjectives, `"teamCapacityGap":0`, `"teamCapacityGap":"0"`), "invalid_objective_summary"},
		// Intentionally stricter than the SQL, which treats a missing value as unknown and lets it pass.
		{"missing teams array", runSnapshot, replace(runResult, `"generatedTeams"`, `"extraTeams"`), runFlags, runObjectives, "invalid_assignment_result"},
		{"missing coverage array", runSnapshot, replace(runResult, `"roomCoverage"`, `"extraCoverage"`), runFlags, runObjectives, "invalid_assignment_result"},
		{"missing assignments array", runSnapshot, replace(runResult, `"bedAssignments"`, `"extraAssignments"`), runFlags, runObjectives, "invalid_assignment_result"},
		{"team without nurse ids", runSnapshot, replace(runResult, `"nurseIds":["n3"]`, `"extra":1`), runFlags, runObjectives, "invalid_team_shape"},
		{"team with null nurse ids", runSnapshot, replace(runResult, `"nurseIds":["n3"]`, `"nurseIds":null`), runFlags, runObjectives, "invalid_team_shape"},
		{"coverage without nurse ids", runSnapshot, replace(runResult, `"roomId":"r2","nurseIds":[]`, `"roomId":"r2"`), runFlags, runObjectives, "invalid_coverage_shape"},
		{"missing objective", runSnapshot, runResult, runFlags, `{}`, "invalid_objective_summary"},
		{"null objective", runSnapshot, runResult, runFlags, replace(runObjectives, `"teamCapacityGap":0`, `"teamCapacityGap":null`), "invalid_objective_summary"},
		{"negative objective is a number", runSnapshot, runResult, runFlags, replace(runObjectives, `"teamCapacityGap":0`, `"teamCapacityGap":-1.5`), ""},
		{"bed state without acuity", replace(runSnapshot, `,"acuity":"green"`, ``), runResult, runFlags, runObjectives, "assignment_to_empty_bed"},
		{"red bed nurse without license type", replace(runSnapshot, `{"id":"n1","licenseType":"RN","maxPatientLoad":2}`, `{"id":"n1","maxPatientLoad":2}`), runResult, runFlags, runObjectives, "red_bed_requires_rn"},
		{"snapshot nurses are not records", replace(runSnapshot, `"nurses": [`, `"nurses": [7, `), runResult, runFlags, runObjectives, "invalid_output_shape"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := OutputValidationError(json.RawMessage(test.snapshot), json.RawMessage(test.result), json.RawMessage(test.flags), json.RawMessage(test.obj))
			if got != test.want {
				t.Fatalf("got %q, want %q", got, test.want)
			}
		})
	}
}

func TestWithAssignmentKeepsOtherKeys(t *testing.T) {
	snapshot, err := Decode(json.RawMessage(runSnapshot))
	if err != nil {
		t.Fatal(err)
	}
	raw, err := snapshot.WithAssignment(json.RawMessage(runResult), json.RawMessage(runFlags))
	if err != nil {
		t.Fatal(err)
	}
	var saved map[string]json.RawMessage
	if err := json.Unmarshal(raw, &saved); err != nil {
		t.Fatal(err)
	}
	if string(saved["status"]) != `"assigned"` || string(saved["futureField"]) != `{"keep":true}` {
		t.Fatalf("status or unknown key changed: %s %s", saved["status"], saved["futureField"])
	}
	if ResultID(saved["assignmentResult"]) != "res-1" || !strings.Contains(string(saved["flags"]), "res-1-f1") {
		t.Fatal("result or flags not stored")
	}
	if len(saved) != 8 {
		t.Fatalf("expected the 6 original keys plus assignmentResult and flags, got %d", len(saved))
	}
}

func TestOccupiedAndAssignedCounts(t *testing.T) {
	snapshot, _ := Decode(json.RawMessage(runSnapshot))
	if got := snapshot.OccupiedBedCount(); got != 2 {
		t.Fatalf("occupied beds = %d, want 2 (blank initials do not count)", got)
	}
	noAcuity, _ := Decode(json.RawMessage(`{"bedStates":[{"bedId":"b1","patient":{"initials":"AB"}},{"bedId":"b2","patient":{"initials":"CD"},"acuity":"red"}]}`))
	if got := noAcuity.OccupiedBedCount(); got != 1 {
		t.Fatalf("occupied beds without acuity = %d, want 1", got)
	}
	if got := BedAssignmentCount(json.RawMessage(runResult)); got != 2 {
		t.Fatalf("assigned = %d, want 2", got)
	}
}

func TestRequestFingerprint(t *testing.T) {
	revision := time.Date(2026, 10, 25, 18, 0, 0, 123456000, time.UTC)
	first := RequestFingerprint("shift", revision, "")
	if len(first) != 64 {
		t.Fatalf("fingerprint %q is not 64 hex characters", first)
	}
	// An equal instant in another zone formats the same once converted to UTC.
	local := revision.In(time.FixedZone("x", -7*3600))
	if RequestFingerprint("shift", local, "") != first {
		t.Fatal("fingerprint depends on the time zone")
	}
	if RequestFingerprint("shift", revision, "res1") == first || RequestFingerprint("shift2", revision, "") == first ||
		RequestFingerprint("shift", revision.Add(time.Microsecond), "") == first {
		t.Fatal("fingerprint ignores an input")
	}
	// Known value: sha256 of "s2026-10-25T18:00:00.123456Z".
	if got := RequestFingerprint("s", revision, ""); got != "96f283d545722f4b551d3c2904c62eb1877f12f84e22935a2fcc31a7076111aa" {
		t.Fatalf("unexpected fingerprint %s", got)
	}
}

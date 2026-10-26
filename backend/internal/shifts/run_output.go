package shifts

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

// RequestFingerprint identifies the preconditions of one optimizer request, so a
// reused client mutation ID with different preconditions can be detected. The unit
// separator keeps neighbouring parts from running together. The caller passes the
// trimmed baseline result ID, or "" for a first run.
func RequestFingerprint(shiftID string, revision time.Time, baseline string) string {
	text := shiftID + "\x1f" + revision.UTC().Format(time.RFC3339Nano) + "\x1f" + baseline
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

// WithAssignment returns the snapshot JSON with the new assignment result and flags
// stored and the status set to "assigned". Every other key is kept as stored.
func (s Snapshot) WithAssignment(assignmentResult, flags json.RawMessage) (json.RawMessage, error) {
	s["assignmentResult"] = assignmentResult
	s["flags"] = flags
	s["status"] = json.RawMessage(`"assigned"`)
	return json.Marshal(s)
}

// OccupiedBedCount counts beds whose patient has non-blank initials and a known
// acuity. These are the beds the optimizer is expected to assign.
func (s Snapshot) OccupiedBedCount() int {
	var states []struct {
		Patient *Patient `json:"patient"`
		Acuity  string   `json:"acuity"`
	}
	if json.Unmarshal(s["bedStates"], &states) != nil {
		return 0
	}
	count := 0
	for _, state := range states {
		if knownAcuities[state.Acuity] && state.Patient != nil && strings.TrimSpace(state.Patient.Initials) != "" {
			count++
		}
	}
	return count
}

// BedAssignmentCount returns how many beds an assignment result assigns.
func BedAssignmentCount(assignmentResult json.RawMessage) int {
	var result struct {
		BedAssignments []json.RawMessage `json:"bedAssignments"`
	}
	if json.Unmarshal(assignmentResult, &result) != nil {
		return 0
	}
	return len(result.BedAssignments)
}

// ResultID returns the trimmed ID of an assignment result, or "" when it has none.
func ResultID(assignmentResult json.RawMessage) string {
	var result struct {
		ID string `json:"id"`
	}
	if json.Unmarshal(assignmentResult, &result) != nil {
		return ""
	}
	return strings.Trim(result.ID, " ")
}

// OutputValidationError ports the SQL function optimizer_output_validation_error.
// It returns "" for valid output, or the same error code the SQL returns, checking
// in the same order.
//
// The SQL reads loosely typed JSON, and a missing key makes many of its tests
// "unknown" (NULL), so bad output can slip through. This port decodes the snapshot
// and the solver output into typed structs and is intentionally stricter there:
//   - a missing generatedTeams, roomCoverage, or bedAssignments array is
//     invalid_assignment_result;
//   - a team with missing nurseIds is invalid_team_shape, and a room coverage with
//     missing nurseIds is invalid_coverage_shape;
//   - a missing objective is invalid_objective_summary;
//   - a patient's bed with no acuity is assignment_to_empty_bed;
//   - a red bed whose nurse has no licenseType is red_bed_requires_rn.
//
// Two more differences: a child ID must start with the literal text "<result id>-"
// (the SQL LIKE treats % and _ in the result ID as wildcards), and a value of the
// wrong JSON type in an ID, label, or room field makes the whole result
// invalid_assignment_result (or invalid_output_shape for a flag or the snapshot).
func OutputValidationError(shiftSnapshot, assignmentResult, flags, objectives json.RawMessage) string {
	// The three top-level values must be an object, an array, and an object.
	var resultFields map[string]json.RawMessage
	var flagList []outputFlag
	var objectiveFields map[string]json.RawMessage
	if json.Unmarshal(assignmentResult, &resultFields) != nil || resultFields == nil ||
		json.Unmarshal(flags, &flagList) != nil || flagList == nil ||
		json.Unmarshal(objectives, &objectiveFields) != nil || objectiveFields == nil {
		return "invalid_output_shape"
	}

	resultID := ResultID(assignmentResult)
	teams, teamsAreList := readList[outputTeam](resultFields["generatedTeams"])
	coverages, coveragesAreList := readList[outputCoverage](resultFields["roomCoverage"])
	assignments, assignmentsAreList := readList[outputBedAssignment](resultFields["bedAssignments"])
	if resultID == "" || !teamsAreList || !coveragesAreList || !assignmentsAreList {
		return "invalid_assignment_result"
	}

	if !childIDsValid(resultID, teams, coverages, assignments, flagList) {
		return "invalid_output_ids"
	}
	for _, team := range teams {
		if isBlank(team.Label) || !team.NurseIDs.Valid {
			return "invalid_team_shape"
		}
	}
	for _, coverage := range coverages {
		if isBlank(coverage.RoomID) || !coverage.NurseIDs.Valid {
			return "invalid_coverage_shape"
		}
	}

	var shift outputShift
	if json.Unmarshal(shiftSnapshot, &shift) != nil {
		return "invalid_output_shape"
	}
	nurseByID := map[string]snapshotNurse{}
	for _, nurse := range shift.Nurses {
		nurseByID[nurse.ID] = nurse
	}
	roomIDs := map[string]bool{}
	for _, room := range shift.Rooms {
		roomIDs[room.ID] = true
	}

	if code := teamError(shift.Nurses, nurseByID, teams); code != "" {
		return code
	}
	if code := coverageError(shift.Rooms, roomIDs, nurseByID, coverages); code != "" {
		return code
	}
	if code := assignmentError(shift, nurseByID, coverages, assignments); code != "" {
		return code
	}
	if hasDuplicateBed(assignments) {
		return "duplicate_bed_assignment"
	}
	if code := capacityError(shift.Nurses, assignments); code != "" {
		return code
	}
	return objectiveError(objectiveFields)
}

// --- the solver output ---

// outputFlag is a flag in the solver output. Only its ID is checked.
type outputFlag struct {
	ID string `json:"id"`
}

// outputTeam is one generated team.
type outputTeam struct {
	ID       string      `json:"id"`
	Label    string      `json:"label"`
	NurseIDs nurseIDList `json:"nurseIds"`
}

// outputCoverage lists the nurses who cover one room.
type outputCoverage struct {
	ID       string      `json:"id"`
	RoomID   string      `json:"roomId"`
	NurseIDs nurseIDList `json:"nurseIds"`
}

// outputBedAssignment gives one bed to one nurse.
type outputBedAssignment struct {
	ID      string `json:"id"`
	BedID   string `json:"bedId"`
	NurseID string `json:"nurseId"`
}

// nurseIDList is a "nurseIds" value. Valid is false when the value is missing,
// null, or not a list of strings.
type nurseIDList struct {
	IDs   []string
	Valid bool
}

// UnmarshalJSON never fails, so a bad nurseIds is reported with the check that
// owns it (invalid_team_shape or invalid_coverage_shape) at the right point.
func (l *nurseIDList) UnmarshalJSON(data []byte) error {
	l.Valid = json.Unmarshal(data, &l.IDs) == nil && l.IDs != nil
	return nil
}

// readList decodes a JSON array. ok is false when the value is missing, null, or
// not an array of the expected records.
func readList[T any](raw json.RawMessage) (list []T, ok bool) {
	if json.Unmarshal(raw, &list) != nil || list == nil {
		return nil, false
	}
	return list, true
}

// --- the shift snapshot ---

// outputShift is the part of the stored shift the output is checked against.
type outputShift struct {
	Nurses    []snapshotNurse   `json:"nurses"`
	Rooms     []snapshotRoom    `json:"rooms"`
	Beds      []snapshotBed     `json:"beds"`
	BedStates []snapshotBedInfo `json:"bedStates"`
}

type snapshotNurse struct {
	ID          string `json:"id"`
	LicenseType string `json:"licenseType"`
	// MaxPatientLoad stays raw because old shifts stored it as text ("3").
	MaxPatientLoad json.RawMessage `json:"maxPatientLoad"`
}

type snapshotRoom struct {
	ID string `json:"id"`
}

type snapshotBed struct {
	ID     string `json:"id"`
	RoomID string `json:"roomId"`
}

// snapshotBedInfo is a bed's patient and acuity ("bedStates" in the snapshot).
type snapshotBedInfo struct {
	BedID   string `json:"bedId"`
	Patient *struct {
		Initials string `json:"initials"`
	} `json:"patient"`
	Acuity string `json:"acuity"`
}

// isOccupied is true when the bed has a patient (non-blank initials) and a known acuity.
func (b snapshotBedInfo) isOccupied() bool {
	return b.Patient != nil && !isBlank(b.Patient.Initials) && knownAcuities[b.Acuity]
}

// --- the checks, in the SQL's order ---

// isBlank matches the SQL test for an empty text after btrim: only spaces are trimmed.
func isBlank(text string) bool { return strings.Trim(text, " ") == "" }

// childIDsValid requires every generated record ID (teams, coverage, assignments,
// flags) to be present, start with "<result id>-", and be unique.
func childIDsValid(resultID string, teams []outputTeam, coverages []outputCoverage, assignments []outputBedAssignment, flags []outputFlag) bool {
	var ids []string
	for _, team := range teams {
		ids = append(ids, team.ID)
	}
	for _, coverage := range coverages {
		ids = append(ids, coverage.ID)
	}
	for _, assignment := range assignments {
		ids = append(ids, assignment.ID)
	}
	for _, flag := range flags {
		ids = append(ids, flag.ID)
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if isBlank(id) || !strings.HasPrefix(id, resultID+"-") || seen[id] {
			return false
		}
		seen[id] = true
	}
	return true
}

// teamError checks that every current nurse is on exactly one team and that no
// team lists a nurse who is not on the shift.
func teamError(nurses []snapshotNurse, nurseByID map[string]snapshotNurse, teams []outputTeam) string {
	teamsOfNurse := map[string]int{}
	for _, team := range teams {
		for _, id := range team.NurseIDs.IDs {
			teamsOfNurse[id]++
		}
	}
	for _, nurse := range nurses {
		if teamsOfNurse[nurse.ID] != 1 {
			return "invalid_team_membership"
		}
	}
	for _, team := range teams {
		for _, id := range team.NurseIDs.IDs {
			if _, known := nurseByID[id]; !known {
				return "unknown_team_nurse"
			}
		}
	}
	return ""
}

// coverageError checks that every room has exactly one coverage record (it may list
// no nurses), and that coverage names only rooms and nurses on the shift.
func coverageError(rooms []snapshotRoom, roomIDs map[string]bool, nurseByID map[string]snapshotNurse, coverages []outputCoverage) string {
	coverageOfRoom := map[string]int{}
	for _, coverage := range coverages {
		coverageOfRoom[coverage.RoomID]++
	}
	for _, room := range rooms {
		if coverageOfRoom[room.ID] != 1 {
			return "invalid_room_coverage"
		}
	}
	for _, coverage := range coverages {
		if !roomIDs[coverage.RoomID] {
			return "unknown_coverage_room"
		}
	}
	for _, coverage := range coverages {
		for _, id := range coverage.NurseIDs.IDs {
			if _, known := nurseByID[id]; !known {
				return "unknown_coverage_nurse"
			}
		}
	}
	return ""
}

// assignmentError checks each bed assignment against the shift, one at a time:
// the bed exists and holds a patient, the nurse exists (and is an RN for a red
// bed), and the nurse covers the bed's room.
func assignmentError(shift outputShift, nurseByID map[string]snapshotNurse, coverages []outputCoverage, assignments []outputBedAssignment) string {
	bedByID := map[string]snapshotBed{}
	for _, bed := range shift.Beds {
		if _, seen := bedByID[bed.ID]; !seen {
			bedByID[bed.ID] = bed
		}
	}
	stateByBedID := map[string]snapshotBedInfo{}
	for _, state := range shift.BedStates {
		if _, seen := stateByBedID[state.BedID]; !seen {
			stateByBedID[state.BedID] = state
		}
	}
	coverageByRoomID := map[string]outputCoverage{}
	for _, coverage := range coverages {
		if _, seen := coverageByRoomID[coverage.RoomID]; !seen {
			coverageByRoomID[coverage.RoomID] = coverage
		}
	}

	for _, assignment := range assignments {
		bed, bedExists := bedByID[assignment.BedID]
		if !bedExists {
			return "unknown_assignment_bed"
		}
		state, hasState := stateByBedID[assignment.BedID]
		if !hasState || !state.isOccupied() {
			return "assignment_to_empty_bed"
		}
		nurse, nurseExists := nurseByID[assignment.NurseID]
		if !nurseExists {
			return "unknown_assignment_nurse"
		}
		if state.Acuity == "red" && nurse.LicenseType != "RN" {
			return "red_bed_requires_rn"
		}
		coverage, covered := coverageByRoomID[bed.RoomID]
		if !covered || !contains(coverage.NurseIDs.IDs, assignment.NurseID) {
			return "assignment_without_coverage"
		}
	}
	return ""
}

func contains(list []string, want string) bool {
	for _, item := range list {
		if item == want {
			return true
		}
	}
	return false
}

// hasDuplicateBed reports a bed that is assigned more than once.
func hasDuplicateBed(assignments []outputBedAssignment) bool {
	seen := map[string]bool{}
	for _, assignment := range assignments {
		if seen[assignment.BedID] {
			return true
		}
		seen[assignment.BedID] = true
	}
	return false
}

// capacityError looks at one nurse at a time: the nurse's maxPatientLoad must be
// a whole number, and the nurse must not be given more beds than that.
func capacityError(nurses []snapshotNurse, assignments []outputBedAssignment) string {
	bedsOfNurse := map[string]int{}
	for _, assignment := range assignments {
		bedsOfNurse[assignment.NurseID]++
	}
	for _, nurse := range nurses {
		limit, ok := patientLimit(nurse.MaxPatientLoad)
		if !ok {
			return "invalid_nurse_capacity"
		}
		if bedsOfNurse[nurse.ID] > limit {
			return "nurse_capacity_exceeded"
		}
	}
	return ""
}

// patientLimit reads a maxPatientLoad that is a whole number, written either as a
// JSON number (3) or as text ("3").
func patientLimit(raw json.RawMessage) (int, bool) {
	text := string(raw)
	var quoted string
	if json.Unmarshal(raw, &quoted) == nil {
		text = quoted
	}
	if text == "" || strings.Trim(text, "0123456789") != "" {
		return 0, false
	}
	limit, err := strconv.Atoi(text)
	return limit, err == nil
}

// objectiveNames lists the numbers every solver result must report.
var objectiveNames = []string{
	"unassignedCount", "maxNurseAcuityLoad", "maxNursePatientCount", "redBedOwnerRankSum",
	"sideGuidanceTotalExcess", "sideGuidanceNurseCount", "teamWeightedAcuityGap",
	"teamPatientCountGap", "teamRnCountGap", "teamExperienceDistributionGap", "teamCapacityGap",
}

// objectiveError requires every objective to be present and a JSON number.
func objectiveError(objectives map[string]json.RawMessage) string {
	for _, name := range objectiveNames {
		raw := objectives[name]
		// A JSON number starts with a digit or a minus sign; a string, null, or a
		// missing value does not.
		if len(raw) == 0 || (raw[0] != '-' && (raw[0] < '0' || raw[0] > '9')) {
			return "invalid_objective_summary"
		}
	}
	return ""
}

package shifts

import (
	"encoding/json"
	"strings"
)

// ActiveOverride is a charge nurse's active move of one bed to another nurse.
type ActiveOverride struct {
	ID        string
	BedID     string
	ToNurseID string
}

// bedAssignment is one entry of the generated assignment result.
type bedAssignment struct {
	BedID   string `json:"bedId"`
	NurseID string `json:"nurseId"`
}

func (s Snapshot) bedAssignments() ([]bedAssignment, error) {
	var result struct {
		BedAssignments []bedAssignment `json:"bedAssignments"`
	}
	if raw, ok := s["assignmentResult"]; ok && !isJSONNull(raw) {
		if err := json.Unmarshal(raw, &result); err != nil {
			return nil, ErrInvalidSetup
		}
	}
	return result.BedAssignments, nil
}

// elements reads a JSON array field as raw items. A missing field is empty.
func (s Snapshot) elements(key string) ([]json.RawMessage, error) {
	raw, ok := s[key]
	if !ok || isJSONNull(raw) {
		return nil, nil
	}
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, ErrInvalidSetup
	}
	return items, nil
}

func isJSONNull(raw json.RawMessage) bool {
	return strings.TrimSpace(string(raw)) == "null"
}

// field returns a string property of a JSON object item, or "" when it is absent.
func field(item json.RawMessage, name string) string {
	var fields map[string]json.RawMessage
	if json.Unmarshal(item, &fields) != nil {
		return ""
	}
	var value string
	if json.Unmarshal(fields[name], &value) != nil {
		return ""
	}
	return value
}

// NurseName finds a nurse in the stored snapshot by ID.
func (s Snapshot) NurseName(nurseID string) (string, bool) {
	var nurses []Nurse
	if json.Unmarshal(s["nurses"], &nurses) != nil {
		return "", false
	}
	for _, nurse := range nurses {
		if nurse.ID == nurseID {
			return nurse.Name, true
		}
	}
	return "", false
}

// effectiveNurseIDs maps each assigned bed to the nurse who currently has it:
// an active override's nurse wins over the generated baseline.
func effectiveNurseIDs(assignments []bedAssignment, overrides []ActiveOverride) map[string]string {
	overrideNurse := make(map[string]string, len(overrides))
	for _, override := range overrides {
		overrideNurse[override.BedID] = override.ToNurseID
	}
	nurses := make(map[string]string, len(assignments))
	for _, assignment := range assignments {
		if nurseID, moved := overrideNurse[assignment.BedID]; moved {
			nurses[assignment.BedID] = nurseID
		} else {
			nurses[assignment.BedID] = assignment.NurseID
		}
	}
	return nurses
}

// AssignedPatientCount counts the nurse's effective beds that hold a patient with
// non-blank initials. A shift with no generated assignment counts zero.
func (s Snapshot) AssignedPatientCount(nurseID string, overrides []ActiveOverride) (int, error) {
	assignments, err := s.bedAssignments()
	if err != nil {
		return 0, err
	}
	var states []BedState
	if raw, ok := s["bedStates"]; ok && !isJSONNull(raw) {
		if err := json.Unmarshal(raw, &states); err != nil {
			return 0, ErrInvalidSetup
		}
	}
	occupied := map[string]bool{}
	for _, state := range states {
		if state.Patient != nil && strings.TrimSpace(state.Patient.Initials) != "" {
			occupied[state.BedID] = true
		}
	}
	effective := effectiveNurseIDs(assignments, overrides)
	count := 0
	for _, assignment := range assignments {
		if effective[assignment.BedID] == nurseID && occupied[assignment.BedID] {
			count++
		}
	}
	return count, nil
}

// FloorName returns the floor's display name, or "" when the snapshot has none.
func (s Snapshot) FloorName() string {
	var name string
	_ = json.Unmarshal(s["floorName"], &name)
	return name
}

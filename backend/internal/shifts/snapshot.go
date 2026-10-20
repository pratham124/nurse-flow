// Package shifts contains shift rules without HTTP or database dependencies.
package shifts

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/templates"
)

var ErrInvalidSetup = errors.New("shift setup is incomplete or inconsistent")

// Snapshot preserves stored fields owned by other workflows, including request
// history and optimizer results. Setup edits replace only the fields below.
type Snapshot map[string]json.RawMessage

type LoadRange struct {
	Min int `json:"min"`
	Max int `json:"max"`
}

type LoadLimits struct {
	Admitting    LoadRange `json:"admitting"`
	NonAdmitting LoadRange `json:"nonAdmitting"`
}

type Nurse struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	LicenseType     string `json:"licenseType"`
	ExperienceLevel string `json:"experienceLevel"`
	MaxPatientLoad  int    `json:"maxPatientLoad"`
}

type Patient struct {
	Initials  string `json:"initials"`
	Age       *int   `json:"age,omitempty"`
	Sex       string `json:"sex,omitempty"`
	Diagnosis string `json:"diagnosis,omitempty"`
}

type BedState struct {
	ID      string   `json:"id"`
	BedID   string   `json:"bedId"`
	Patient *Patient `json:"patient,omitempty"`
	Acuity  string   `json:"acuity,omitempty"`
}

type Setup struct {
	AdmittingDoctorSideID string     `json:"admittingDoctorSideId"`
	SideLoadLimits        LoadLimits `json:"sideLoadLimits"`
	Nurses                []Nurse    `json:"nurses"`
	BedStates             []BedState `json:"bedStates"`
	CarryOverReviewedAt   *time.Time `json:"carryOverReviewedAt,omitempty"`
}

type NurseSuggestion struct {
	ID              string `json:"id"`
	PreviousNurseID string `json:"previousNurseId"`
	Name            string `json:"name"`
	LicenseType     string `json:"licenseType"`
	ExperienceLevel string `json:"experienceLevel"`
}

type PatientSuggestion struct {
	ID               string  `json:"id"`
	PreviousBedID    string  `json:"previousBedId"`
	PreviousBedLabel string  `json:"previousBedLabel"`
	Patient          Patient `json:"patient"`
	Acuity           string  `json:"acuity,omitempty"`
}

func NewID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:]), nil
}

func Decode(raw json.RawMessage) (Snapshot, error) {
	var snapshot Snapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil || snapshot == nil {
		return nil, ErrInvalidSetup
	}
	return snapshot, nil
}

func (s Snapshot) set(key string, value any) error {
	raw, err := json.Marshal(value)
	if err == nil {
		s[key] = raw
	}
	return err
}

func New(template templates.Snapshot, id string, now time.Time) (json.RawMessage, error) {
	if err := template.Validate(); err != nil {
		return nil, err
	}
	s := Snapshot{}
	states := make([]BedState, 0, len(template.Beds))
	for _, bed := range template.Beds {
		stateID, err := NewID()
		if err != nil {
			return nil, err
		}
		states = append(states, BedState{ID: stateID, BedID: bed.ID})
	}
	fields := map[string]any{
		"id": id, "floorTemplateId": template.ID, "floorName": template.Name,
		"startedAt": now, "status": "setup", "admittingDoctorSideId": "",
		"doctorSides": template.DoctorSides, "rooms": template.Rooms, "beds": template.Beds,
		"sideLoadLimits": LoadLimits{Admitting: LoadRange{4, 5}, NonAdmitting: LoadRange{6, 7}},
		"nurses":         []Nurse{}, "bedStates": states, "flags": []any{}, "nurseRequests": []any{},
	}
	for key, value := range fields {
		if err := s.set(key, value); err != nil {
			return nil, err
		}
	}
	return json.Marshal(s)
}

// Validate allows unfinished setup (empty admitting side/nurses, zero nurse
// load, and patients awaiting acuity) because the existing review steps save it.
func (input Setup) Validate(s Snapshot) error {
	var sides []templates.DoctorSide
	var beds []templates.Bed
	if json.Unmarshal(s["doctorSides"], &sides) != nil || json.Unmarshal(s["beds"], &beds) != nil || len(sides) != 2 || len(beds) == 0 {
		return ErrInvalidSetup
	}
	if input.AdmittingDoctorSideID != "" {
		found := false
		for _, side := range sides {
			found = found || side.ID == input.AdmittingDoctorSideID
		}
		if !found {
			return ErrInvalidSetup
		}
	}
	for _, limit := range []LoadRange{input.SideLoadLimits.Admitting, input.SideLoadLimits.NonAdmitting} {
		if limit.Min < 1 || limit.Max > 12 || limit.Min > limit.Max {
			return ErrInvalidSetup
		}
	}
	if input.Nurses == nil || input.BedStates == nil || len(input.BedStates) != len(beds) {
		return ErrInvalidSetup
	}
	seen := map[string]bool{}
	for _, nurse := range input.Nurses {
		if strings.TrimSpace(nurse.ID) == "" || seen[nurse.ID] || strings.TrimSpace(nurse.Name) == "" ||
			(nurse.LicenseType != "RN" && nurse.LicenseType != "LPN") ||
			(nurse.ExperienceLevel != "new_grad" && nurse.ExperienceLevel != "mid" && nurse.ExperienceLevel != "experienced") ||
			nurse.MaxPatientLoad < 0 || nurse.MaxPatientLoad > 12 {
			return ErrInvalidSetup
		}
		seen[nurse.ID] = true
	}
	bedIDs := map[string]bool{}
	for _, bed := range beds {
		bedIDs[bed.ID] = true
	}
	seen = map[string]bool{}
	stateIDs := map[string]bool{}
	for _, state := range input.BedStates {
		if strings.TrimSpace(state.ID) == "" || stateIDs[state.ID] || !bedIDs[state.BedID] || seen[state.BedID] ||
			(state.Acuity != "" && state.Acuity != "green" && state.Acuity != "yellow" && state.Acuity != "red") {
			return ErrInvalidSetup
		}
		seen[state.BedID], stateIDs[state.ID] = true, true
		if p := state.Patient; p != nil {
			if (p.Age != nil && *p.Age < 0) || (p.Sex != "" && p.Sex != "female" && p.Sex != "male" && p.Sex != "other" && p.Sex != "unknown") {
				return ErrInvalidSetup
			}
		}
	}
	return nil
}

func (s Snapshot) ApplySetup(input Setup) (json.RawMessage, error) {
	if err := input.Validate(s); err != nil {
		return nil, err
	}
	fields := map[string]any{
		"admittingDoctorSideId": input.AdmittingDoctorSideID,
		"sideLoadLimits":        input.SideLoadLimits, "nurses": input.Nurses, "bedStates": input.BedStates,
	}
	if input.CarryOverReviewedAt != nil {
		fields["carryOverReviewedAt"] = input.CarryOverReviewedAt
	}
	for key, value := range fields {
		if err := s.set(key, value); err != nil {
			return nil, err
		}
	}
	return json.Marshal(s)
}

func (s Snapshot) BaselineID() string {
	var result struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(s["assignmentResult"], &result)
	return strings.TrimSpace(result.ID)
}

func (s Snapshot) Reopen() (json.RawMessage, error) {
	delete(s, "assignmentResult")
	s["flags"] = json.RawMessage(`[]`)
	s["status"] = json.RawMessage(`"setup"`)
	return json.Marshal(s)
}

// CarryOver mirrors the existing helper: nurses omit load and assignments;
// patients with blank initials are excluded. Suggestions get fresh local IDs.
func (s Snapshot) CarryOver() ([]NurseSuggestion, []PatientSuggestion, error) {
	var nurses []Nurse
	var states []BedState
	var beds []templates.Bed
	if json.Unmarshal(s["nurses"], &nurses) != nil || json.Unmarshal(s["bedStates"], &states) != nil || json.Unmarshal(s["beds"], &beds) != nil {
		return nil, nil, ErrInvalidSetup
	}
	nurseSuggestions := make([]NurseSuggestion, 0, len(nurses))
	patientSuggestions := make([]PatientSuggestion, 0)
	for _, nurse := range nurses {
		id, err := NewID()
		if err != nil {
			return nil, nil, err
		}
		nurseSuggestions = append(nurseSuggestions, NurseSuggestion{id, nurse.ID, nurse.Name, nurse.LicenseType, nurse.ExperienceLevel})
	}
	labels := map[string]string{}
	for _, bed := range beds {
		labels[bed.ID] = bed.Label
	}
	for _, state := range states {
		if state.Patient == nil || strings.TrimSpace(state.Patient.Initials) == "" {
			continue
		}
		id, err := NewID()
		if err != nil {
			return nil, nil, err
		}
		label, ok := labels[state.BedID]
		if !ok {
			label = "Unknown bed"
		}
		patientSuggestions = append(patientSuggestions, PatientSuggestion{id, state.BedID, label, *state.Patient, state.Acuity})
	}
	return nurseSuggestions, patientSuggestions, nil
}

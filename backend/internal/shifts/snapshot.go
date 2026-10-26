// Package shifts contains shift rules without HTTP or database dependencies.
package shifts

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/pratham124/nurse-flow/backend/internal/templates"
)

// ErrInvalidSetup indicates missing or inconsistent shift setup data.
var ErrInvalidSetup = errors.New("shift setup is incomplete or inconsistent")

// maxPatientInitials keeps stored patient identifiers short, so a shift never
// holds more than two letters about who a patient is.
const maxPatientInitials = 2

// Snapshot preserves stored fields owned by other workflows, including request
// history and optimizer results. Setup edits replace only the fields below.
type Snapshot map[string]json.RawMessage

// LoadRange sets the inclusive minimum and maximum patient load.
type LoadRange struct {
	Min int `json:"min"`
	Max int `json:"max"`
}

// LoadLimits defines patient-load ranges for admitting and non-admitting sides.
type LoadLimits struct {
	Admitting    LoadRange `json:"admitting"`
	NonAdmitting LoadRange `json:"nonAdmitting"`
}

// Nurse contains the staffing details used during shift setup.
type Nurse struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	LicenseType     string `json:"licenseType"`
	ExperienceLevel string `json:"experienceLevel"`
	MaxPatientLoad  int    `json:"maxPatientLoad"`
}

// Patient contains the optional patient details recorded for a bed.
type Patient struct {
	Initials  string `json:"initials"`
	Age       *int   `json:"age,omitempty"`
	Sex       string `json:"sex,omitempty"`
	Diagnosis string `json:"diagnosis,omitempty"`
}

// BedState records a bed's patient and acuity for one shift.
type BedState struct {
	ID      string   `json:"id"`
	BedID   string   `json:"bedId"`
	Patient *Patient `json:"patient,omitempty"`
	Acuity  string   `json:"acuity,omitempty"`
}

// Setup contains the fields a charge nurse can edit during shift setup.
type Setup struct {
	AdmittingDoctorSideID string     `json:"admittingDoctorSideId"`
	SideLoadLimits        LoadLimits `json:"sideLoadLimits"`
	Nurses                []Nurse    `json:"nurses"`
	BedStates             []BedState `json:"bedStates"`
	CarryOverReviewedAt   *time.Time `json:"carryOverReviewedAt,omitempty"`
}

// initialSnapshot defines the fields written when a shift starts.
// Later edits use Snapshot to preserve fields added by other workflows.
type initialSnapshot struct {
	ID                    string                 `json:"id"`
	FloorTemplateID       string                 `json:"floorTemplateId"`
	FloorName             string                 `json:"floorName"`
	StartedAt             time.Time              `json:"startedAt"`
	Status                string                 `json:"status"`
	AdmittingDoctorSideID string                 `json:"admittingDoctorSideId"`
	DoctorSides           []templates.DoctorSide `json:"doctorSides"`
	Rooms                 []templates.Room       `json:"rooms"`
	Beds                  []templates.Bed        `json:"beds"`
	SideLoadLimits        LoadLimits             `json:"sideLoadLimits"`
	Nurses                []Nurse                `json:"nurses"`
	BedStates             []BedState             `json:"bedStates"`
	Flags                 []json.RawMessage      `json:"flags"`
	NurseRequests         []json.RawMessage      `json:"nurseRequests"`
}

// NurseSuggestion carries reusable nurse details from a completed shift.
type NurseSuggestion struct {
	ID              string `json:"id"`
	PreviousNurseID string `json:"previousNurseId"`
	Name            string `json:"name"`
	LicenseType     string `json:"licenseType"`
	ExperienceLevel string `json:"experienceLevel"`
}

// PatientSuggestion carries patient details and their previous bed context.
type PatientSuggestion struct {
	ID               string  `json:"id"`
	PreviousBedID    string  `json:"previousBedId"`
	PreviousBedLabel string  `json:"previousBedLabel"`
	Patient          Patient `json:"patient"`
	Acuity           string  `json:"acuity,omitempty"`
}

// NewID generates a random version 4 UUID for a shift or suggestion.
func NewID() (string, error) {
	id, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	return id.String(), nil
}

// Decode reads a JSON object while preserving fields owned by other workflows.
func Decode(raw json.RawMessage) (Snapshot, error) {
	var snapshot Snapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil || snapshot == nil {
		return nil, ErrInvalidSetup
	}
	return snapshot, nil
}

func (s Snapshot) set(key string, value any) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	s[key] = raw
	return nil
}

// New builds the initial shift JSON from a validated floor template.
func New(template templates.Snapshot, id string, now time.Time) (json.RawMessage, error) {
	if err := template.Validate(); err != nil {
		return nil, err
	}
	states := make([]BedState, 0, len(template.Beds))
	for _, bed := range template.Beds {
		stateID, err := NewID()
		if err != nil {
			return nil, err
		}
		states = append(states, BedState{ID: stateID, BedID: bed.ID})
	}
	snapshot := initialSnapshot{
		ID:                    id,
		FloorTemplateID:       template.ID,
		FloorName:             template.Name,
		StartedAt:             now,
		Status:                "setup",
		AdmittingDoctorSideID: "",
		DoctorSides:           template.DoctorSides,
		Rooms:                 template.Rooms,
		Beds:                  template.Beds,
		SideLoadLimits: LoadLimits{
			Admitting:    LoadRange{Min: 4, Max: 5},
			NonAdmitting: LoadRange{Min: 6, Max: 7},
		},
		Nurses:        []Nurse{},
		BedStates:     states,
		Flags:         []json.RawMessage{},
		NurseRequests: []json.RawMessage{},
	}
	return json.Marshal(snapshot)
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
			(state.Acuity != "" && !knownAcuities[state.Acuity]) {
			return ErrInvalidSetup
		}
		seen[state.BedID], stateIDs[state.ID] = true, true
		if p := state.Patient; p != nil {
			if (p.Age != nil && *p.Age < 0) || (p.Sex != "" && p.Sex != "female" && p.Sex != "male" && p.Sex != "other" && p.Sex != "unknown") ||
				utf8.RuneCountInString(strings.TrimSpace(p.Initials)) > maxPatientInitials {
				return ErrInvalidSetup
			}
		}
	}
	return nil
}

// ApplySetup validates and replaces setup fields, preserving other snapshot data.
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

// knownAcuities are the acuity values a patient's bed can have. A bed with a
// patient but any other acuity (or none) is not ready for the optimizer.
var knownAcuities = map[string]bool{"green": true, "yellow": true, "red": true}

// BaselineID returns the generated assignment's ID, trimmed of whitespace.
// Missing or malformed assignment data is treated as having no baseline.
func (s Snapshot) BaselineID() string {
	var result struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(s["assignmentResult"], &result); err != nil {
		return ""
	}
	return strings.TrimSpace(result.ID)
}

// Reopen removes the generated assignment and resets the snapshot to setup.
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
		nurseSuggestions = append(nurseSuggestions, NurseSuggestion{
			ID:              id,
			PreviousNurseID: nurse.ID,
			Name:            nurse.Name,
			LicenseType:     nurse.LicenseType,
			ExperienceLevel: nurse.ExperienceLevel,
		})
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
		patient := *state.Patient
		patient.Initials = shortInitials(patient.Initials)
		patientSuggestions = append(patientSuggestions, PatientSuggestion{
			ID:               id,
			PreviousBedID:    state.BedID,
			PreviousBedLabel: label,
			Patient:          patient,
			Acuity:           state.Acuity,
		})
	}
	return nurseSuggestions, patientSuggestions, nil
}

// shortInitials trims initials and keeps at most the first two characters, so
// shifts saved before the limit cannot carry longer initials forward.
func shortInitials(initials string) string {
	letters := []rune(strings.TrimSpace(initials))
	if len(letters) > maxPatientInitials {
		letters = letters[:maxPatientInitials]
	}
	return string(letters)
}

package shifts

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// RuleError reports a request the shift rules refuse. Code is the API error code
// and Message is shown to the user, so both stay stable.
type RuleError struct {
	Code    string
	Message string
}

func (e *RuleError) Error() string { return e.Message }

func invalidMove(message string) error {
	return &RuleError{Code: "invalid_move", Message: message}
}

// FormatTime writes a time the way request timestamps are stored in a snapshot:
// UTC, RFC 3339, microsecond precision at most.
func FormatTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.999999Z07:00")
}

// MoveRequest is a charge nurse's request to give one bed to another nurse.
type MoveRequest struct {
	BaselineAssignmentResultID string
	BedID                      string
	FromNurseID                string
	ToNurseID                  string
	// WarningAcknowledgements must be a JSON array; its items are checked later.
	WarningAcknowledgements json.RawMessage
	RelatedSwapRequestID    *string
	ClientMutationID        string
}

// Validate runs the checks that need no stored shift, in the original order.
func (r MoveRequest) Validate() error {
	switch {
	case strings.TrimSpace(r.BaselineAssignmentResultID) == "":
		return invalidMove("The generated assignment baseline is required.")
	case strings.TrimSpace(r.BedID) == "" || strings.TrimSpace(r.FromNurseID) == "" || strings.TrimSpace(r.ToNurseID) == "":
		return invalidMove("Choose a bed, current nurse, and target nurse.")
	case r.FromNurseID == r.ToNurseID:
		return invalidMove("Choose a different nurse for this bed.")
	case strings.TrimSpace(r.ClientMutationID) == "":
		return invalidMove("A client mutation ID is required.")
	}
	_, err := acknowledgementItems(r.WarningAcknowledgements)
	return err
}

func acknowledgementItems(raw json.RawMessage) ([]json.RawMessage, error) {
	var items []json.RawMessage
	if json.Unmarshal(raw, &items) != nil || items == nil {
		return nil, invalidMove("Warning acknowledgements must be an array.")
	}
	return items, nil
}

// StaleMove describes a move built on an outdated board. It is a normal result,
// not an error: the app reloads the board and asks again.
type StaleMove struct {
	Message string
	// Both are nil when the snapshot has no value, which the app receives as null.
	CurrentBaselineID       *string
	CurrentEffectiveNurseID *string
}

// MovePlan is the outcome of checking a move: either Stale, or the normalized
// acknowledgements to store with the new override.
type MovePlan struct {
	Stale            *StaleMove
	Acknowledgements json.RawMessage
}

// The stored parts of a snapshot that a move reads, with the JSON names they have there.
type moveBed struct {
	ID     string `json:"id"`
	RoomID string `json:"roomId"`
}

type moveRoom struct {
	ID           string `json:"id"`
	DoctorSideID string `json:"doctorSideId"`
}

type roomCoverage struct {
	RoomID   string   `json:"roomId"`
	NurseIDs []string `json:"nurseIds"`
}

// moveFacts gathers the stored parts of a snapshot that a move depends on.
type moveFacts struct {
	assignments     []bedAssignment
	beds            []moveBed
	rooms           []moveRoom
	nurses          []Nurse
	states          []BedState
	coverage        []roomCoverage
	admittingSideID string
	limits          LoadLimits
}

func (s Snapshot) decode(key string, target any) error {
	raw, ok := s[key]
	if !ok || isJSONNull(raw) {
		return nil
	}
	if json.Unmarshal(raw, target) != nil {
		return ErrInvalidSetup
	}
	return nil
}

func (s Snapshot) moveFacts() (moveFacts, error) {
	var facts moveFacts
	var err error
	if facts.assignments, err = s.bedAssignments(); err != nil {
		return facts, err
	}
	var result struct {
		RoomCoverage []roomCoverage `json:"roomCoverage"`
	}
	if err := s.decode("assignmentResult", &result); err != nil {
		return facts, err
	}
	facts.coverage = result.RoomCoverage
	if err := s.decode("beds", &facts.beds); err != nil {
		return facts, err
	}
	if err := s.decode("rooms", &facts.rooms); err != nil {
		return facts, err
	}
	if err := s.decode("nurses", &facts.nurses); err != nil {
		return facts, err
	}
	if err := s.decode("bedStates", &facts.states); err != nil {
		return facts, err
	}
	if err := s.decode("admittingDoctorSideId", &facts.admittingSideID); err != nil {
		return facts, err
	}
	return facts, s.decode("sideLoadLimits", &facts.limits)
}

// rawBaselineID is the stored assignment ID exactly as saved, or nil without one.
func (s Snapshot) rawBaselineID() *string {
	var result struct {
		ID *string `json:"id"`
	}
	if json.Unmarshal(s["assignmentResult"], &result) != nil {
		return nil
	}
	return result.ID
}

// PlanMove checks a move against the stored shift and its active overrides, in
// the original order, and normalizes its warning acknowledgements. at stamps the
// acknowledgements; it is the same time the caller stores on the override.
func (s Snapshot) PlanMove(req MoveRequest, overrides []ActiveOverride, profileID string, at time.Time) (MovePlan, error) {
	facts, err := s.moveFacts()
	if err != nil {
		return MovePlan{}, err
	}
	items, err := acknowledgementItems(req.WarningAcknowledgements)
	if err != nil {
		return MovePlan{}, err
	}

	baseline := s.rawBaselineID()
	effective := currentEffectiveNurse(facts.assignments, overrides, req.BedID)
	if baseline == nil || *baseline != req.BaselineAssignmentResultID {
		return staleMove("The generated assignment changed. Review the current board and try again.", baseline, effective), nil
	}
	if effective == nil || *effective != req.FromNurseID {
		return staleMove("This bed assignment changed. Review the current board and try again.", baseline, effective), nil
	}
	if !hasAssignment(facts.assignments, req.BedID) {
		return MovePlan{}, invalidMove("This bed does not have a generated assignment.")
	}

	bed := findBed(facts.beds, req.BedID)
	if bed == nil {
		return MovePlan{}, invalidMove("This bed is no longer part of the active shift.")
	}
	roomID := bed.RoomID
	state := findBedState(facts.states, req.BedID)
	if state == nil || state.Patient == nil || strings.TrimSpace(state.Patient.Initials) == "" {
		return MovePlan{}, invalidMove("Only an occupied bed can be moved.")
	}
	target := findNurse(facts.nurses, req.ToNurseID)
	if target == nil {
		return MovePlan{}, invalidMove("The selected nurse is no longer on this shift.")
	}
	if !facts.covers(roomID, req.ToNurseID) {
		return MovePlan{}, invalidMove("The selected nurse does not cover this room.")
	}
	if state.Acuity == "red" && target.LicenseType != "RN" {
		return MovePlan{}, invalidMove("A red-acuity bed must be assigned to an RN.")
	}
	if req.RelatedSwapRequestID != nil {
		if err := s.checkLinkedSwap(*req.RelatedSwapRequestID, req.BedID, req.FromNurseID); err != nil {
			return MovePlan{}, err
		}
	}

	loadAfter := facts.loadAfterMove(overrides, req.BedID, req.ToNurseID)
	sideLimit := facts.limits.NonAdmitting.Max
	if facts.coversAdmittingSide(req.ToNurseID) {
		sideLimit = facts.limits.Admitting.Max
	}
	if loadAfter > target.MaxPatientLoad && !hasWarning(items, "over_max_load") {
		return MovePlan{}, invalidMove("Acknowledge the max-load warning before confirming.")
	}
	if loadAfter > sideLimit && !hasWarning(items, "over_side_load_limit") {
		return MovePlan{}, invalidMove("Acknowledge the side-load warning before confirming.")
	}

	acknowledgements, err := normalizeAcknowledgements(items, *target, loadAfter, sideLimit, profileID, at)
	if err != nil {
		return MovePlan{}, err
	}
	return MovePlan{Acknowledgements: acknowledgements}, nil
}

func findBed(beds []moveBed, id string) *moveBed {
	for i := range beds {
		if beds[i].ID == id {
			return &beds[i]
		}
	}
	return nil
}

func findBedState(states []BedState, bedID string) *BedState {
	for i := range states {
		if states[i].BedID == bedID {
			return &states[i]
		}
	}
	return nil
}

func findNurse(nurses []Nurse, id string) *Nurse {
	for i := range nurses {
		if nurses[i].ID == id {
			return &nurses[i]
		}
	}
	return nil
}

func staleMove(message string, baseline, effective *string) MovePlan {
	return MovePlan{Stale: &StaleMove{Message: message, CurrentBaselineID: baseline, CurrentEffectiveNurseID: effective}}
}

// currentEffectiveNurse is the nurse who holds the bed now: the active override's
// nurse, else the generated one, else nil.
func currentEffectiveNurse(assignments []bedAssignment, overrides []ActiveOverride, bedID string) *string {
	for _, override := range overrides {
		if override.BedID == bedID {
			nurseID := override.ToNurseID
			return &nurseID
		}
	}
	for _, assignment := range assignments {
		if assignment.BedID == bedID {
			nurseID := assignment.NurseID
			return &nurseID
		}
	}
	return nil
}

func hasAssignment(assignments []bedAssignment, bedID string) bool {
	for _, assignment := range assignments {
		if assignment.BedID == bedID {
			return true
		}
	}
	return false
}

// covers reports whether the nurse is listed for the room in the generated coverage.
func (f moveFacts) covers(roomID, nurseID string) bool {
	for _, coverage := range f.coverage {
		if coverage.RoomID != roomID {
			continue
		}
		for _, id := range coverage.NurseIDs {
			if id == nurseID {
				return true
			}
		}
	}
	return false
}

// coversAdmittingSide reports whether the nurse covers any room on the admitting doctor side.
func (f moveFacts) coversAdmittingSide(nurseID string) bool {
	for _, room := range f.rooms {
		if room.DoctorSideID == f.admittingSideID && f.covers(room.ID, nurseID) {
			return true
		}
	}
	return false
}

// loadAfterMove counts the generated bed assignments the target would hold once
// the bed moves, taking active overrides into account.
func (f moveFacts) loadAfterMove(overrides []ActiveOverride, bedID, targetID string) int {
	effective := effectiveNurseIDs(f.assignments, overrides)
	effective[bedID] = targetID
	load := 0
	for _, nurseID := range effective {
		if nurseID == targetID {
			load++
		}
	}
	return load
}

// checkLinkedSwap makes sure the swap can be completed by this move. The second
// message matches the database trigger that completes the swap, so a bad link is
// reported here instead of failing inside the insert.
func (s Snapshot) checkLinkedSwap(swapID, bedID, fromNurseID string) error {
	requests, err := s.elements("nurseRequests")
	if err != nil {
		return err
	}
	linkable := false
	for _, request := range requests {
		if field(request, "id") != swapID || field(request, "type") != "swap" ||
			field(request, "status") != "accepted" || field(request, "sourceBedId") != bedID {
			continue
		}
		linkable = true
		if field(request, "requestingNurseId") == fromNurseID && field(request, "completedOverrideId") == "" {
			return nil
		}
	}
	if !linkable {
		return invalidMove("Only an accepted swap for this bed can be linked.")
	}
	return invalidMove("Only an uncompleted accepted swap owned by the current nurse can be completed.")
}

func hasWarning(items []json.RawMessage, warningType string) bool {
	for _, item := range items {
		if field(item, "warningType") == warningType {
			return true
		}
	}
	return false
}

// optionalField returns a string property and whether it was present and not null.
func optionalField(item json.RawMessage, name string) (string, bool) {
	var fields map[string]json.RawMessage
	if json.Unmarshal(item, &fields) != nil {
		return "", false
	}
	var value string
	if json.Unmarshal(fields[name], &value) != nil {
		return "", false
	}
	return value, true
}

// normalizeAcknowledgements keeps only the known warning types, rebuilds the two
// load messages from the stored shift, and records who acknowledged and when.
func normalizeAcknowledgements(items []json.RawMessage, target Nurse, loadAfter, sideLimit int, profileID string, at time.Time) (json.RawMessage, error) {
	name := strings.TrimSpace(target.Name)
	if name == "" {
		name = "The selected nurse"
	}
	normalized := []map[string]any{}
	for _, item := range items {
		warningType := field(item, "warningType")
		message, _ := optionalField(item, "message")
		switch warningType {
		case "over_max_load":
			message = fmt.Sprintf("%s has %d assigned patients, above their max load of %d.", name, loadAfter, target.MaxPatientLoad)
		case "over_side_load_limit":
			message = fmt.Sprintf("%s has %d assigned patients, above the side load limit of %d.", name, loadAfter, sideLimit)
		case "team_imbalance":
			if strings.TrimSpace(message) == "" {
				continue
			}
		default:
			continue
		}
		id := field(item, "id")
		if id == "" {
			id = "override-warning-" + strings.ReplaceAll(uuid.NewString(), "-", "")
		}
		acknowledgement := map[string]any{
			"id": id, "warningType": warningType, "message": message,
			"acknowledgedByProfileId": profileID, "acknowledgedAt": FormatTime(at),
		}
		for _, key := range []string{"nurseId", "bedId"} {
			if value, present := optionalField(item, key); present {
				acknowledgement[key] = value
			}
		}
		normalized = append(normalized, acknowledgement)
	}
	return json.Marshal(normalized)
}

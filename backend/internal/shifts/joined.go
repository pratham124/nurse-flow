package shifts

import (
	"encoding/json"
)

// AssignedBed is one bed shown to a joined nurse, with the details it depends on.
type AssignedBed struct {
	Bed        json.RawMessage `json:"bed"`
	BedState   json.RawMessage `json:"bedState"` // null when the bed has no state
	DoctorSide json.RawMessage `json:"doctorSide"`
	Room       json.RawMessage `json:"room"`
}

// JoinedView is the narrow part of a shift that a joined nurse may see.
type JoinedView struct {
	FloorName      string
	AssignedBeds   []AssignedBed
	RequestHistory []json.RawMessage
}

// firstByID returns the first item whose "id" matches, mirroring the original join.
func firstByID(items []json.RawMessage, id string) json.RawMessage {
	for _, item := range items {
		if field(item, "id") == id {
			return item
		}
	}
	return nil
}

// JoinedView builds the nurse's own beds and request history from a stored shift.
// Only beds whose bed, room, and doctor side all exist are included, so a
// damaged snapshot cannot leak or break the view.
func (s Snapshot) JoinedView(nurseID string, overrides []ActiveOverride) (JoinedView, error) {
	view := JoinedView{FloorName: s.FloorName(), AssignedBeds: []AssignedBed{}, RequestHistory: []json.RawMessage{}}
	assignments, err := s.bedAssignments()
	if err != nil {
		return JoinedView{}, err
	}
	beds, err := s.elements("beds")
	if err != nil {
		return JoinedView{}, err
	}
	rooms, err := s.elements("rooms")
	if err != nil {
		return JoinedView{}, err
	}
	sides, err := s.elements("doctorSides")
	if err != nil {
		return JoinedView{}, err
	}
	states, err := s.elements("bedStates")
	if err != nil {
		return JoinedView{}, err
	}
	effective := effectiveNurseIDs(assignments, overrides)
	for _, assignment := range assignments {
		if effective[assignment.BedID] != nurseID {
			continue
		}
		bed := firstByID(beds, assignment.BedID)
		if bed == nil {
			continue
		}
		room := firstByID(rooms, field(bed, "roomId"))
		if room == nil {
			continue
		}
		side := firstByID(sides, field(room, "doctorSideId"))
		if side == nil {
			continue
		}
		var state json.RawMessage
		for _, candidate := range states {
			if field(candidate, "bedId") == assignment.BedID {
				state = candidate
				break
			}
		}
		view.AssignedBeds = append(view.AssignedBeds, AssignedBed{Bed: bed, BedState: state, DoctorSide: side, Room: room})
	}

	requests, err := s.elements("nurseRequests")
	if err != nil {
		return JoinedView{}, err
	}
	activeOverrideIDs := make(map[string]bool, len(overrides))
	for _, override := range overrides {
		activeOverrideIDs[override.ID] = true
	}
	for _, request := range requests {
		if field(request, "requestingNurseId") != nurseID {
			continue
		}
		entry, err := markChangedLater(request, activeOverrideIDs)
		if err != nil {
			return JoinedView{}, err
		}
		view.RequestHistory = append(view.RequestHistory, entry)
	}
	return view, nil
}

// markChangedLater adds completedAssignmentChangedLater when a completed
// request's override is no longer active.
func markChangedLater(request json.RawMessage, activeOverrideIDs map[string]bool) (json.RawMessage, error) {
	completedID := field(request, "completedOverrideId")
	if completedID == "" || activeOverrideIDs[completedID] {
		return request, nil
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(request, &fields); err != nil {
		return nil, ErrInvalidSetup
	}
	fields["completedAssignmentChangedLater"] = json.RawMessage(`true`)
	return json.Marshal(fields)
}

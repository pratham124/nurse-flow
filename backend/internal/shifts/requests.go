package shifts

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
)

// NurseSlot identifies the nurse on the shift who makes a request.
type NurseSlot struct {
	ID   string
	Name string
}

// RequestChange is the result of changing the request list: the whole new
// snapshot to store and the one request that was added or changed. Snapshot is
// nil when nothing changed.
type RequestChange struct {
	Snapshot json.RawMessage
	Request  json.RawMessage
}

func invalidRequest(message string) error {
	return &RuleError{Code: "invalid_request", Message: message}
}

// requestFields is one stored request as a map, so keys this code does not know
// about are written back unchanged.
type requestFields map[string]json.RawMessage

func (r requestFields) setString(key, value string) {
	raw, _ := json.Marshal(value) // a string always marshals
	r[key] = raw
}

// newRequestFields starts a pending request for the nurse.
func newRequestFields(requestType string, slot NurseSlot, message string, at time.Time) requestFields {
	request := requestFields{}
	request.setString("id", "nurse-request-"+strings.ReplaceAll(uuid.NewString(), "-", ""))
	request.setString("type", requestType)
	request.setString("status", "pending")
	request.setString("requestingNurseId", slot.ID)
	request.setString("requestingNurseName", slot.Name)
	request.setString("message", message)
	request.setString("createdAt", FormatTime(at))
	return request
}

// appendRequest stores the new request last and returns the whole change.
func (s Snapshot) appendRequest(request requestFields) (RequestChange, error) {
	items, err := s.elements("nurseRequests")
	if err != nil {
		return RequestChange{}, err
	}
	added, err := json.Marshal(request)
	if err != nil {
		return RequestChange{}, err
	}
	return s.replaceRequests(append(items, added), added)
}

// replaceRequests writes the request list back, leaving every other key alone.
func (s Snapshot) replaceRequests(items []json.RawMessage, changed json.RawMessage) (RequestChange, error) {
	list, err := json.Marshal(items)
	if err != nil {
		return RequestChange{}, err
	}
	// Work on a copy so the snapshot the caller holds stays what was loaded.
	next := make(Snapshot, len(s))
	for key, value := range s {
		next[key] = value
	}
	next["nurseRequests"] = list
	raw, err := json.Marshal(next)
	if err != nil {
		return RequestChange{}, err
	}
	return RequestChange{Snapshot: raw, Request: changed}, nil
}

// hasPendingRequest finds a pending request of this type from the nurse whose
// message matches, ignoring case and surrounding spaces. A bed of "" matches
// only requests without a source bed (issues); otherwise the bed must match.
func hasPendingRequest(items []json.RawMessage, requestType, nurseID, bedID, message string) bool {
	for _, item := range items {
		if field(item, "type") == requestType && field(item, "status") == "pending" &&
			field(item, "requestingNurseId") == nurseID && field(item, "sourceBedId") == bedID &&
			strings.EqualFold(strings.TrimSpace(field(item, "message")), message) {
			return true
		}
	}
	return false
}

// ValidateIssueMessage checks the text of a new issue request.
func ValidateIssueMessage(message string) error {
	if strings.TrimSpace(message) == "" {
		return invalidRequest("Add issue details before submitting.")
	}
	return nil
}

// AddIssueRequest appends a pending issue from the nurse.
func (s Snapshot) AddIssueRequest(slot NurseSlot, message string, at time.Time) (RequestChange, error) {
	if err := ValidateIssueMessage(message); err != nil {
		return RequestChange{}, err
	}
	message = strings.TrimSpace(message)
	items, err := s.elements("nurseRequests")
	if err != nil {
		return RequestChange{}, err
	}
	if hasPendingRequest(items, "issue", slot.ID, "", message) {
		return RequestChange{}, &RuleError{Code: "request_pending", Message: "This issue is already pending."}
	}
	return s.appendRequest(newRequestFields("issue", slot, message, at))
}

// ValidateSwapInput checks the bed and text of a new swap request.
func ValidateSwapInput(bedID, message string) error {
	if strings.TrimSpace(bedID) == "" {
		return invalidRequest("Choose the assigned bed for this swap request.")
	}
	if strings.TrimSpace(message) == "" {
		return invalidRequest("Add swap details before submitting.")
	}
	return nil
}

// AddSwapRequest appends a pending swap for a bed the nurse holds now: a bed
// moved to the nurse counts, and a bed moved away does not.
func (s Snapshot) AddSwapRequest(slot NurseSlot, bedID, message string, overrides []ActiveOverride, at time.Time) (RequestChange, error) {
	if err := ValidateSwapInput(bedID, message); err != nil {
		return RequestChange{}, err
	}
	message = strings.TrimSpace(message)
	assignments, err := s.bedAssignments()
	if err != nil {
		return RequestChange{}, err
	}
	if effectiveNurseIDs(assignments, overrides)[bedID] != slot.ID {
		return RequestChange{}, invalidRequest("Choose one of your assigned beds for the swap.")
	}
	items, err := s.elements("nurseRequests")
	if err != nil {
		return RequestChange{}, err
	}
	if hasPendingRequest(items, "swap", slot.ID, bedID, message) {
		return RequestChange{}, &RuleError{Code: "request_pending", Message: "This swap request is already pending."}
	}
	request := newRequestFields("swap", slot, message, at)
	request.setString("sourceBedId", bedID)
	return s.appendRequest(request)
}

// ValidateIssueStatus checks the review status chosen by the charge nurse.
func ValidateIssueStatus(status string) error {
	if status != "open" && status != "reviewed" && status != "resolved" {
		return invalidRequest("Choose open, reviewed, or resolved.")
	}
	return nil
}

// issueTransitionAllowed lists the review status changes a charge nurse may make.
func issueTransitionAllowed(from, to string) bool {
	return (from == "open" && (to == "reviewed" || to == "resolved")) ||
		(from == "reviewed" && to == "resolved") ||
		(from == "resolved" && to == "open")
}

// findRequest returns the index of the first request with this ID and type, or -1.
func findRequest(items []json.RawMessage, id, requestType string) int {
	for i, item := range items {
		if field(item, "id") == id && field(item, "type") == requestType {
			return i
		}
	}
	return -1
}

// editRequest decodes one request, lets change edit its fields, and encodes it again.
func editRequest(item json.RawMessage, change func(requestFields)) (json.RawMessage, error) {
	var fields requestFields
	if json.Unmarshal(item, &fields) != nil || fields == nil {
		return nil, ErrInvalidSetup
	}
	change(fields)
	return json.Marshal(fields)
}

// SetIssueStatus moves an issue to a new review status and records who did it.
// Asking for the status the issue already has changes nothing: the returned
// change then has no Snapshot.
func (s Snapshot) SetIssueStatus(requestID, status, profileID string, at time.Time) (RequestChange, error) {
	if err := ValidateIssueStatus(status); err != nil {
		return RequestChange{}, err
	}
	items, err := s.elements("nurseRequests")
	if err != nil {
		return RequestChange{}, err
	}
	index := findRequest(items, strings.TrimSpace(requestID), "issue")
	if index < 0 {
		return RequestChange{}, &RuleError{Code: "request_not_found", Message: "The issue request is unavailable."}
	}
	current, present := optionalField(items[index], "issueReviewStatus")
	if !present {
		current = "open"
	}
	if current == status {
		return RequestChange{Request: items[index]}, nil
	}
	if !issueTransitionAllowed(current, status) {
		return RequestChange{}, &RuleError{Code: "invalid_transition", Message: "That issue status change is not allowed."}
	}
	updated, err := editRequest(items[index], func(request requestFields) {
		stamp := FormatTime(at)
		request.setString("issueReviewStatus", status)
		switch status {
		case "reviewed":
			delete(request, "issueResolvedAt")
			delete(request, "issueResolvedByProfileId")
			request.setString("reviewedAt", stamp)
			request.setString("reviewedByProfileId", profileID)
		case "resolved":
			request.setString("issueResolvedAt", stamp)
			request.setString("issueResolvedByProfileId", profileID)
		case "open":
			for _, key := range []string{"reviewedAt", "reviewedByProfileId", "issueResolvedAt", "issueResolvedByProfileId"} {
				delete(request, key)
			}
		}
	})
	if err != nil {
		return RequestChange{}, err
	}
	items[index] = updated
	return s.replaceRequests(items, updated)
}

// ValidateResolution checks the decision on a swap request.
func ValidateResolution(status string) error {
	if status != "accepted" && status != "declined" {
		return invalidRequest("Choose accepted or declined.")
	}
	return nil
}

// ResolveSwap accepts or declines a pending swap. Accepting does not move the
// bed; the charge nurse completes the swap later with a manual move.
func (s Snapshot) ResolveSwap(requestID, status string, at time.Time) (RequestChange, error) {
	if err := ValidateResolution(status); err != nil {
		return RequestChange{}, err
	}
	items, err := s.elements("nurseRequests")
	if err != nil {
		return RequestChange{}, err
	}
	index := findRequest(items, requestID, "swap")
	if index < 0 || field(items[index], "status") != "pending" {
		return RequestChange{}, &RuleError{Code: "request_not_pending", Message: "Only pending swap requests can be resolved."}
	}
	updated, err := editRequest(items[index], func(request requestFields) {
		request.setString("status", status)
		request.setString("resolvedAt", FormatTime(at))
		if status == "accepted" {
			request.setString("resolutionNote", "Accepted by charge")
		} else {
			request.setString("resolutionNote", "Declined by charge")
		}
	})
	if err != nil {
		return RequestChange{}, err
	}
	items[index] = updated
	return s.replaceRequests(items, updated)
}

package shifts

import (
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"
)

// Message limits copied from the nurse_request_messages table checks.
const (
	maxMessageCharacters    = 1000
	maxMutationIDCharacters = 120
)

// The error text is shown to the user, so it matches the original SQL function.
var (
	// ErrMessageBlank indicates a message with no text after trimming.
	ErrMessageBlank = errors.New("Write a message before sending.")
	// ErrMessageTooLong indicates a trimmed message over 1000 characters.
	ErrMessageTooLong = errors.New("Keep messages to 1000 characters or fewer.")
	// ErrMutationIDTooLong indicates a retry identifier over 120 characters.
	ErrMutationIDTooLong = errors.New("Message retry identifiers must be 120 characters or fewer.")
)

// RequestingNurseID returns the nurse who made the request with this ID, or ""
// when the request is missing or has no requesting nurse. The ID is trimmed, as
// the original thread rule did; stored IDs are compared exactly. Like the
// original, only the first request with a matching ID counts.
func (s Snapshot) RequestingNurseID(requestID string) string {
	var requests []struct {
		ID                string `json:"id"`
		RequestingNurseID string `json:"requestingNurseId"`
	}
	if json.Unmarshal(s["nurseRequests"], &requests) != nil {
		return ""
	}
	wanted := strings.TrimSpace(requestID)
	for _, request := range requests {
		if request.ID == wanted {
			return request.RequestingNurseID
		}
	}
	return ""
}

// CleanMessage trims and checks a new message. Lengths count characters, like
// the database's char_length, not bytes. A blank retry identifier means none and
// comes back empty.
func CleanMessage(body, clientMutationID string) (cleanBody, cleanMutationID string, err error) {
	cleanBody = strings.TrimSpace(body)
	cleanMutationID = strings.TrimSpace(clientMutationID)
	switch {
	case cleanBody == "":
		return "", "", ErrMessageBlank
	case utf8.RuneCountInString(cleanBody) > maxMessageCharacters:
		return "", "", ErrMessageTooLong
	case utf8.RuneCountInString(cleanMutationID) > maxMutationIDCharacters:
		return "", "", ErrMutationIDTooLong
	}
	return cleanBody, cleanMutationID, nil
}

package shifts

import (
	"encoding/json"
	"time"
	"unicode/utf8"
)

// chatPreviewRunes is how much of a message the chat entry keeps as a preview.
const chatPreviewRunes = 120

// NurseSlot identifies the nurse on the shift who owns a request.
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

// requestFields is one stored request as a map, so keys this code does not know
// about are written back unchanged.
type requestFields map[string]json.RawMessage

func (r requestFields) setString(key, value string) {
	raw, _ := json.Marshal(value) // a string always marshals
	r[key] = raw
}

// ChatRequestID is the fixed ID of a nurse's chat with charge. Because it is
// derived from the nurse, opening a chat twice finds the first one instead of
// creating a second.
func ChatRequestID(nurseID string) string {
	return "nurse-chat-" + nurseID
}

// FindNurseSlot looks a nurse up on the shift by ID. It reports false when the
// nurse is not (or no longer) on the shift.
func (s Snapshot) FindNurseSlot(nurseID string) (NurseSlot, bool, error) {
	var nurses []Nurse
	if err := s.decode("nurses", &nurses); err != nil {
		return NurseSlot{}, false, err
	}
	nurse := findNurse(nurses, nurseID)
	if nurse == nil {
		return NurseSlot{}, false, nil
	}
	return NurseSlot{ID: nurse.ID, Name: nurse.Name}, true, nil
}

// EnsureChat returns the nurse's chat, adding it to the shift when it does not
// exist yet. created is false when the chat was already there; the change then
// has no Snapshot, so nothing needs saving.
func (s Snapshot) EnsureChat(slot NurseSlot, at time.Time) (change RequestChange, created bool, err error) {
	items, err := s.elements("nurseRequests")
	if err != nil {
		return RequestChange{}, false, err
	}
	chatID := ChatRequestID(slot.ID)
	if index := findRequest(items, chatID, "chat"); index >= 0 {
		return RequestChange{Request: items[index]}, false, nil
	}
	chat := requestFields{}
	chat.setString("id", chatID)
	chat.setString("type", "chat")
	chat.setString("requestingNurseId", slot.ID)
	chat.setString("requestingNurseName", slot.Name)
	chat.setString("createdAt", FormatTime(at))
	change, err = s.appendRequest(chat)
	return change, err == nil, err
}

// StampChatActivity records the newest message on the chat entry so both apps
// can show it in a list without loading the thread. A request that is not a
// chat is left alone: the returned change then has no Snapshot.
func (s Snapshot) StampChatActivity(requestID, authorProfileID, body string, at time.Time) (RequestChange, error) {
	items, err := s.elements("nurseRequests")
	if err != nil {
		return RequestChange{}, err
	}
	index := findRequest(items, requestID, "chat")
	if index < 0 {
		return RequestChange{}, nil
	}
	updated, err := editRequest(items[index], func(chat requestFields) {
		chat.setString("lastMessageAt", FormatTime(at))
		chat.setString("lastMessageAuthorProfileId", authorProfileID)
		chat.setString("lastMessagePreview", chatPreview(body))
	})
	if err != nil {
		return RequestChange{}, err
	}
	items[index] = updated
	return s.replaceRequests(items, updated)
}

// chatPreview keeps the first characters of a message, never cutting a
// multi-byte character in half.
func chatPreview(body string) string {
	if utf8.RuneCountInString(body) <= chatPreviewRunes {
		return body
	}
	return string([]rune(body)[:chatPreviewRunes])
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

// IsChat reports whether the request with this ID is a chat.
func (s Snapshot) IsChat(requestID string) bool {
	items, err := s.elements("nurseRequests")
	return err == nil && findRequest(items, requestID, "chat") >= 0
}

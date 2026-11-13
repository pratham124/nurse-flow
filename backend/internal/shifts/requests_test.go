package shifts

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

var requestTime = time.Date(2026, 10, 24, 13, 30, 0, 0, time.UTC)

// requestsOf reads the request objects out of a snapshot produced by the code under test.
func requestsOf(t *testing.T, raw json.RawMessage) []map[string]any {
	t.Helper()
	var snapshot struct {
		NurseRequests []map[string]any `json:"nurseRequests"`
	}
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		t.Fatal(err)
	}
	return snapshot.NurseRequests
}

func objectOf(t *testing.T, raw json.RawMessage) map[string]any {
	t.Helper()
	var object map[string]any
	if err := json.Unmarshal(raw, &object); err != nil {
		t.Fatal(err)
	}
	return object
}

var nina = NurseSlot{ID: "n1", Name: "Nina"}

func TestChatRequestID(t *testing.T) {
	if got := ChatRequestID("nurse-abc"); got != "nurse-chat-nurse-abc" {
		t.Fatalf("got %q", got)
	}
}

func TestFindNurseSlot(t *testing.T) {
	snapshot := decodeFixture(t, nil)
	slot, found, err := snapshot.FindNurseSlot("n2")
	if err != nil || !found || slot != (NurseSlot{ID: "n2", Name: "Omar"}) {
		t.Fatalf("got %v %v %v", slot, found, err)
	}
	if _, found, err := snapshot.FindNurseSlot("nobody"); err != nil || found {
		t.Fatalf("missing nurse: %v %v", found, err)
	}
	broken := decodeFixture(t, func(d map[string]any) { d["nurses"] = "nope" })
	if _, _, err := broken.FindNurseSlot("n1"); err == nil {
		t.Fatal("a malformed nurses list must fail")
	}
}

func TestEnsureChatCreatesOnce(t *testing.T) {
	snapshot := decodeFixture(t, nil)
	change, created, err := snapshot.EnsureChat(nina, requestTime)
	if err != nil || !created {
		t.Fatalf("created=%v err=%v", created, err)
	}
	chat := objectOf(t, change.Request)
	for key, want := range map[string]any{"id": "nurse-chat-n1", "type": "chat", "requestingNurseId": "n1", "requestingNurseName": "Nina", "createdAt": "2026-10-24T13:30:00Z"} {
		if chat[key] != want {
			t.Fatalf("%s = %v, want %v", key, chat[key], want)
		}
	}
	if _, has := chat["status"]; has {
		t.Fatal("a chat has no status")
	}
	requests := requestsOf(t, change.Snapshot)
	if requests[len(requests)-1]["id"] != "nurse-chat-n1" || len(requests) != 5 {
		t.Fatalf("chat must be added last, keeping the others: %v", requests)
	}
	if objectOf(t, change.Snapshot)["futureField"] == nil {
		t.Fatal("unknown snapshot keys must be preserved")
	}

	// Opening again finds the stored chat and asks for no write.
	stored, err := Decode(change.Snapshot)
	if err != nil {
		t.Fatal(err)
	}
	again, created, err := stored.EnsureChat(nina, requestTime.Add(time.Hour))
	if err != nil || created || again.Snapshot != nil {
		t.Fatalf("second open: created=%v snapshot=%s err=%v", created, again.Snapshot, err)
	}
	if objectOf(t, again.Request)["createdAt"] != "2026-10-24T13:30:00Z" {
		t.Fatalf("existing chat must come back unchanged: %s", again.Request)
	}
}

func TestEnsureChatIgnoresLegacyEntriesAndBadList(t *testing.T) {
	// A legacy issue with the same ID must not count as the chat.
	snapshot := decodeFixture(t, func(d map[string]any) {
		d["nurseRequests"] = []any{map[string]any{"id": "nurse-chat-n1", "type": "issue", "status": "pending", "requestingNurseId": "n1"}}
	})
	if _, created, err := snapshot.EnsureChat(nina, requestTime); err != nil || !created {
		t.Fatalf("created=%v err=%v", created, err)
	}
	broken := decodeFixture(t, func(d map[string]any) { d["nurseRequests"] = "nope" })
	if _, _, err := broken.EnsureChat(nina, requestTime); err == nil {
		t.Fatal("a malformed request list must fail")
	}
}

func chatSnapshot(t *testing.T) Snapshot {
	t.Helper()
	return decodeFixture(t, func(d map[string]any) {
		d["nurseRequests"] = []any{
			map[string]any{"id": "nurse-chat-n1", "type": "chat", "requestingNurseId": "n1", "requestingNurseName": "Nina", "createdAt": "2026-10-24T13:00:00Z", "extra": "keep"},
			map[string]any{"id": "i1", "type": "issue", "status": "pending", "requestingNurseId": "n1"},
		}
	})
}

func TestStampChatActivity(t *testing.T) {
	change, err := chatSnapshot(t).StampChatActivity("nurse-chat-n1", "profile-1", "Can you cover room 4?", requestTime)
	if err != nil {
		t.Fatal(err)
	}
	chat := objectOf(t, change.Request)
	for key, want := range map[string]any{"lastMessageAt": "2026-10-24T13:30:00Z", "lastMessageAuthorProfileId": "profile-1", "lastMessagePreview": "Can you cover room 4?", "extra": "keep", "createdAt": "2026-10-24T13:00:00Z"} {
		if chat[key] != want {
			t.Fatalf("%s = %v, want %v", key, chat[key], want)
		}
	}
	requests := requestsOf(t, change.Snapshot)
	if len(requests) != 2 || requests[1]["id"] != "i1" || requests[1]["lastMessageAt"] != nil {
		t.Fatalf("other requests must be untouched: %v", requests)
	}
}

func TestStampChatActivityPreviewCountsCharacters(t *testing.T) {
	body := strings.Repeat("é", 130)
	change, err := chatSnapshot(t).StampChatActivity("nurse-chat-n1", "p", body, requestTime)
	if err != nil {
		t.Fatal(err)
	}
	if got := objectOf(t, change.Request)["lastMessagePreview"].(string); got != strings.Repeat("é", 120) {
		t.Fatalf("preview has %d characters", len([]rune(got)))
	}
}

func TestStampChatActivitySkipsNonChats(t *testing.T) {
	for _, id := range []string{"i1", "missing", ""} {
		change, err := chatSnapshot(t).StampChatActivity(id, "p", "hi", requestTime)
		if err != nil || change.Snapshot != nil || change.Request != nil {
			t.Fatalf("%q: change=%v err=%v", id, change, err)
		}
	}
	broken := decodeFixture(t, func(d map[string]any) { d["nurseRequests"] = "nope" })
	if _, err := broken.StampChatActivity("x", "p", "hi", requestTime); err == nil {
		t.Fatal("a malformed request list must fail")
	}
}

package database

import (
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/pratham124/nurse-flow/backend/internal/shifts"
)

func decodeObject(t *testing.T, raw json.RawMessage) map[string]any {
	t.Helper()
	var object map[string]any
	if err := json.Unmarshal(raw, &object); err != nil {
		t.Fatal(err)
	}
	return object
}

func (w world) snapshotRequests(t *testing.T) []map[string]any {
	t.Helper()
	var requests []map[string]any
	if err := json.Unmarshal(w.snapshot(t)["nurseRequests"], &requests); err != nil {
		t.Fatal(err)
	}
	return requests
}

func (w world) revisionText(t *testing.T) string {
	t.Helper()
	return w.f.text(t, "SELECT updated_at::text FROM public.active_shifts WHERE id = $1", w.shift)
}

func (w world) snapshotText(t *testing.T) string {
	t.Helper()
	return w.f.text(t, "SELECT shift_snapshot::text FROM public.active_shifts WHERE id = $1", w.shift)
}

// openJoinedChat is the nurse side of "open chat"; openNurseChat is the charge side.
func (w world) openJoinedChat(who Profile) (json.RawMessage, bool, error) {
	return w.f.store.OpenJoinedChat(contextForTest(), who.AuthUserID, who.ID)
}

func (w world) openNurseChat(who Profile, nurseID string) (json.RawMessage, bool, error) {
	return w.f.store.OpenShiftNurseChat(contextForTest(), who.AuthUserID, who.ID, w.shift, nurseID)
}

func (w world) sendChat(who Profile, requestID, body, mutationID string) (ThreadMessage, bool, error) {
	return w.f.store.AppendThreadMessage(contextForTest(), who.AuthUserID, who.ID, w.shift, requestID, body, mutationID)
}

func TestOpenChatIntegration(t *testing.T) {
	f := openAccessFixture(t)
	legacy := `[{"id":"old","type":"issue","status":"pending","requestingNurseId":"n1","message":"other","futureKey":true}]`

	t.Run("a joined nurse opens one chat and opening again writes nothing", func(t *testing.T) {
		w := newWorld(t, f, legacy)
		nina := w.joinNurse(t, "n1")
		raw, created, err := w.openJoinedChat(nina)
		if err != nil || !created {
			t.Fatalf("created=%v err=%v", created, err)
		}
		chat := decodeObject(t, raw)
		if chat["id"] != "nurse-chat-n1" || chat["type"] != "chat" || chat["requestingNurseId"] != "n1" ||
			chat["requestingNurseName"] != "Nina" || chat["createdAt"] == nil || chat["status"] != nil {
			t.Fatalf("%v", chat)
		}
		if got := len(w.snapshotRequests(t)); got != 2 {
			t.Fatalf("%d requests", got)
		}
		if w.requestByID(t, "old")["futureKey"] != true || string(w.snapshot(t)["futureField"]) != `{"keep": true}` {
			t.Fatal("unknown keys must survive")
		}
		revision := w.revisionText(t)
		again, created, err := w.openJoinedChat(nina)
		if err != nil || created || decodeObject(t, again)["createdAt"] != chat["createdAt"] {
			t.Fatalf("second open: created=%v err=%v %s", created, err, again)
		}
		if w.revisionText(t) != revision || len(w.snapshotRequests(t)) != 2 {
			t.Fatal("opening an existing chat must not write")
		}
	})

	t.Run("charge opens the same chat for a nurse", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		before := f.sideEffects(t, w.shift)
		raw, created, err := w.openNurseChat(w.charge, "n2")
		if err != nil || !created || decodeObject(t, raw)["id"] != "nurse-chat-n2" || decodeObject(t, raw)["requestingNurseName"] != "Omar" {
			t.Fatalf("created=%v err=%v %s", created, err, raw)
		}
		if effects := f.sideEffects(t, w.shift).minus(before); effects.realtime == 0 {
			t.Fatalf("a new chat must emit a realtime change: %+v", effects)
		}
		// The nurse opening later finds the chat charge started.
		omar := w.joinNurse(t, "n2")
		again, created, err := w.openJoinedChat(omar)
		if err != nil || created || decodeObject(t, again)["id"] != "nurse-chat-n2" {
			t.Fatalf("created=%v err=%v %s", created, err, again)
		}
		if _, created, err := w.openNurseChat(w.charge, "n2"); err != nil || created {
			t.Fatalf("charge reopening: created=%v err=%v", created, err)
		}
		if len(w.snapshotRequests(t)) != 1 {
			t.Fatal("exactly one chat expected")
		}
	})

	t.Run("a nurse who is not on the shift has no chat", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revisionText(t)
		if _, _, err := w.openNurseChat(w.charge, "ghost"); !errors.Is(err, ErrNurseNotOnShift) {
			t.Fatalf("got %v", err)
		}
		if w.revisionText(t) != revision || len(w.snapshotRequests(t)) != 0 {
			t.Fatal("a refused open must not write")
		}
	})

	t.Run("other callers are refused", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		stranger := f.newProfile(t, "Stranger")
		if _, _, err := w.openJoinedChat(stranger); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("stranger: %v", err)
		}
		if _, _, err := w.openJoinedChat(w.charge); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("owner opening as a nurse: %v", err)
		}
		if _, _, err := w.openNurseChat(stranger, "n1"); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("stranger opening for charge: %v", err)
		}
		if _, _, err := w.openNurseChat(nina, "n1"); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("a nurse opening as charge: %v", err)
		}
		f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", w.shift)
		if _, _, err := w.openNurseChat(w.charge, "n1"); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("ended shift, charge: %v", err)
		}
		if _, _, err := w.openJoinedChat(nina); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("ended shift, nurse: %v", err)
		}
		if len(w.snapshotRequests(t)) != 0 {
			t.Fatal("refused opens must not write")
		}
	})

	t.Run("concurrent opens create one chat", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		var wg sync.WaitGroup
		var mu sync.Mutex
		createdCount, errs := 0, []error{}
		open := func(do func() (json.RawMessage, bool, error)) {
			defer wg.Done()
			_, created, err := do()
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				errs = append(errs, err)
			}
			if created {
				createdCount++
			}
		}
		for i := 0; i < 3; i++ {
			wg.Add(2)
			go open(func() (json.RawMessage, bool, error) { return w.openJoinedChat(nina) })
			go open(func() (json.RawMessage, bool, error) { return w.openNurseChat(w.charge, "n1") })
		}
		wg.Wait()
		if len(errs) != 0 || createdCount != 1 || len(w.snapshotRequests(t)) != 1 {
			t.Fatalf("created=%d errs=%v requests=%d", createdCount, errs, len(w.snapshotRequests(t)))
		}
	})
}

func TestChatThreadIntegration(t *testing.T) {
	f := openAccessFixture(t)
	const chatID = "nurse-chat-n1"

	t.Run("outsiders cannot read or write the chat thread", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		w.joinNurse(t, "n1")
		omar := w.joinNurse(t, "n2")
		if _, _, err := w.openNurseChat(w.charge, "n1"); err != nil {
			t.Fatal(err)
		}
		stranger := f.newProfile(t, "Stranger")
		otherCharge := f.newProfile(t, "Other charge")
		for name, who := range map[string]Profile{"stranger": stranger, "another nurse": omar, "another charge nurse": otherCharge} {
			if _, err := f.store.ListThreadMessages(contextForTest(), who.AuthUserID, who.ID, w.shift, chatID); !errors.Is(err, ErrThreadNotFound) {
				t.Fatalf("%s list: %v", name, err)
			}
			if _, _, err := w.sendChat(who, chatID, "hello", ""); !errors.Is(err, ErrThreadNotFound) {
				t.Fatalf("%s send: %v", name, err)
			}
		}
		if f.count(t, "SELECT count(*) FROM public.nurse_request_messages WHERE shift_id = $1", w.shift) != 0 {
			t.Fatal("outsiders added messages")
		}
		if w.requestByID(t, chatID)["lastMessageAt"] != nil {
			t.Fatal("refused sends must not stamp")
		}
	})

	t.Run("the joined nurse and charge share one thread and each message stamps the chat", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		if _, _, err := w.openJoinedChat(nina); err != nil {
			t.Fatal(err)
		}
		before := f.sideEffects(t, w.shift)
		revision := w.revisionText(t)
		first, duplicate, err := w.sendChat(nina, chatID, "Can you cover room 4?", "m1")
		if err != nil || duplicate {
			t.Fatalf("dup=%v err=%v", duplicate, err)
		}
		chat := w.requestByID(t, chatID)
		if chat["lastMessageAt"] != shifts.FormatTime(first.CreatedAt) || chat["lastMessageAuthorProfileId"] != nina.ID || chat["lastMessagePreview"] != "Can you cover room 4?" {
			t.Fatalf("%v (message at %s)", chat, shifts.FormatTime(first.CreatedAt))
		}
		if w.revisionText(t) == revision {
			t.Fatal("the shift revision must advance")
		}
		if effects := f.sideEffects(t, w.shift).minus(before); effects.realtime == 0 {
			t.Fatalf("a chat message must emit a realtime change on the shift: %+v", effects)
		}

		second, _, err := w.sendChat(w.charge, chatID, "Yes, on my way", "")
		if err != nil {
			t.Fatal(err)
		}
		chat = w.requestByID(t, chatID)
		if chat["lastMessageAuthorProfileId"] != w.charge.ID || chat["lastMessagePreview"] != "Yes, on my way" || chat["lastMessageAt"] != shifts.FormatTime(second.CreatedAt) {
			t.Fatalf("%v", chat)
		}
		for _, reader := range []Profile{nina, w.charge} {
			messages, err := f.store.ListThreadMessages(contextForTest(), reader.AuthUserID, reader.ID, w.shift, chatID)
			if err != nil || len(messages) != 2 || messages[0].ID != first.ID || messages[1].ID != second.ID {
				t.Fatalf("list as %s: %+v err=%v", reader.ID, messages, err)
			}
		}
	})

	t.Run("the preview keeps the first 120 characters", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		if _, _, err := w.openJoinedChat(nina); err != nil {
			t.Fatal(err)
		}
		if _, _, err := w.sendChat(nina, chatID, strings.Repeat("é", 200), ""); err != nil {
			t.Fatal(err)
		}
		if got, _ := w.requestByID(t, chatID)["lastMessagePreview"].(string); got != strings.Repeat("é", 120) {
			t.Fatalf("preview has %d characters", len([]rune(got)))
		}
	})

	t.Run("a duplicate retry does not stamp again", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		if _, _, err := w.openJoinedChat(nina); err != nil {
			t.Fatal(err)
		}
		if _, _, err := w.sendChat(nina, chatID, "Hello", "retry-1"); err != nil {
			t.Fatal(err)
		}
		if _, _, err := w.sendChat(w.charge, chatID, "Reply", ""); err != nil {
			t.Fatal(err)
		}
		revision, snapshot := w.revisionText(t), w.snapshotText(t)
		if _, duplicate, err := w.sendChat(nina, chatID, "Hello", "retry-1"); err != nil || !duplicate {
			t.Fatalf("dup=%v err=%v", duplicate, err)
		}
		if w.revisionText(t) != revision || w.snapshotText(t) != snapshot {
			t.Fatal("a retry must not change the shift")
		}
		if w.requestByID(t, chatID)["lastMessageAuthorProfileId"] != w.charge.ID {
			t.Fatal("the retry must not make the old message the latest again")
		}
	})

	t.Run("concurrent senders in one chat all succeed", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		if _, _, err := w.openJoinedChat(nina); err != nil {
			t.Fatal(err)
		}
		var wg sync.WaitGroup
		errs := make([]error, 8)
		for i := range errs {
			wg.Add(1)
			go func() {
				defer wg.Done()
				sender := nina
				if i%2 == 1 {
					sender = w.charge
				}
				_, _, errs[i] = w.sendChat(sender, chatID, "message", "")
			}()
		}
		wg.Wait()
		for _, err := range errs {
			if err != nil {
				t.Fatal(err)
			}
		}
		if f.count(t, "SELECT count(*) FROM public.nurse_request_messages WHERE shift_id = $1", w.shift) != 8 {
			t.Fatal("every message must be saved")
		}
		if w.requestByID(t, chatID)["lastMessagePreview"] != "message" {
			t.Fatal("the chat must carry a stamp")
		}
	})

	t.Run("legacy issue and swap threads still work and are left untouched", func(t *testing.T) {
		legacy := `[{"id":"old","type":"issue","status":"pending","requestingNurseId":"n1","message":"m","futureKey":true},
			{"id":"old-swap","type":"swap","status":"pending","requestingNurseId":"n1","sourceBedId":"b1"}]`
		w := newWorld(t, f, legacy)
		nina := w.joinNurse(t, "n1")
		before, revision := w.snapshotText(t), w.revisionText(t)
		for _, id := range []string{"old", "old-swap"} {
			if _, _, err := w.sendChat(nina, id, "still talking", ""); err != nil {
				t.Fatal(id, err)
			}
			if _, _, err := w.sendChat(w.charge, id, "ok", ""); err != nil {
				t.Fatal(id, err)
			}
		}
		if w.snapshotText(t) != before || w.revisionText(t) != revision {
			t.Fatal("legacy threads must not stamp or touch the shift")
		}
		// Opening a chat next to them leaves them as they were.
		if _, created, err := w.openJoinedChat(nina); err != nil || !created {
			t.Fatalf("created=%v err=%v", created, err)
		}
		if w.requestByID(t, "old")["futureKey"] != true || w.requestByID(t, "old")["status"] != "pending" || len(w.snapshotRequests(t)) != 3 {
			t.Fatal("legacy entries must be unchanged")
		}
	})
}

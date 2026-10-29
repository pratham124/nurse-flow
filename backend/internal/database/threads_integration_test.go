package database

import (
	"encoding/json"
	"errors"
	"sync"
	"testing"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// threadFixture is a shift owned by Alpha whose request q1 was made by nurse n1,
// who is linked to Beta. Request q2 belongs to n2, who nobody has joined.
type threadFixture struct {
	*accessFixture
	shiftID string
}

func newThreadFixture(t *testing.T) *threadFixture {
	t.Helper()
	f := openAccessFixture(t)
	shiftID := f.stageShift(t, f.alpha.ID, accessSnapshot)
	f.exec(t, `INSERT INTO public.shift_nurse_access (shift_id, nurse_id, nurse_name, nurse_profile_id, status)
		VALUES ($1, 'n1', 'Nina', $2, 'linked')`, shiftID, f.beta.ID)
	return &threadFixture{accessFixture: f, shiftID: shiftID}
}

func (f *threadFixture) send(t *testing.T, as Profile, requestID, body, mutationID string) (ThreadMessage, bool, error) {
	t.Helper()
	return f.store.AppendThreadMessage(contextForTest(), as.AuthUserID, as.ID, f.shiftID, requestID, body, mutationID)
}

func (f *threadFixture) list(as Profile, requestID string) ([]ThreadMessage, error) {
	return f.store.ListThreadMessages(contextForTest(), as.AuthUserID, as.ID, f.shiftID, requestID)
}

func TestThreadOwnerAndJoinedNurseShareOneThread(t *testing.T) {
	f := newThreadFixture(t)
	// An empty thread is an empty slice, not nil, so the API sends [] for it.
	if empty, err := f.list(f.alpha, "q1"); err != nil || empty == nil || len(empty) != 0 {
		t.Fatalf("empty thread: %#v err=%v", empty, err)
	}
	first, duplicate, err := f.send(t, f.alpha, "q1", "From charge", "")
	if err != nil || duplicate || first.AuthorProfileID != f.alpha.ID || first.ClientMutationID != nil {
		t.Fatalf("owner send: %+v dup=%v err=%v", first, duplicate, err)
	}
	second, _, err := f.send(t, f.beta, " q1 ", "From nurse", "m-nurse")
	if err != nil || second.AuthorProfileID != f.beta.ID || second.RequestID != "q1" || second.ClientMutationID == nil || *second.ClientMutationID != "m-nurse" {
		t.Fatalf("nurse send: %+v err=%v", second, err)
	}
	for _, reader := range []Profile{f.alpha, f.beta} {
		messages, err := f.list(reader, "q1")
		if err != nil || len(messages) != 2 || messages[0].ID != first.ID || messages[1].ID != second.ID {
			t.Fatalf("list as %s: %+v err=%v", reader.ID, messages, err)
		}
	}
}

func TestThreadOutsidersAndMissingThreadsAreNotFound(t *testing.T) {
	f := newThreadFixture(t)
	stranger := f.newProfile(t, "Stranger")
	if _, _, err := f.send(t, f.alpha, "q1", "hello", ""); err != nil {
		t.Fatal(err)
	}
	for name, tt := range map[string]struct {
		as        Profile
		requestID string
	}{
		"unrelated profile":              {stranger, "q1"},
		"joined nurse of another slot":   {f.beta, "q2"},
		"unknown request":                {f.alpha, "nope"},
		"blank request":                  {f.alpha, "  "},
		"unrelated profile, other slot":  {stranger, "q2"},
		"charge owner, unknown request2": {f.alpha, "q9"},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := f.list(tt.as, tt.requestID); !errors.Is(err, ErrThreadNotFound) {
				t.Fatalf("list err = %v", err)
			}
			if _, _, err := f.send(t, tt.as, tt.requestID, "sneaky", ""); !errors.Is(err, ErrThreadNotFound) {
				t.Fatalf("send err = %v", err)
			}
		})
	}
	if n := f.count(t, "SELECT count(*) FROM public.nurse_request_messages WHERE shift_id = $1", f.shiftID); n != 1 {
		t.Fatalf("outsiders added rows: %d", n)
	}
}

// The Go code checks access first, so this bypasses it to prove that the
// database policies refuse the same writes on their own.
func TestThreadRowLevelSecurityBacksTheGoCheck(t *testing.T) {
	f := newThreadFixture(t)
	stranger := f.newProfile(t, "Stranger")
	if _, _, err := f.send(t, f.alpha, "q1", "hello", ""); err != nil {
		t.Fatal(err)
	}
	insert := func(as Profile, authorID, requestID string) error {
		return f.store.WithWriteIdentity(contextForTest(), as.AuthUserID, func(tx *gorm.DB) error {
			return tx.Exec(`INSERT INTO public.nurse_request_messages (shift_id, request_id, author_profile_id, body)
				VALUES (?, ?, ?, 'direct')`, f.shiftID, requestID, authorID).Error
		})
	}
	if err := insert(stranger, stranger.ID, "q1"); err == nil {
		t.Fatal("an outsider inserted directly")
	}
	if err := insert(f.beta, f.beta.ID, "q2"); err == nil {
		t.Fatal("a joined nurse inserted into another nurse's thread")
	}
	if err := insert(f.beta, f.alpha.ID, "q1"); err == nil {
		t.Fatal("a participant inserted as another author")
	}
	if err := insert(f.beta, f.beta.ID, "q1"); err != nil {
		t.Fatalf("a participant could not insert: %v", err)
	}
	var visible int64
	err := f.store.WithIdentity(contextForTest(), stranger.AuthUserID, func(tx *gorm.DB) error {
		return tx.Model(&ThreadMessage{}).Where("shift_id = ?", f.shiftID).Count(&visible).Error
	})
	if err != nil || visible != 0 {
		t.Fatalf("an outsider can read %d rows, err=%v", visible, err)
	}
}

func TestThreadEndedShiftIsNotFound(t *testing.T) {
	f := newThreadFixture(t)
	if _, _, err := f.send(t, f.alpha, "q1", "before", ""); err != nil {
		t.Fatal(err)
	}
	f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", f.shiftID)
	for _, as := range []Profile{f.alpha, f.beta} {
		if _, err := f.list(as, "q1"); !errors.Is(err, ErrThreadNotFound) {
			t.Fatalf("list err = %v", err)
		}
		if _, _, err := f.send(t, as, "q1", "after", ""); !errors.Is(err, ErrThreadNotFound) {
			t.Fatalf("send err = %v", err)
		}
	}
}

func TestThreadMessagesAreOrderedByCreatedAtThenID(t *testing.T) {
	f := newThreadFixture(t)
	// Same timestamp, so the id breaks the tie; one older row sorts first.
	ids := []string{"00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000001"}
	f.exec(t, `INSERT INTO public.nurse_request_messages (id, shift_id, request_id, author_profile_id, body, created_at)
		VALUES ($1, $3, 'q1', $4, 'tie b', '2026-01-02T00:00:00Z'),
		       ($2, $3, 'q1', $4, 'tie a', '2026-01-02T00:00:00Z'),
		       ($5, $3, 'q1', $4, 'oldest', '2026-01-01T00:00:00Z')`,
		ids[0], ids[1], f.shiftID, f.alpha.ID, uuid.NewString())
	messages, err := f.list(f.alpha, "q1")
	if err != nil || len(messages) != 3 {
		t.Fatalf("%+v %v", messages, err)
	}
	if got := messages[0].Body + "," + messages[1].Body + "," + messages[2].Body; got != "oldest,tie a,tie b" {
		t.Fatalf("order = %s", got)
	}
}

func TestThreadRetriesAreIdempotent(t *testing.T) {
	f := newThreadFixture(t)
	first, duplicate, err := f.send(t, f.alpha, "q1", "hello", "retry-1")
	if err != nil || duplicate {
		t.Fatalf("first: dup=%v err=%v", duplicate, err)
	}
	again, duplicate, err := f.send(t, f.alpha, "q1", "hello", "retry-1")
	if err != nil || !duplicate || again.ID != first.ID {
		t.Fatalf("repeat: %+v dup=%v err=%v", again, duplicate, err)
	}
	if _, _, err := f.send(t, f.alpha, "q1", "different", "retry-1"); !errors.Is(err, ErrMutationIDReused) {
		t.Fatalf("different body err = %v", err)
	}
	// The same identifier on another request of the same shift is also a reuse.
	if _, _, err := f.send(t, f.alpha, "q2", "hello", "retry-1"); !errors.Is(err, ErrMutationIDReused) {
		t.Fatalf("different request err = %v", err)
	}
	// Identifiers belong to one author: the nurse may use the same text.
	other, duplicate, err := f.send(t, f.beta, "q1", "hello", "retry-1")
	if err != nil || duplicate || other.ID == first.ID {
		t.Fatalf("other author: %+v dup=%v err=%v", other, duplicate, err)
	}
	if n := f.count(t, "SELECT count(*) FROM public.nurse_request_messages WHERE shift_id = $1", f.shiftID); n != 2 {
		t.Fatalf("rows = %d, want 2", n)
	}
}

func TestThreadWithoutMutationIDStoresEveryMessage(t *testing.T) {
	f := newThreadFixture(t)
	for i := 0; i < 2; i++ {
		if _, duplicate, err := f.send(t, f.alpha, "q1", "same text", ""); err != nil || duplicate {
			t.Fatalf("send %d: dup=%v err=%v", i, duplicate, err)
		}
	}
	if n := f.count(t, "SELECT count(*) FROM public.nurse_request_messages WHERE shift_id = $1", f.shiftID); n != 2 {
		t.Fatalf("rows = %d, want 2", n)
	}
}

func TestThreadConcurrentRetriesSaveOnce(t *testing.T) {
	f := newThreadFixture(t)
	const senders = 6
	type outcome struct {
		message   ThreadMessage
		duplicate bool
		err       error
	}
	results := make([]outcome, senders)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := range results {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			message, duplicate, err := f.send(t, f.alpha, "q1", "racing", "race-1")
			results[i] = outcome{message, duplicate, err}
		}()
	}
	close(start)
	wg.Wait()
	saved := 0
	for _, result := range results {
		if result.err != nil || result.message.ID != results[0].message.ID {
			t.Fatalf("unexpected result: %+v", result)
		}
		if !result.duplicate {
			saved++
		}
	}
	if saved != 1 {
		t.Fatalf("%d sends reported saved, want 1", saved)
	}
	if n := f.count(t, "SELECT count(*) FROM public.nurse_request_messages WHERE shift_id = $1", f.shiftID); n != 1 {
		t.Fatalf("rows = %d, want 1", n)
	}
}

func TestThreadInsertTriggersStillFire(t *testing.T) {
	f := newThreadFixture(t)
	before := f.count(t, "SELECT count(*) FROM realtime.messages WHERE event = 'request-message-inserted'")
	message, _, err := f.send(t, f.beta, "q1", "ping", "")
	if err != nil {
		t.Fatal(err)
	}
	if after := f.count(t, "SELECT count(*) FROM realtime.messages WHERE event = 'request-message-inserted'"); after != before+1 {
		t.Fatalf("broadcast rows %d -> %d", before, after)
	}
	// The row's own broadcast payload should name it.
	if n := f.count(t, "SELECT count(*) FROM realtime.messages WHERE event = 'request-message-inserted' AND payload::text LIKE '%' || $1 || '%'", message.ID); n == 0 {
		t.Log("broadcast payload does not mention the message id (informational)")
	}
}

func TestThreadListMatchesRetainedSQLFunction(t *testing.T) {
	f := newThreadFixture(t)
	for _, step := range []struct {
		as   Profile
		body string
		id   string
	}{{f.alpha, "one", ""}, {f.beta, "two", "m-2"}, {f.alpha, "three", "m-3"}} {
		if _, _, err := f.send(t, step.as, "q1", step.body, step.id); err != nil {
			t.Fatal(err)
		}
	}
	for _, reader := range []Profile{f.alpha, f.beta} {
		messages, err := f.list(reader, "q1")
		if err != nil {
			t.Fatal(err)
		}
		goJSON, err := json.Marshal(messages)
		if err != nil {
			t.Fatal(err)
		}
		sqlJSON := f.rpcAs(t, reader.AuthUserID, "SELECT public.list_nurse_request_messages($1::uuid, 'q1')::text", f.shiftID)
		var want, got []map[string]any
		if err := json.Unmarshal([]byte(sqlJSON), &want); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(goJSON, &got); err != nil {
			t.Fatal(err)
		}
		if len(want) != 3 || len(got) != 3 {
			t.Fatalf("lengths: sql=%d go=%d", len(want), len(got))
		}
		for i := range want {
			for _, key := range []string{"id", "shiftId", "requestId", "authorProfileId", "body", "clientMutationId"} {
				if want[i][key] != got[i][key] {
					t.Fatalf("message %d %s: sql=%v go=%v", i, key, want[i][key], got[i][key])
				}
			}
		}
	}
}

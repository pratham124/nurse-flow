package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/database"
)

// threadStoreStub records what the handler passes and returns canned results.
type threadStoreStub struct {
	err       error
	duplicate bool
	calls     int
	authID    string
	profileID string
	requestID string
	body      string
	mutation  string
}

func (s *threadStoreStub) ListThreadMessages(_ context.Context, authID, profileID, _, requestID string) ([]database.ThreadMessage, error) {
	s.calls++
	s.authID, s.profileID, s.requestID = authID, profileID, requestID
	// Like the real store, an empty thread is an empty slice, not nil.
	return []database.ThreadMessage{}, s.err
}

func (s *threadStoreStub) AppendThreadMessage(_ context.Context, authID, profileID, shiftID, requestID, body, mutation string) (database.ThreadMessage, bool, error) {
	s.calls++
	s.authID, s.profileID, s.requestID, s.body, s.mutation = authID, profileID, requestID, body, mutation
	return database.ThreadMessage{ID: "m1", ShiftID: shiftID, RequestID: requestID, AuthorProfileID: profileID, Body: body}, s.duplicate, s.err
}

func TestThreadRoutes(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	path := "/shifts/" + testTemplateID + "/requests/q1/messages"
	send := func(store *threadStoreStub, method, target, body string, authorized bool) *httptest.ResponseRecorder {
		mux := http.NewServeMux()
		registerThreadRoutes(mux, verifier, profileLookup{profile: accessProfile}, store)
		request := httptest.NewRequest(method, target, strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		if authorized {
			request.Header.Set("Authorization", "Bearer "+sign(accessAuthUserID, time.Now().Add(time.Hour)))
		}
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, request)
		return response
	}
	for _, tt := range []struct {
		name, method, target, body string
		store                      *threadStoreStub
		want, wantCalls            int
		contains                   string
	}{
		{"list", "GET", path, "", &threadStoreStub{}, 200, 1, `{"messages":[]}`},
		{"list not found", "GET", path, "", &threadStoreStub{err: database.ErrThreadNotFound}, 404, 1, `"code":"thread_not_found"`},
		{"list database error", "GET", path, "", &threadStoreStub{err: errors.New("private")}, 503, 1, `"code":"database_unavailable"`},
		{"list bad shift id", "GET", "/shifts/local/requests/q1/messages", "", &threadStoreStub{}, 400, 0, `"code":"invalid_id"`},
		{"send saved", "POST", path, `{"body":"  hello ","client_mutation_id":" m-1 "}`, &threadStoreStub{}, 201, 1, `"status":"saved"`},
		{"send duplicate", "POST", path, `{"body":"hello","client_mutation_id":"m-1"}`, &threadStoreStub{duplicate: true}, 200, 1, `"status":"duplicate"`},
		{"send reused id", "POST", path, `{"body":"hello","client_mutation_id":"m-1"}`, &threadStoreStub{err: database.ErrMutationIDReused}, 409, 1, `"code":"mutation_id_reused"`},
		{"send not found", "POST", path, `{"body":"hello"}`, &threadStoreStub{err: database.ErrThreadNotFound}, 404, 1, `"code":"thread_not_found"`},
		{"send database error", "POST", path, `{"body":"hello"}`, &threadStoreStub{err: errors.New("private")}, 503, 1, `"code":"database_unavailable"`},
		{"blank body", "POST", path, `{"body":"  "}`, &threadStoreStub{}, 422, 0, "Write a message before sending."},
		{"missing body", "POST", path, `{}`, &threadStoreStub{}, 422, 0, "Write a message before sending."},
		{"long body", "POST", path, `{"body":"` + strings.Repeat("a", 1001) + `"}`, &threadStoreStub{}, 422, 0, "Keep messages to 1000 characters or fewer."},
		{"long mutation id", "POST", path, `{"body":"hi","client_mutation_id":"` + strings.Repeat("m", 121) + `"}`, &threadStoreStub{}, 422, 0, "Message retry identifiers must be 120 characters or fewer."},
		{"client identity fields are refused", "POST", path, `{"body":"hi","author_profile_id":"x","shift_id":"y"}`, &threadStoreStub{}, 400, 0, `"code":"invalid_request"`},
		{"null body", "POST", path, `null`, &threadStoreStub{}, 400, 0, `"code":"invalid_request"`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			response := send(tt.store, tt.method, tt.target, tt.body, true)
			if response.Code != tt.want || tt.store.calls != tt.wantCalls {
				t.Fatalf("status=%d calls=%d body=%s", response.Code, tt.store.calls, response.Body.String())
			}
			if !strings.Contains(response.Body.String(), tt.contains) {
				t.Fatalf("want %q in %s", tt.contains, response.Body.String())
			}
			if strings.Contains(response.Body.String(), "private") {
				t.Fatal("internal details leaked")
			}
		})
	}
	t.Run("author and cleaned input come from the token and server", func(t *testing.T) {
		store := &threadStoreStub{}
		response := send(store, "POST", path, `{"body":"  hello ","client_mutation_id":" m-1 "}`, true)
		if response.Code != 201 || store.authID != accessAuthUserID || store.profileID != accessProfile.ID ||
			store.requestID != "q1" || store.body != "hello" || store.mutation != "m-1" {
			t.Fatalf("status=%d store=%+v", response.Code, store)
		}
		if !strings.Contains(response.Body.String(), `"authorProfileId":"`+accessProfile.ID+`"`) || !strings.Contains(response.Body.String(), `"clientMutationId":null`) {
			t.Fatal(response.Body.String())
		}
	})
	t.Run("requires authentication", func(t *testing.T) {
		for _, method := range []string{"GET", "POST"} {
			store := &threadStoreStub{}
			if response := send(store, method, path, `{"body":"hi"}`, false); response.Code != 401 || store.calls != 0 {
				t.Fatalf("%s status=%d calls=%d", method, response.Code, store.calls)
			}
		}
	})
}

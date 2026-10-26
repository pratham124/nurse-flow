package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/invites"
)

// accessStoreStub records the calls a handler makes and returns canned results.
type accessStoreStub struct {
	err        error
	ensureName string
	calls      []string
	tokenHash  string
	regenerate bool
	nurseID    string
	validation database.InviteValidation
	join       database.InviteJoin
	joined     *database.JoinedAssignment
}

func (s *accessStoreStub) EnsureProfile(_ context.Context, authUserID, displayName string) (database.Profile, error) {
	s.calls = append(s.calls, "ensure")
	s.ensureName = displayName
	return database.Profile{ID: "10000000-0000-0000-0000-000000000009", AuthUserID: authUserID, DisplayName: displayName, Role: "charge_nurse"}, s.err
}
func (s *accessStoreStub) ListInvites(context.Context, string, string, string) (database.InviteList, error) {
	s.calls = append(s.calls, "list")
	return database.InviteList{Invites: []database.InviteRow{}, Access: []database.AccessRow{}}, s.err
}
func (s *accessStoreStub) CreateInvite(_ context.Context, _, _, _, nurseID, tokenHash string) (database.InviteRow, error) {
	s.calls = append(s.calls, "create")
	s.nurseID, s.tokenHash = nurseID, tokenHash
	return database.InviteRow{ID: "invite-1", NurseID: nurseID, Status: "active"}, s.err
}
func (s *accessStoreStub) RegenerateInvite(_ context.Context, _, _, _, nurseID, tokenHash string) (database.InviteRow, error) {
	s.calls = append(s.calls, "create")
	s.nurseID, s.tokenHash, s.regenerate = nurseID, tokenHash, true
	return database.InviteRow{ID: "invite-1", NurseID: nurseID, Status: "active"}, s.err
}
func (s *accessStoreStub) ValidateInvite(_ context.Context, _, _, tokenHash string) (database.InviteValidation, error) {
	s.calls = append(s.calls, "validate")
	s.tokenHash = tokenHash
	return s.validation, s.err
}
func (s *accessStoreStub) AcceptInvite(_ context.Context, _, _, tokenHash string) (database.InviteJoin, error) {
	s.calls = append(s.calls, "accept")
	s.tokenHash = tokenHash
	return s.join, s.err
}
func (s *accessStoreStub) JoinedWorkspace(context.Context, string, string) (*database.JoinedAssignment, error) {
	s.calls = append(s.calls, "joined")
	return s.joined, s.err
}

type profileLookup struct {
	profile database.Profile
	err     error
}

func (p profileLookup) ProfileByAuthUserID(context.Context, string) (database.Profile, error) {
	return p.profile, p.err
}

const accessAuthUserID = "20000000-0000-0000-0000-000000000001"

var accessProfile = database.Profile{ID: "10000000-0000-0000-0000-000000000001", AuthUserID: accessAuthUserID, DisplayName: "Charge Alpha", Role: "charge_nurse"}

func TestProfileRoutes(t *testing.T) {
	verifier, sign := testDiagnosticVerifierWithClaims(t)
	token := func(extra jwt.MapClaims) string { return sign(accessAuthUserID, time.Now().Add(time.Hour), extra) }
	for _, tt := range []struct {
		name, method, body string
		lookup             profileLookup
		extra              jwt.MapClaims
		want               int
		code, wantName     string
	}{
		{"get existing", "GET", "", profileLookup{profile: accessProfile}, nil, 200, "", ""},
		{"get missing", "GET", "", profileLookup{err: database.ErrProfileNotFound}, nil, 404, "profile_missing", ""},
		{"get database down", "GET", "", profileLookup{err: errors.New("private password SQL")}, nil, 503, "database_unavailable", ""},
		{"get rejects a body", "GET", `{"role":"x"}`, profileLookup{profile: accessProfile}, nil, 400, "invalid_profile", ""},
		{"put uses metadata name", "PUT", "", profileLookup{}, jwt.MapClaims{"email": "a@example.com", "user_metadata": map[string]any{"display_name": " Pat "}}, 200, "", "Pat"},
		{"put falls back to email", "PUT", "", profileLookup{}, jwt.MapClaims{"email": "a@example.com"}, 200, "", "a@example.com"},
		{"put falls back to default", "PUT", "", profileLookup{}, nil, 200, "", "NurseFlow user"},
		{"put never trusts a body", "PUT", `{"display_name":"Boss","role":"regular_nurse"}`, profileLookup{}, nil, 400, "invalid_profile", ""},
		{"put rejects a one-byte body", "PUT", "x", profileLookup{}, nil, 400, "invalid_profile", ""},
		{"put does not need an existing profile", "PUT", "", profileLookup{err: database.ErrProfileNotFound}, nil, 200, "", "NurseFlow user"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			store := &accessStoreStub{}
			request := httptest.NewRequest(tt.method, "/profile?role=regular_nurse", strings.NewReader(tt.body))
			request.Header.Set("Authorization", "Bearer "+token(tt.extra))
			response := httptest.NewRecorder()
			NewHandler(verifier, tt.lookup, nil, nil, store, store, store, nil, nil, nil).ServeHTTP(response, request)
			if response.Code != tt.want {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			if tt.code != "" && !strings.Contains(response.Body.String(), `"code":"`+tt.code+`"`) {
				t.Fatal(response.Body.String())
			}
			if strings.Contains(response.Body.String(), "private") {
				t.Fatal("internal details leaked")
			}
			if tt.wantName != "" {
				var body struct {
					Profile database.Profile `json:"profile"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				if store.ensureName != tt.wantName || body.Profile.Role != "charge_nurse" || body.Profile.AuthUserID != accessAuthUserID {
					t.Fatalf("ensure name = %q, body = %s", store.ensureName, response.Body.String())
				}
			}
		})
	}
	t.Run("profile routes require authentication", func(t *testing.T) {
		for _, method := range []string{"GET", "PUT"} {
			response := httptest.NewRecorder()
			NewHandler(verifier, profileLookup{}, nil, nil, &accessStoreStub{}, &accessStoreStub{}, &accessStoreStub{}, nil, nil, nil).ServeHTTP(response, httptest.NewRequest(method, "/profile", nil))
			if response.Code != 401 {
				t.Fatalf("%s status=%d", method, response.Code)
			}
		}
	})
	t.Run("put database failure", func(t *testing.T) {
		response := httptest.NewRecorder()
		request := httptest.NewRequest("PUT", "/profile", nil)
		request.Header.Set("Authorization", "Bearer "+token(nil))
		NewHandler(verifier, profileLookup{}, nil, nil, &accessStoreStub{err: errors.New("private")}, nil, nil, nil, nil, nil).ServeHTTP(response, request)
		if response.Code != 503 || strings.Contains(response.Body.String(), "private") {
			t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
		}
	})
}

func TestInviteRoutes(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	shiftID := testTemplateID
	for _, tt := range []struct {
		name, method, path, body string
		storeErr                 error
		want                     int
		code                     string
		wantCalls                int
		regenerate               bool
	}{
		{"list", "GET", "/shifts/" + shiftID + "/invites", "", nil, 200, "", 1, false},
		{"list foreign shift", "GET", "/shifts/" + shiftID + "/invites", "", database.ErrShiftNotFound, 404, "shift_not_found", 1, false},
		{"generate", "POST", "/shifts/" + shiftID + "/invites", `{"nurse_id":"n1"}`, nil, 201, "", 1, false},
		{"regenerate", "POST", "/shifts/" + shiftID + "/invites/regenerate", `{"nurse_id":"n1"}`, nil, 201, "", 1, true},
		{"generate foreign shift", "POST", "/shifts/" + shiftID + "/invites", `{"nurse_id":"n1"}`, database.ErrShiftNotFound, 404, "shift_not_found", 1, false},
		{"ended shift", "POST", "/shifts/" + shiftID + "/invites", `{"nurse_id":"n1"}`, database.ErrShiftEnded, 409, "shift_ended", 1, false},
		{"nurse not on shift", "POST", "/shifts/" + shiftID + "/invites", `{"nurse_id":"n1"}`, database.ErrNurseNotOnShift, 422, "nurse_not_on_shift", 1, false},
		{"nurse unassigned", "POST", "/shifts/" + shiftID + "/invites", `{"nurse_id":"n1"}`, database.ErrNurseUnassigned, 422, "nurse_unassigned", 1, false},
		{"invite exists", "POST", "/shifts/" + shiftID + "/invites", `{"nurse_id":"n1"}`, database.ErrInviteExists, 409, "invite_exists", 1, false},
		{"database error", "POST", "/shifts/" + shiftID + "/invites", `{"nurse_id":"n1"}`, errors.New("private password SQL"), 503, "database_unavailable", 1, false},
		{"bad shift ID", "POST", "/shifts/local/invites", `{"nurse_id":"n1"}`, nil, 400, "invalid_id", 0, false},
		{"missing nurse", "POST", "/shifts/" + shiftID + "/invites", `{}`, nil, 400, "invalid_invite", 0, false},
		{"forged fields", "POST", "/shifts/" + shiftID + "/invites", `{"nurse_id":"n1","token_hash":"x","created_by_profile_id":"y"}`, nil, 400, "invalid_invite", 0, false},
		{"null body", "POST", "/shifts/" + shiftID + "/invites", `null`, nil, 400, "invalid_invite", 0, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			store := &accessStoreStub{err: tt.storeErr}
			request := httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+sign(accessAuthUserID, time.Now().Add(time.Hour)))
			response := httptest.NewRecorder()
			NewHandler(verifier, profileLookup{profile: accessProfile}, nil, nil, store, store, store, nil, nil, nil).ServeHTTP(response, request)
			if response.Code != tt.want || len(store.calls) != tt.wantCalls {
				t.Fatalf("status=%d calls=%v body=%s", response.Code, store.calls, response.Body.String())
			}
			if tt.code != "" && !strings.Contains(response.Body.String(), `"code":"`+tt.code+`"`) {
				t.Fatal(response.Body.String())
			}
			if strings.Contains(response.Body.String(), "private") {
				t.Fatal("internal details leaked")
			}
			if tt.want != 201 {
				return
			}
			if response.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("a response carrying a code must not be cacheable")
			}
			var body struct {
				Code   string             `json:"code"`
				Invite database.InviteRow `json:"invite"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if !invites.ValidCode(body.Code) || store.tokenHash != invites.HashCode(body.Code) || store.regenerate != tt.regenerate || store.nurseID != "n1" {
				t.Fatalf("code=%q hash=%q regenerate=%v nurse=%q", body.Code, store.tokenHash, store.regenerate, store.nurseID)
			}
			if strings.Contains(response.Body.String(), store.tokenHash) || strings.Contains(response.Body.String(), "token_hash") {
				t.Fatal("token hash must never be returned")
			}
		})
	}
	t.Run("rejects non-JSON media type", func(t *testing.T) {
		request := httptest.NewRequest("POST", "/shifts/"+shiftID+"/invites", strings.NewReader(`{"nurse_id":"n1"}`))
		request.Header.Set("Content-Type", "text/plain")
		request.Header.Set("Authorization", "Bearer "+sign(accessAuthUserID, time.Now().Add(time.Hour)))
		response := httptest.NewRecorder()
		NewHandler(verifier, profileLookup{profile: accessProfile}, nil, nil, &accessStoreStub{}, &accessStoreStub{}, &accessStoreStub{}, nil, nil, nil).ServeHTTP(response, request)
		if response.Code != http.StatusUnsupportedMediaType {
			t.Fatalf("status=%d", response.Code)
		}
	})
}

func TestJoiningRoutes(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	for _, route := range []string{"/invites/validate", "/invites/accept"} {
		for _, tt := range []struct {
			name, body    string
			storeErr      error
			want          int
			wantCalls     int
			wantHash      string
			wantReason    string
			wantNoStore   bool
			wantErrorCode string
		}{
			{name: "typed with spaces and lowercase", body: `{"code":" k7q-x2m "}`, want: 200, wantCalls: 1, wantHash: invites.HashCode("K7QX2M"), wantNoStore: true},
			{name: "too short is a domain outcome", body: `{"code":"K7QX2"}`, want: 200, wantReason: "invalid_format", wantNoStore: true},
			{name: "wrong characters", body: `{"code":"K7QX2I"}`, want: 200, wantReason: "invalid_format", wantNoStore: true},
			{name: "missing code", body: `{}`, want: 200, wantReason: "invalid_format", wantNoStore: true},
			{name: "database error", body: `{"code":"K7QX2M"}`, storeErr: errors.New("private"), want: 503, wantCalls: 1, wantErrorCode: "database_unavailable"},
			{name: "unknown field", body: `{"code":"K7QX2M","profile_id":"x"}`, want: 400, wantErrorCode: "invalid_invite"},
		} {
			t.Run(route+" "+tt.name, func(t *testing.T) {
				store := &accessStoreStub{err: tt.storeErr, validation: database.InviteValidation{Status: "valid"}, join: database.InviteJoin{Status: "joined"}}
				request := httptest.NewRequest("POST", route, strings.NewReader(tt.body))
				request.Header.Set("Content-Type", "application/json")
				request.Header.Set("Authorization", "Bearer "+sign(accessAuthUserID, time.Now().Add(time.Hour)))
				response := httptest.NewRecorder()
				NewHandler(verifier, profileLookup{profile: accessProfile}, nil, nil, store, store, store, nil, nil, nil).ServeHTTP(response, request)
				if response.Code != tt.want || len(store.calls) != tt.wantCalls {
					t.Fatalf("status=%d calls=%v body=%s", response.Code, store.calls, response.Body.String())
				}
				if tt.wantHash != "" && store.tokenHash != tt.wantHash {
					t.Fatalf("hash = %q, want %q", store.tokenHash, tt.wantHash)
				}
				if tt.wantReason != "" && !strings.Contains(response.Body.String(), `"status":"blocked","reason":"`+tt.wantReason+`"`) {
					t.Fatal(response.Body.String())
				}
				if tt.wantErrorCode != "" && !strings.Contains(response.Body.String(), `"code":"`+tt.wantErrorCode+`"`) {
					t.Fatal(response.Body.String())
				}
				if tt.wantNoStore && response.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("join responses must not be cacheable")
				}
				if strings.Contains(response.Body.String(), "private") || strings.Contains(response.Body.String(), "K7QX2M") {
					t.Fatal("response leaked internal details or the code")
				}
			})
		}
	}
	t.Run("regular nurse profile is refused before any database call", func(t *testing.T) {
		store := &accessStoreStub{}
		regular := accessProfile
		regular.Role = "regular_nurse"
		request := httptest.NewRequest("POST", "/invites/accept", strings.NewReader(`{"code":"K7QX2M"}`))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+sign(accessAuthUserID, time.Now().Add(time.Hour)))
		response := httptest.NewRecorder()
		NewHandler(verifier, profileLookup{profile: regular}, nil, nil, store, store, store, nil, nil, nil).ServeHTTP(response, request)
		if response.Code != 403 || len(store.calls) != 0 {
			t.Fatalf("status=%d calls=%v", response.Code, store.calls)
		}
	})
}

func TestJoinedWorkspaceRoute(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	get := func(store *accessStoreStub) *httptest.ResponseRecorder {
		request := httptest.NewRequest("GET", "/joined-workspace", nil)
		request.Header.Set("Authorization", "Bearer "+sign(accessAuthUserID, time.Now().Add(time.Hour)))
		response := httptest.NewRecorder()
		NewHandler(verifier, profileLookup{profile: accessProfile}, nil, nil, store, store, store, nil, nil, nil).ServeHTTP(response, request)
		return response
	}
	if response := get(&accessStoreStub{}); response.Code != 200 || strings.TrimSpace(response.Body.String()) != `{"assignment":null}` {
		t.Fatalf("empty workspace: %d %s", response.Code, response.Body.String())
	}
	assignment := &database.JoinedAssignment{ShiftID: "s1", FloorName: "4 West", NurseName: "Nina", AssignedBeds: nil, RequestHistory: nil}
	response := get(&accessStoreStub{joined: assignment})
	for _, want := range []string{`"assignment":{"access":`, `"shiftId":"s1"`, `"floorName":"4 West"`, `"assignedBeds"`, `"requestHistory"`} {
		if !strings.Contains(response.Body.String(), want) {
			t.Fatalf("missing %s in %s", want, response.Body.String())
		}
	}
	if response := get(&accessStoreStub{err: errors.New("private")}); response.Code != 503 || strings.Contains(response.Body.String(), "private") {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
}

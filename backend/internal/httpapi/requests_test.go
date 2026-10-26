package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
)

// requestStoreStub records what reached the database layer.
type requestStoreStub struct {
	err     error
	outcome database.MoveOutcome
	calls   []string
	args    []string
	move    shifts.MoveRequest
}

func (s *requestStoreStub) record(call string, args ...string) {
	s.calls = append(s.calls, call)
	s.args = args
}

func (s *requestStoreStub) MoveAssignment(_ context.Context, authID, profileID, shiftID string, request shifts.MoveRequest) (database.MoveOutcome, error) {
	s.record("move", authID, profileID, shiftID)
	s.move = request
	return s.outcome, s.err
}
func (s *requestStoreStub) SubmitIssueRequest(_ context.Context, authID, profileID, message string) (json.RawMessage, error) {
	s.record("issue", authID, profileID, message)
	return json.RawMessage(`{"id":"nurse-request-1","type":"issue","futureKey":true}`), s.err
}
func (s *requestStoreStub) SubmitSwapRequest(_ context.Context, authID, profileID, bed, message string) (json.RawMessage, error) {
	s.record("swap", authID, profileID, bed, message)
	return json.RawMessage(`{"id":"nurse-request-2","type":"swap"}`), s.err
}
func (s *requestStoreStub) UpdateIssueStatus(_ context.Context, authID, profileID, shiftID, requestID, status string) (json.RawMessage, error) {
	s.record("issue-status", authID, profileID, shiftID, requestID, status)
	return json.RawMessage(`{"id":"q1"}`), s.err
}
func (s *requestStoreStub) ResolveSwapRequest(_ context.Context, authID, profileID, shiftID, requestID, status string) (json.RawMessage, error) {
	s.record("swap-resolution", authID, profileID, shiftID, requestID, status)
	return json.RawMessage(`{"id":"q2"}`), s.err
}

const validMoveBody = `{"baseline_assignment_result_id":"res1","bed_id":"b1","from_nurse_id":"n1","to_nurse_id":"n2","warning_acknowledgements":[],"related_swap_request_id":null,"client_mutation_id":"m1"}`

func TestRequestRoutes(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	shiftID := "40000000-0000-4000-8000-000000000001"
	moves := "/shifts/" + shiftID + "/assignment-moves"
	issueStatus := "/shifts/" + shiftID + "/requests/q1/issue-status"
	resolution := "/shifts/" + shiftID + "/requests/q2/swap-resolution"
	rule := func(code, message string) error { return &shifts.RuleError{Code: code, Message: message} }
	for _, tt := range []struct {
		name, path, body string
		storeErr         error
		want             int
		code             string
		wantCalls        int
	}{
		{"move saved", moves, validMoveBody, nil, 200, "", 1},
		{"move rule", moves, validMoveBody, rule("invalid_move", "Only an occupied bed can be moved."), 422, "invalid_move", 1},
		{"move foreign shift", moves, validMoveBody, database.ErrShiftNotFound, 404, "shift_not_found", 1},
		{"move not assigned", moves, validMoveBody, database.ErrShiftNotAssigned, 409, "shift_not_assigned", 1},
		{"move conflict", moves, validMoveBody, database.ErrMoveConflict, 409, "move_conflict", 1},
		{"move database error", moves, validMoveBody, errors.New("private password SQL"), 503, "database_unavailable", 1},
		{"move blank bed", moves, strings.Replace(validMoveBody, `"bed_id":"b1"`, `"bed_id":""`, 1), nil, 422, "invalid_move", 0},
		{"move acknowledgements not an array", moves, strings.Replace(validMoveBody, `"warning_acknowledgements":[]`, `"warning_acknowledgements":{}`, 1), nil, 422, "invalid_move", 0},
		{"move forged identity", moves, strings.Replace(validMoveBody, `"client_mutation_id":"m1"`, `"client_mutation_id":"m1","created_by_profile_id":"other"`, 1), nil, 400, "invalid_request", 0},
		{"move bad shift ID", "/shifts/local/assignment-moves", validMoveBody, nil, 400, "invalid_id", 0},
		{"issue submitted", "/joined-workspace/issue-requests", `{"message":"Need help"}`, nil, 201, "", 1},
		{"issue blank", "/joined-workspace/issue-requests", `{"message":"  "}`, nil, 422, "invalid_request", 0},
		{"issue not joined", "/joined-workspace/issue-requests", `{"message":"x"}`, database.ErrNotJoined, 409, "not_joined", 1},
		{"issue ended", "/joined-workspace/issue-requests", `{"message":"x"}`, database.ErrShiftEnded, 409, "shift_ended", 1},
		{"issue pending", "/joined-workspace/issue-requests", `{"message":"x"}`, rule("request_pending", "This issue is already pending."), 409, "request_pending", 1},
		{"issue forged nurse", "/joined-workspace/issue-requests", `{"message":"x","requesting_nurse_id":"n9"}`, nil, 400, "invalid_request", 0},
		{"swap submitted", "/joined-workspace/swap-requests", `{"source_bed_id":"b1","message":"Swap"}`, nil, 201, "", 1},
		{"swap blank bed", "/joined-workspace/swap-requests", `{"source_bed_id":"","message":"Swap"}`, nil, 422, "invalid_request", 0},
		{"swap not mine", "/joined-workspace/swap-requests", `{"source_bed_id":"b1","message":"Swap"}`, rule("invalid_request", "Choose one of your assigned beds for the swap."), 422, "invalid_request", 1},
		{"swap not joined", "/joined-workspace/swap-requests", `{"source_bed_id":"b1","message":"Swap"}`, database.ErrNotJoined, 409, "not_joined", 1},
		{"issue status", issueStatus, `{"status":"reviewed"}`, nil, 200, "", 1},
		{"issue status invalid", issueStatus, `{"status":"closed"}`, nil, 422, "invalid_request", 0},
		{"issue status missing request", issueStatus, `{"status":"reviewed"}`, rule("request_not_found", "The issue request is unavailable."), 404, "request_not_found", 1},
		{"issue status transition", issueStatus, `{"status":"reviewed"}`, rule("invalid_transition", "That issue status change is not allowed."), 409, "invalid_transition", 1},
		{"issue status foreign shift", issueStatus, `{"status":"reviewed"}`, database.ErrShiftNotFound, 404, "shift_not_found", 1},
		{"swap resolution", resolution, `{"status":"accepted"}`, nil, 200, "", 1},
		{"swap resolution invalid", resolution, `{"status":"pending"}`, nil, 422, "invalid_request", 0},
		{"swap resolution not pending", resolution, `{"status":"declined"}`, rule("request_not_pending", "Only pending swap requests can be resolved."), 409, "request_not_pending", 1},
		{"resolution bad shift ID", "/shifts/local/requests/q2/swap-resolution", `{"status":"accepted"}`, nil, 400, "invalid_id", 0},
	} {
		t.Run(tt.name, func(t *testing.T) {
			store := &requestStoreStub{err: tt.storeErr, outcome: database.MoveOutcome{Saved: &database.MoveSaved{Status: "saved"}}}
			request := httptest.NewRequest("POST", tt.path+"?profile_id=other&auth_user_id=other", strings.NewReader(tt.body))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+sign(accessAuthUserID, time.Now().Add(time.Hour)))
			response := httptest.NewRecorder()
			NewHandler(verifier, profileLookup{profile: accessProfile}, nil, nil, nil, nil, nil, store, nil, nil).ServeHTTP(response, request)
			if response.Code != tt.want || len(store.calls) != tt.wantCalls {
				t.Fatalf("status=%d calls=%v body=%s", response.Code, store.calls, response.Body.String())
			}
			if tt.code != "" && !strings.Contains(response.Body.String(), `"code":"`+tt.code+`"`) {
				t.Fatal(response.Body.String())
			}
			if strings.Contains(response.Body.String(), "private") {
				t.Fatal("internal details leaked")
			}
			if len(store.args) >= 2 && (store.args[0] != accessProfile.AuthUserID || store.args[1] != accessProfile.ID) {
				t.Fatalf("identity must come from the verified token and profile: %v", store.args)
			}
		})
	}
}

func TestRequestRouteResponses(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	shiftID := "40000000-0000-4000-8000-000000000001"
	send := func(store *requestStoreStub, path, body string) *httptest.ResponseRecorder {
		request := httptest.NewRequest("POST", path, strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+sign(accessAuthUserID, time.Now().Add(time.Hour)))
		response := httptest.NewRecorder()
		NewHandler(verifier, profileLookup{profile: accessProfile}, nil, nil, nil, nil, nil, store, nil, nil).ServeHTTP(response, request)
		return response
	}
	t.Run("stale move is a 200 with the camelCase shape", func(t *testing.T) {
		stale := &database.MoveStale{Status: "stale", Message: "Review.", ActiveAssignmentOverridesByBedID: map[string]database.MoveOverride{}}
		response := send(&requestStoreStub{outcome: database.MoveOutcome{Stale: stale}}, "/shifts/"+shiftID+"/assignment-moves", validMoveBody)
		want := `"currentBaselineAssignmentResultId":null`
		if response.Code != 200 || !strings.Contains(response.Body.String(), `"status":"stale"`) || !strings.Contains(response.Body.String(), want) {
			t.Fatalf("%d %s", response.Code, response.Body.String())
		}
	})
	t.Run("the move reaches the store as sent", func(t *testing.T) {
		store := &requestStoreStub{outcome: database.MoveOutcome{Saved: &database.MoveSaved{Status: "saved"}}}
		send(store, "/shifts/"+shiftID+"/assignment-moves", validMoveBody)
		if store.args[2] != shiftID || store.move.ClientMutationID != "m1" || store.move.RelatedSwapRequestID != nil || string(store.move.WarningAcknowledgements) != "[]" {
			t.Fatalf("%v %+v", store.args, store.move)
		}
	})
	t.Run("a submitted request is returned as stored", func(t *testing.T) {
		response := send(&requestStoreStub{}, "/joined-workspace/issue-requests", `{"message":"Need help"}`)
		if !strings.Contains(response.Body.String(), `"request":{"id":"nurse-request-1","type":"issue","futureKey":true}`) {
			t.Fatal(response.Body.String())
		}
	})
	t.Run("the request ID from the path reaches the store", func(t *testing.T) {
		store := &requestStoreStub{}
		send(store, "/shifts/"+shiftID+"/requests/q1/issue-status", `{"status":"resolved"}`)
		if store.args[2] != shiftID || store.args[3] != "q1" || store.args[4] != "resolved" {
			t.Fatal(store.args)
		}
	})
}

func TestRequestRoutesRequireAChargeProfile(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	paths := []string{
		"/shifts/40000000-0000-4000-8000-000000000001/assignment-moves", "/joined-workspace/issue-requests", "/joined-workspace/swap-requests",
		"/shifts/40000000-0000-4000-8000-000000000001/requests/q1/issue-status", "/shifts/40000000-0000-4000-8000-000000000001/requests/q1/swap-resolution",
	}
	for _, path := range paths {
		for _, state := range []string{"anonymous", "regular"} {
			t.Run(state+path, func(t *testing.T) {
				regular := accessProfile
				regular.Role = "regular_nurse"
				request := httptest.NewRequest("POST", path, strings.NewReader(`{}`))
				request.Header.Set("Content-Type", "application/json")
				want := 401
				if state == "regular" {
					request.Header.Set("Authorization", "Bearer "+sign(accessAuthUserID, time.Now().Add(time.Hour)))
					want = 403
				}
				store := &requestStoreStub{}
				response := httptest.NewRecorder()
				NewHandler(verifier, profileLookup{profile: regular}, nil, nil, nil, nil, nil, store, nil, nil).ServeHTTP(response, request)
				if response.Code != want || len(store.calls) != 0 {
					t.Fatalf("status=%d calls=%v", response.Code, store.calls)
				}
			})
		}
	}
}

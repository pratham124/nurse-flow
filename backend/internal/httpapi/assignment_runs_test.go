package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/assignmentruns"
	"github.com/pratham124/nurse-flow/backend/internal/database"
)

// runnerStub records what reached the coordinator and answers with a fixed outcome.
type runnerStub struct {
	outcome  database.RunResponse
	calls    int
	caller   database.RunCaller
	shiftID  string
	request  database.RunRequest
	ctxErr   error
	deadline time.Time
	hasLimit bool
}

func (s *runnerStub) Run(ctx context.Context, caller database.RunCaller, shiftID string, request database.RunRequest) database.RunResponse {
	s.calls++
	s.caller, s.shiftID, s.request = caller, shiftID, request
	s.ctxErr = ctx.Err()
	s.deadline, s.hasLimit = ctx.Deadline()
	return s.outcome
}

const runPath = "/active-shifts/" + testTemplateID + "/assignment-runs"

const validRunBody = `{"clientMutationId":" optimizer-run-1 ","expectedShiftRevision":"2026-10-25T18:00:00.123456Z","expectedBaselineAssignmentResultId":null}`

func postRun(t *testing.T, runner *runnerStub, profile database.Profile, path, body string, mutate func(*http.Request)) *httptest.ResponseRecorder {
	t.Helper()
	verifier, sign := testDiagnosticVerifier(t)
	r := httptest.NewRequest("POST", path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Authorization", "Bearer "+sign(profile.AuthUserID, time.Now().Add(time.Hour)))
	if mutate != nil {
		mutate(r)
	}
	w := httptest.NewRecorder()
	NewHandler(verifier, testProfileReader{profile: profile}, nil, nil, nil, nil, nil, nil, nil, runner).ServeHTTP(w, r)
	return w
}

func TestAssignmentRunRouteMapsOutcomes(t *testing.T) {
	profile := database.Profile{ID: "10000000-0000-0000-0000-000000000001", AuthUserID: "20000000-0000-0000-0000-000000000001", Role: "charge_nurse"}
	wantCodes := map[database.RunStatus]int{
		database.RunStatusSaved: 200, database.RunStatusRunning: 202, database.RunStatusStale: 409, database.RunStatusConflict: 409,
		database.RunStatusInvalidInput: 422, database.RunStatusTimedOut: 504, database.RunStatusUnavailable: 503,
		database.RunStatusFailed: 500, database.RunStatusForbidden: 403,
	}
	for status := range wantCodes {
		t.Run(string(status), func(t *testing.T) {
			runner := &runnerStub{outcome: database.RunResponse{Status: status, RunID: "run-1"}}
			w := postRun(t, runner, profile, runPath, validRunBody, nil)
			if w.Code != wantCodes[status] || !strings.Contains(w.Body.String(), `"status":"`+string(status)+`"`) || !strings.Contains(w.Body.String(), `"runId":"run-1"`) {
				t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
			}
			if strings.Contains(w.Body.String(), "resultId") {
				t.Fatalf("empty resultId must be omitted: %s", w.Body.String())
			}
		})
	}
}

func TestAssignmentRunRoutePassesVerifiedInputs(t *testing.T) {
	profile := database.Profile{ID: "10000000-0000-0000-0000-000000000001", AuthUserID: "20000000-0000-0000-0000-000000000001", Role: "charge_nurse"}
	runner := &runnerStub{outcome: database.RunResponse{Status: database.RunStatusSaved, RunID: "r", ResultID: "x"}}
	w := postRun(t, runner, profile, runPath+"?shiftId=other", `{"clientMutationId":" m ","expectedShiftRevision":"2026-10-25T18:00:00.123456Z","expectedBaselineAssignmentResultId":" res1 "}`, nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"resultId":"x"`) {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if runner.caller.AuthUserID != profile.AuthUserID || runner.caller.ProfileID != profile.ID || runner.shiftID != testTemplateID {
		t.Fatalf("identity or shift came from the wrong place: %+v %q", runner.caller, runner.shiftID)
	}
	want := time.Date(2026, 10, 25, 18, 0, 0, 123456000, time.UTC)
	if runner.request.ClientMutationID != "m" || !runner.request.ExpectedRevision.Equal(want) || runner.request.ExpectedBaseline != "res1" {
		t.Fatalf("request not normalized: %+v", runner.request)
	}
}

func TestAssignmentRunRouteTruncatesRevisionToMicroseconds(t *testing.T) {
	profile := database.Profile{ID: "10000000-0000-0000-0000-000000000001", AuthUserID: "20000000-0000-0000-0000-000000000001", Role: "charge_nurse"}
	runner := &runnerStub{outcome: database.RunResponse{Status: database.RunStatusSaved}}
	body := `{"clientMutationId":"m","expectedShiftRevision":"2026-10-25T18:00:00.123456789Z"}`
	if w := postRun(t, runner, profile, runPath, body, nil); w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	// Postgres stores microseconds, so the extra digits must not reach the compare.
	want := time.Date(2026, 10, 25, 18, 0, 0, 123456000, time.UTC)
	if got := runner.request.ExpectedRevision; !got.Equal(want) {
		t.Fatalf("revision = %v, want %v", got, want)
	}
}

func TestAssignmentRunRouteRejectsBadBodies(t *testing.T) {
	profile := database.Profile{ID: "10000000-0000-0000-0000-000000000001", AuthUserID: "20000000-0000-0000-0000-000000000001", Role: "charge_nurse"}
	revision := `"expectedShiftRevision":"2026-10-25T18:00:00Z"`
	tests := []struct {
		name, body string
		want       int
	}{
		{"malformed JSON", `{"clientMutationId":`, 422},
		{"null body", `null`, 422},
		{"not an object", `[]`, 422},
		{"unknown field", `{"clientMutationId":"m",` + revision + `,"shiftId":"x"}`, 422},
		{"missing mutation id", `{` + revision + `}`, 422},
		{"blank mutation id", `{"clientMutationId":"  ",` + revision + `}`, 422},
		{"numeric mutation id", `{"clientMutationId":5,` + revision + `}`, 422},
		{"missing revision", `{"clientMutationId":"m"}`, 422},
		{"null revision", `{"clientMutationId":"m","expectedShiftRevision":null}`, 422},
		{"revision is not RFC 3339", `{"clientMutationId":"m","expectedShiftRevision":"yesterday"}`, 422},
		{"blank baseline", `{"clientMutationId":"m",` + revision + `,"expectedBaselineAssignmentResultId":"  "}`, 422},
		{"numeric baseline", `{"clientMutationId":"m",` + revision + `,"expectedBaselineAssignmentResultId":3}`, 422},
		{"too large", `{"clientMutationId":"` + strings.Repeat("x", 17<<10) + `",` + revision + `}`, 413},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			runner := &runnerStub{}
			w := postRun(t, runner, profile, runPath, test.body, nil)
			if w.Code != test.want || strings.TrimSpace(w.Body.String()) != `{"status":"invalid_input"}` || runner.calls != 0 {
				t.Fatalf("status=%d calls=%d body=%s", w.Code, runner.calls, w.Body.String())
			}
		})
	}
	t.Run("wrong media type", func(t *testing.T) {
		runner := &runnerStub{}
		w := postRun(t, runner, profile, runPath, validRunBody, func(r *http.Request) { r.Header.Set("Content-Type", "text/plain") })
		if w.Code != 422 || strings.TrimSpace(w.Body.String()) != `{"status":"invalid_input"}` || runner.calls != 0 {
			t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
		}
	})
}

func TestAssignmentRunRouteAuthAndShiftID(t *testing.T) {
	charge := database.Profile{ID: "10000000-0000-0000-0000-000000000001", AuthUserID: "20000000-0000-0000-0000-000000000001", Role: "charge_nurse"}
	regular := charge
	regular.Role = "regular_nurse"
	tests := []struct {
		name    string
		profile database.Profile
		path    string
		mutate  func(*http.Request)
		want    int
	}{
		{"missing token", charge, runPath, func(r *http.Request) { r.Header.Del("Authorization") }, 401},
		{"regular nurse", regular, runPath, nil, 403},
		{"shift id is not a uuid", charge, "/active-shifts/local/assignment-runs", nil, 400},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			runner := &runnerStub{}
			w := postRun(t, runner, test.profile, test.path, validRunBody, test.mutate)
			if w.Code != test.want || runner.calls != 0 {
				t.Fatalf("status=%d calls=%d body=%s", w.Code, runner.calls, w.Body.String())
			}
		})
	}
}

// A phone that disconnects cancels the request context; the run must carry on
// with its own detached context and the 135 s deadline.
func TestAssignmentRunIsDetachedFromTheRequest(t *testing.T) {
	runner := &runnerStub{outcome: database.RunResponse{Status: database.RunStatusSaved}}
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	started := time.Now()
	handler := assignmentRunHandler(runner)
	request := httptest.NewRequest("POST", runPath, strings.NewReader(validRunBody)).WithContext(cancelled)
	request.Header.Set("Content-Type", "application/json")
	request.SetPathValue("id", testTemplateID)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if runner.calls != 1 || runner.ctxErr != nil {
		t.Fatalf("the run saw the cancelled request: calls=%d err=%v", runner.calls, runner.ctxErr)
	}
	if !runner.hasLimit || runner.deadline.Before(started.Add(assignmentruns.RunDeadline-5*time.Second)) || runner.deadline.After(time.Now().Add(assignmentruns.RunDeadline)) {
		t.Fatalf("run deadline is %v, want about %v from now", runner.deadline, assignmentruns.RunDeadline)
	}
	if recorder.Code != 200 {
		t.Fatalf("status=%d", recorder.Code)
	}
}

package httpapi

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
)

type shiftStoreStub struct {
	call   func(context.Context, string, string, string) error
	row    *database.ActiveShift
	reopen database.ReopenResult
}

func (s shiftStoreStub) CurrentShift(ctx context.Context, a, p string) (*database.ActiveShift, error) {
	return s.row, s.call(ctx, a, p, "")
}
func (s shiftStoreStub) PreviousShifts(ctx context.Context, a, p string) ([]database.PreviousShift, error) {
	return nil, s.call(ctx, a, p, "")
}
func (s shiftStoreStub) StartShift(ctx context.Context, a, p, id string) (database.ActiveShift, error) {
	err := s.call(ctx, a, p, id)
	return database.ActiveShift{ID: id}, err
}
func (s shiftStoreStub) SaveShiftSetup(ctx context.Context, a, p, id string, expected time.Time, input shifts.Setup) (database.ActiveShift, error) {
	return database.ActiveShift{ID: id}, s.call(ctx, a, p, id)
}
func (s shiftStoreStub) ReopenShift(ctx context.Context, a, p, id, baseline string) (database.ReopenResult, error) {
	return s.reopen, s.call(ctx, a, p, id)
}
func (s shiftStoreStub) EndShift(ctx context.Context, a, p, id string) (database.ActiveShift, error) {
	return database.ActiveShift{ID: id}, s.call(ctx, a, p, id)
}

func TestShiftRoutes(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	profile := database.Profile{ID: "10000000-0000-0000-0000-000000000001", AuthUserID: "20000000-0000-0000-0000-000000000001", Role: "charge_nurse"}
	setupBody := `{"expected_updated_at":"2026-10-18T12:00:00.123456Z","setup":{"admittingDoctorSideId":"a","sideLoadLimits":{"admitting":{"min":4,"max":5},"nonAdmitting":{"min":6,"max":7}},"nurses":[],"bedStates":[]}}`
	for _, tt := range []struct {
		name, method, path, body string
		want                     int
		code                     string
		storeErr                 error
		calls                    int
	}{
		{"empty current", "GET", "/active-shifts/current", "", 200, "", nil, 1},
		{"empty previous", "GET", "/previous-shift-snapshots", "", 200, "", nil, 1},
		{"start", "POST", "/active-shifts", `{"floor_template_id":"` + testTemplateID + `"}`, 201, "", nil, 1},
		{"setup", "PUT", "/active-shifts/" + testTemplateID + "/setup", setupBody, 200, "", nil, 1},
		{"reopen", "POST", "/active-shifts/" + testTemplateID + "/reopen", `{"expected_baseline_assignment_result_id":"baseline"}`, 200, "", nil, 1},
		{"end", "POST", "/active-shifts/" + testTemplateID + "/end", `{}`, 200, "", nil, 1},
		{"unknown start template", "POST", "/active-shifts", `{"floor_template_id":"` + testTemplateID + `"}`, 404, "shift_not_found", database.ErrTemplateNotFound, 1},
		{"foreign end", "POST", "/active-shifts/" + testTemplateID + "/end", `{}`, 404, "shift_not_found", database.ErrShiftNotFound, 1},
		{"stale setup", "PUT", "/active-shifts/" + testTemplateID + "/setup", setupBody, 409, "shift_stale", database.ErrShiftStale, 1},
		{"assigned setup", "PUT", "/active-shifts/" + testTemplateID + "/setup", setupBody, 409, "shift_assigned", database.ErrShiftAssigned, 1},
		{"duplicate start", "POST", "/active-shifts", `{"floor_template_id":"` + testTemplateID + `"}`, 409, "shift_already_open", database.ErrShiftAlreadyOpen, 1},
		{"invalid setup", "PUT", "/active-shifts/" + testTemplateID + "/setup", setupBody, 400, "invalid_shift", shifts.ErrInvalidSetup, 1},
		{"controlled DB error", "GET", "/active-shifts/current", "", 503, "database_unavailable", errors.New("private password SQL"), 1},
		{"invalid ID", "POST", "/active-shifts/local/end", `{}`, 400, "invalid_id", nil, 0},
		{"invalid template ID", "POST", "/active-shifts", `{"floor_template_id":"local"}`, 400, "invalid_id", nil, 0},
		{"compact template ID", "POST", "/active-shifts", `{"floor_template_id":"` + strings.ReplaceAll(testTemplateID, "-", "") + `"}`, 400, "invalid_id", nil, 0},
		{"braced template ID", "POST", "/active-shifts", `{"floor_template_id":"{` + testTemplateID + `}"}`, 400, "invalid_id", nil, 0},
		{"missing revision", "PUT", "/active-shifts/" + testTemplateID + "/setup", `{"setup":{}}`, 400, "invalid_shift", nil, 0},
		{"forged identity", "POST", "/active-shifts", `{"floor_template_id":"` + testTemplateID + `","charge_profile_id":"other"}`, 400, "invalid_shift", nil, 0},
		{"forged baseline", "PUT", "/active-shifts/" + testTemplateID + "/setup", strings.Replace(setupBody, `"setup":{`, `"setup":{"assignmentResult":{},`, 1), 400, "invalid_shift", nil, 0},
		{"client snapshot on end", "POST", "/active-shifts/" + testTemplateID + "/end", `{"shift_snapshot":{}}`, 400, "invalid_shift", nil, 0},
		{"null end", "POST", "/active-shifts/" + testTemplateID + "/end", `null`, 400, "invalid_shift", nil, 0},
		{"multiple JSON values", "POST", "/active-shifts/" + testTemplateID + "/end", `{} {}`, 400, "invalid_shift", nil, 0},
		{"large request", "POST", "/active-shifts/" + testTemplateID + "/reopen", `{"expected_baseline_assignment_result_id":"` + strings.Repeat("x", 1<<20) + `"}`, 413, "shift_too_large", nil, 0},
	} {
		t.Run(tt.name, func(t *testing.T) {
			calls := 0
			store := shiftStoreStub{call: func(ctx context.Context, a, p, id string) error {
				calls++
				if a != profile.AuthUserID || p != profile.ID || ctx.Err() != nil {
					t.Fatal("client identity reached database")
				}
				if id != "" && id != testTemplateID {
					t.Fatal("wrong resource ID")
				}
				return tt.storeErr
			}, reopen: database.ReopenResult{Status: "stale", Message: "Review current board."}}
			r := httptest.NewRequest(tt.method, tt.path+"?charge_profile_id=other&auth_user_id=other", strings.NewReader(tt.body))
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("Authorization", "Bearer "+sign(profile.AuthUserID, time.Now().Add(time.Hour)))
			w := httptest.NewRecorder()
			NewHandler(verifier, testProfileReader{profile: profile}, nil, store, nil, nil, nil).ServeHTTP(w, r)
			if w.Code != tt.want || calls != tt.calls {
				t.Fatalf("status=%d calls=%d body=%s", w.Code, calls, w.Body.String())
			}
			if tt.code != "" && !strings.Contains(w.Body.String(), `"code":"`+tt.code+`"`) {
				t.Fatal(w.Body.String())
			}
			if strings.Contains(w.Body.String(), "private") {
				t.Fatal("internal details leaked")
			}
			if tt.name == "empty current" && !strings.Contains(w.Body.String(), `"active_shift":null`) {
				t.Fatal("empty shift contract changed")
			}
			if tt.name == "empty previous" && !strings.Contains(w.Body.String(), `"snapshots":[]`) {
				t.Fatal("empty suggestions contract changed")
			}
		})
	}
	for _, route := range []struct{ method, path string }{{"GET", "/active-shifts/current"}, {"GET", "/previous-shift-snapshots"}, {"POST", "/active-shifts"}, {"PUT", "/active-shifts/" + testTemplateID + "/setup"}, {"POST", "/active-shifts/" + testTemplateID + "/reopen"}, {"POST", "/active-shifts/" + testTemplateID + "/end"}} {
		for _, state := range []string{"missing", "expired", "invalid", "regular", "profile missing"} {
			t.Run(route.method+route.path+state, func(t *testing.T) {
				current := profile
				var profileErr error
				want := 401
				if state == "regular" {
					current.Role = "regular_nurse"
					want = 403
				}
				if state == "profile missing" {
					profileErr = database.ErrProfileNotFound
					want = 403
				}
				r := httptest.NewRequest(route.method, route.path, strings.NewReader(`{}`))
				r.Header.Set("Content-Type", "application/json")
				if state != "missing" {
					expires := time.Now().Add(time.Hour)
					if state == "expired" {
						expires = time.Now().Add(-time.Minute)
					}
					token := sign(profile.AuthUserID, expires)
					if state == "invalid" {
						token = "invalid"
					}
					r.Header.Set("Authorization", "Bearer "+token)
				}
				w := httptest.NewRecorder()
				store := shiftStoreStub{call: func(context.Context, string, string, string) error { t.Fatal("unauthorized database call"); return nil }}
				NewHandler(verifier, testProfileReader{profile: current, err: profileErr}, nil, store, nil, nil, nil).ServeHTTP(w, r)
				if w.Code != want {
					t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
				}
			})
		}
	}
}

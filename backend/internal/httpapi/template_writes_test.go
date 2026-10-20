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
	"github.com/pratham124/nurse-flow/backend/internal/templates"
)

const testLayout = `{"id":"local-floor","name":" Floor ","doctorSides":[{"id":"a","name":"A"},{"id":"b","name":"B"}],"rooms":[{"id":"r","doctorSideId":"a","label":"101","bedCount":1}],"beds":[{"id":"one","roomId":"r","label":"101-1","bedNumber":1}]}`
const testTemplateID = "30000000-0000-4000-8000-000000000001"

type templateWriteStub struct {
	templateReaderFunc
	save   func(context.Context, string, string, string, templates.Snapshot) (database.FloorTemplate, error)
	remove func(context.Context, string, string, string) error
}

func (s templateWriteStub) SaveFloorTemplate(ctx context.Context, authID, profileID, id string, snapshot templates.Snapshot) (database.FloorTemplate, error) {
	return s.save(ctx, authID, profileID, id, snapshot)
}
func (s templateWriteStub) DeleteFloorTemplate(ctx context.Context, authID, profileID, id string) error {
	return s.remove(ctx, authID, profileID, id)
}

func TestTemplateWrites(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	charge := database.Profile{ID: "10000000-0000-0000-0000-000000000001", AuthUserID: "20000000-0000-0000-0000-000000000001", Role: "charge_nurse"}
	tests := []struct {
		name, method, path, body, token, role, contentType string
		storeErr                                           error
		wantStatus                                         int
		wantCode                                           string
		wantCalls                                          int
	}{
		{"create", "POST", "/floor-templates", `{"template_snapshot":` + testLayout + `}`, "valid", "charge_nurse", "application/json", nil, 201, "", 1},
		{"update", "PUT", "/floor-templates/" + testTemplateID, `{"template_snapshot":` + testLayout + `}`, "valid", "charge_nurse", "application/json; charset=utf-8", nil, 200, "", 1},
		{"delete", "DELETE", "/floor-templates/" + testTemplateID, "", "valid", "charge_nurse", "", nil, 204, "", 1},
		{"missing update", "PUT", "/floor-templates/" + testTemplateID, `{"template_snapshot":` + testLayout + `}`, "valid", "charge_nurse", "application/json", database.ErrTemplateNotFound, 404, "template_not_found", 1},
		{"missing delete", "DELETE", "/floor-templates/" + testTemplateID, "", "valid", "charge_nurse", "", database.ErrTemplateNotFound, 404, "template_not_found", 1},
		{"failed save", "POST", "/floor-templates", `{"template_snapshot":` + testLayout + `}`, "valid", "charge_nurse", "application/json", errors.New("private password SQL"), 503, "database_unavailable", 1},
		{"failed delete", "DELETE", "/floor-templates/" + testTemplateID, "", "valid", "charge_nurse", "", errors.New("private SQL"), 503, "database_unavailable", 1},
		{"invalid update ID", "PUT", "/floor-templates/local", `{"template_snapshot":` + testLayout + `}`, "valid", "charge_nurse", "application/json", nil, 400, "invalid_id", 0},
		{"invalid delete ID", "DELETE", "/floor-templates/local", "", "valid", "charge_nurse", "", nil, 400, "invalid_id", 0},
		{"nonhex update ID", "PUT", "/floor-templates/g0000000-0000-4000-8000-000000000001", `{"template_snapshot":` + testLayout + `}`, "valid", "charge_nurse", "application/json", nil, 400, "invalid_id", 0},
		{"malformed delete ID", "DELETE", "/floor-templates/30000000000040008000000000000001", "", "valid", "charge_nurse", "", nil, 400, "invalid_id", 0},
		{"missing token before ID check", "PUT", "/floor-templates/local", `{}`, "", "charge_nurse", "application/json", nil, 401, "unauthenticated", 0},
		{"forbidden role before ID check", "DELETE", "/floor-templates/local", "", "valid", "regular_nurse", "", nil, 403, "forbidden", 0},
		{"invalid Auth subject", "PUT", "/floor-templates/" + testTemplateID, `{}`, "invalid-subject", "charge_nurse", "application/json", nil, 401, "unauthenticated", 0},
		{"missing token", "POST", "/floor-templates", `{}`, "", "charge_nurse", "application/json", nil, 401, "unauthenticated", 0},
		{"expired delete", "DELETE", "/floor-templates/" + testTemplateID, "", "expired", "charge_nurse", "", nil, 401, "unauthenticated", 0},
		{"regular save", "POST", "/floor-templates", `{}`, "valid", "regular_nurse", "application/json", nil, 403, "forbidden", 0},
		{"regular delete", "DELETE", "/floor-templates/" + testTemplateID, "", "valid", "regular_nurse", "", nil, 403, "forbidden", 0},
		{"invalid JSON", "POST", "/floor-templates", `{`, "valid", "charge_nurse", "application/json", nil, 400, "invalid_template", 0},
		{"null", "POST", "/floor-templates", `null`, "valid", "charge_nurse", "application/json", nil, 400, "invalid_template", 0},
		{"empty layout", "POST", "/floor-templates", `{}`, "valid", "charge_nurse", "application/json", nil, 400, "invalid_template", 0},
		{"second value", "POST", "/floor-templates", `{"template_snapshot":` + testLayout + `} {}`, "valid", "charge_nurse", "application/json", nil, 400, "invalid_template", 0},
		{"spoofed owner", "POST", "/floor-templates", `{"template_snapshot":` + testLayout + `,"owner_profile_id":"other"}`, "valid", "charge_nurse", "application/json", nil, 400, "invalid_template", 0},
		{"shift data", "POST", "/floor-templates", `{"template_snapshot":` + strings.Replace(testLayout, `"name":" Floor "`, `"name":" Floor ","patients":[]`, 1) + `}`, "valid", "charge_nurse", "application/json", nil, 400, "invalid_template", 0},
		{"fractional count", "POST", "/floor-templates", `{"template_snapshot":` + strings.Replace(testLayout, `"bedCount":1`, `"bedCount":1.5`, 1) + `}`, "valid", "charge_nurse", "application/json", nil, 400, "invalid_template", 0},
		{"wrong media type", "POST", "/floor-templates", `{}`, "valid", "charge_nurse", "text/plain", nil, 415, "unsupported_media_type", 0},
		{"large body", "POST", "/floor-templates", `{"template_snapshot":` + strings.Replace(testLayout, " Floor ", strings.Repeat("x", maxTemplateBodyBytes), 1) + `}`, "valid", "charge_nurse", "application/json", nil, 413, "template_too_large", 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			calls := 0
			check := func(ctx context.Context, authID, profileID, id string) {
				calls++
				if ctx.Err() != nil || authID != charge.AuthUserID || profileID != charge.ID {
					t.Fatal("unverified identity reached writer")
				}
				if test.method != "POST" && id != testTemplateID {
					t.Fatal("wrong path ID")
				}
				if test.method == "POST" && id != "" {
					t.Fatal("create trusted snapshot ID")
				}
			}
			store := templateWriteStub{
				save: func(ctx context.Context, authID, profileID, id string, s templates.Snapshot) (database.FloorTemplate, error) {
					check(ctx, authID, profileID, id)
					if s.Validate() != nil {
						t.Fatal("invalid layout reached writer")
					}
					return database.FloorTemplate{ID: testTemplateID, OwnerProfileID: charge.ID, Name: "Floor", TemplateSnapshot: json.RawMessage(testLayout)}, test.storeErr
				},
				remove: func(ctx context.Context, authID, profileID, id string) error {
					check(ctx, authID, profileID, id)
					return test.storeErr
				},
			}
			profile := charge
			profile.Role = test.role
			request := httptest.NewRequest(test.method, test.path+"?owner_profile_id=other", strings.NewReader(test.body))
			request.Header.Set("Content-Type", test.contentType)
			if test.token != "" {
				expiry := time.Now().Add(time.Hour)
				if test.token == "expired" {
					expiry = time.Now().Add(-time.Minute)
				}
				subject := charge.AuthUserID
				if test.token == "invalid-subject" {
					subject = "not-a-uuid"
				}
				request.Header.Set("Authorization", "Bearer "+sign(subject, expiry))
			}
			response := httptest.NewRecorder()
			NewHandler(verifier, testProfileReader{profile: profile}, store, nil).ServeHTTP(response, request)
			if response.Code != test.wantStatus || calls != test.wantCalls {
				t.Fatalf("status=%d calls=%d body=%s", response.Code, calls, response.Body.String())
			}
			if test.wantCode != "" && (!strings.Contains(response.Body.String(), `"code":"`+test.wantCode+`"`) || strings.Contains(response.Body.String(), "private")) {
				t.Fatalf("uncontrolled error: %s", response.Body.String())
			}
			if test.wantStatus == 204 && response.Body.Len() != 0 {
				t.Fatal("delete returned a body")
			}
			if test.wantStatus == 200 || test.wantStatus == 201 {
				var saved floorTemplateSaveResponse
				if json.Unmarshal(response.Body.Bytes(), &saved) != nil || saved.Template.ID != testTemplateID || saved.Template.OwnerProfileID != charge.ID {
					t.Fatal("incorrect save envelope")
				}
			}
		})
	}
}

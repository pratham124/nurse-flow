package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
	"github.com/pratham124/nurse-flow/backend/internal/templates"
)

type templateReaderFunc func(context.Context, string, string) ([]database.FloorTemplate, error)

func (f templateReaderFunc) FloorTemplatesByProfile(ctx context.Context, authID, profileID string) ([]database.FloorTemplate, error) {
	return f(ctx, authID, profileID)
}

func (f templateReaderFunc) SaveFloorTemplate(context.Context, string, string, string, templates.Snapshot) (database.FloorTemplate, error) {
	panic("read test unexpectedly wrote a template")
}

func (f templateReaderFunc) DeleteFloorTemplate(context.Context, string, string, string) error {
	panic("read test unexpectedly deleted a template")
}

type testProfileReader struct {
	profile database.Profile
	err     error
}

func (p testProfileReader) ProfileByAuthUserID(context.Context, string) (database.Profile, error) {
	return p.profile, p.err
}

func TestFloorTemplatesEndpoint(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	charge := database.Profile{
		ID: "10000000-0000-0000-0000-000000000001", AuthUserID: "20000000-0000-0000-0000-000000000001", Role: "charge_nurse",
	}
	regular := charge
	regular.Role = "regular_nurse"
	snapshot := json.RawMessage(`{"id":"old-id","name":"old-name","doctorSides":[{"id":"side","extra":true}],"rooms":[],"beds":[],"futureField":42}`)
	row := database.FloorTemplate{
		ID: "30000000-0000-0000-0000-000000000001", OwnerProfileID: charge.ID, Name: "Current floor name",
		TemplateSnapshot: snapshot,
		CreatedAt:        time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), UpdatedAt: time.Date(2026, 10, 17, 12, 0, 0, 123456000, time.UTC),
	}
	bearer := sign(charge.AuthUserID, time.Now().Add(time.Hour))
	tests := []struct {
		name       string
		profile    database.Profile
		profileErr error
		rows       []database.FloorTemplate
		queryErr   error
		status     int
		code       string
		wantQuery  bool
	}{
		{"list", charge, nil, []database.FloorTemplate{row}, nil, 200, "", true},
		{"empty slice", charge, nil, []database.FloorTemplate{}, nil, 200, "", true},
		{"nil slice", charge, nil, nil, nil, 200, "", true},
		{"regular nurse", regular, nil, nil, nil, 403, "forbidden", false},
		{"missing profile", database.Profile{}, database.ErrProfileNotFound, nil, nil, 403, "profile_missing", false},
		{"profile query fails", charge, errors.New("private connection detail"), nil, nil, 503, "database_unavailable", false},
		{"template query fails", charge, nil, []database.FloorTemplate{row}, errors.New("private SQL detail"), 503, "database_unavailable", true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var queries atomic.Int32
			reader := templateReaderFunc(func(ctx context.Context, authID, profileID string) ([]database.FloorTemplate, error) {
				queries.Add(1)
				if ctx.Err() != nil || authID != charge.AuthUserID || profileID != charge.ID {
					t.Error("template query did not receive the authorized profile and request context")
				}
				return test.rows, test.queryErr
			})
			server := httptest.NewServer(NewHandler(verifier, testProfileReader{test.profile, test.profileErr}, reader, nil, nil, nil, nil, nil, nil, nil))
			defer server.Close()
			// A separate transport sends real local HTTP requests while public-key
			// discovery continues to use the synthetic key fixture.
			transport := &http.Transport{}
			defer transport.CloseIdleConnections()
			client := &http.Client{Transport: transport, Timeout: 5 * time.Second}
			request, err := http.NewRequest(http.MethodGet, server.URL+"/floor-templates?owner_profile_id=other&auth_user_id=other&role=charge_nurse", nil)
			if err != nil {
				t.Fatal(err)
			}
			request.Header.Set("Authorization", "Bearer "+bearer)
			request.Header.Set("X-Profile-ID", "other")
			response, err := client.Do(request)
			if err != nil {
				t.Fatal(err)
			}
			defer response.Body.Close()
			body, err := io.ReadAll(response.Body)
			if err != nil {
				t.Fatal(err)
			}
			if response.StatusCode != test.status || (queries.Load() == 1) != test.wantQuery {
				t.Fatalf("status=%d, queries=%d, body=%s", response.StatusCode, queries.Load(), body)
			}
			if response.Header.Get("Content-Type") != "application/json" || response.Header.Get("Cache-Control") != "no-store" {
				t.Fatal("missing JSON/no-store response headers")
			}
			if test.code != "" {
				var result httpresponse.ErrorResponse
				if err := json.Unmarshal(body, &result); err != nil || result.Error.Code != test.code || strings.Contains(string(body), "private") || strings.Contains(string(body), row.Name) {
					t.Fatalf("unexpected public error or leaked partial data: %s", body)
				}
				return
			}
			var envelope map[string][]map[string]json.RawMessage
			if err := json.Unmarshal(body, &envelope); err != nil || len(envelope) != 1 || envelope["templates"] == nil || len(envelope["templates"]) != len(test.rows) {
				t.Fatalf("unexpected list envelope: %s", body)
			}
			if len(test.rows) == 0 {
				return
			}
			actual := envelope["templates"][0]
			if len(actual) != 6 {
				t.Fatalf("unexpected row fields: %s", body)
			}
			for name, want := range map[string]string{"id": row.ID, "owner_profile_id": charge.ID, "name": row.Name} {
				var value string
				if err := json.Unmarshal(actual[name], &value); err != nil || value != want {
					t.Fatalf("field %s did not preserve the row value", name)
				}
			}
			for name, want := range map[string]time.Time{"created_at": row.CreatedAt, "updated_at": row.UpdatedAt} {
				var value time.Time
				if err := json.Unmarshal(actual[name], &value); err != nil || !value.Equal(want) {
					t.Fatalf("field %s did not preserve the timestamp", name)
				}
			}
			var actualSnapshot, expectedSnapshot any
			if err := json.Unmarshal(actual["template_snapshot"], &actualSnapshot); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(snapshot, &expectedSnapshot); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(actualSnapshot, expectedSnapshot) {
				t.Fatal("snapshot was mapped or had fields discarded")
			}
		})
	}
}

func TestFloorTemplatesRejectsExpiredToken(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	request := httptest.NewRequest(http.MethodGet, "/floor-templates", nil)
	request.Header.Set("Authorization", "Bearer "+sign("20000000-0000-0000-0000-000000000001", time.Now().Add(-time.Minute)))
	response := httptest.NewRecorder()
	// Nil readers would panic if token rejection did not stop the request first.
	NewHandler(verifier, nil, nil, nil, nil, nil, nil, nil, nil, nil).ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expired token received %d", response.Code)
	}
}

func TestFloorTemplatesRequiresAuthorizedContext(t *testing.T) {
	reader := templateReaderFunc(func(context.Context, string, string) ([]database.FloorTemplate, error) {
		t.Fatal("missing authorized profile reached template query")
		return nil, nil
	})
	response := httptest.NewRecorder()
	floorTemplatesHandler(reader).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/floor-templates", nil))
	if response.Code != http.StatusInternalServerError {
		t.Fatal("missing middleware context did not fail closed")
	}
}

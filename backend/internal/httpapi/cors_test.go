package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/database"
)

func TestBrowserTemplateRequests(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	profile := database.Profile{
		ID: "10000000-0000-0000-0000-000000000001", AuthUserID: "20000000-0000-0000-0000-000000000001", Role: "charge_nurse",
	}
	queries := 0
	reader := templateReaderFunc(func(context.Context, string, string) ([]database.FloorTemplate, error) {
		queries++
		return []database.FloorTemplate{}, nil
	})
	handler := WithCORS(NewHandler(verifier, testProfileReader{profile: profile}, reader, nil, nil, nil, nil, nil, nil, nil), []string{"http://localhost:8081", " http://127.0.0.1:8081 "})
	tests := []struct {
		name, method, origin, preflightMethod, headers, token string
		status                                                int
		wantQuery                                             bool
	}{
		{"preflight", "OPTIONS", "http://localhost:8081", "GET", "authorization", "", 204, false},
		{"header case and spacing", "OPTIONS", "http://127.0.0.1:8081", "GET", " Authorization, Accept ", "", 204, false},
		{"duplicate unsorted headers", "OPTIONS", "http://localhost:8081", "PUT", " Content-Type, Authorization, ACCEPT, authorization, , ", "", 204, false},
		{"no requested headers", "OPTIONS", "http://localhost:8081", "GET", "", "", 204, false},
		{"authorized", "GET", "http://localhost:8081", "", "", sign(profile.AuthUserID, time.Now().Add(time.Hour)), 200, true},
		{"missing token", "GET", "http://localhost:8081", "", "", "", 401, false},
		{"invalid token", "GET", "http://localhost:8081", "", "", "invalid", 401, false},
		{"native without origin", "GET", "", "", "", sign(profile.AuthUserID, time.Now().Add(time.Hour)), 200, true},
		{"unlisted origin", "OPTIONS", "http://localhost:8082", "GET", "authorization", "", 403, false},
		{"origin suffix", "OPTIONS", "http://localhost:8081.evil.test", "GET", "authorization", "", 403, false},
		{"null origin", "OPTIONS", "null", "GET", "authorization", "", 403, false},
		{"create preflight", "OPTIONS", "http://localhost:8081", "POST", "authorization, content-type", "", 204, false},
		{"update preflight", "OPTIONS", "http://localhost:8081", "PUT", "authorization, content-type", "", 204, false},
		{"delete preflight", "OPTIONS", "http://localhost:8081", "DELETE", "authorization", "", 204, false},
		{"unsupported method", "OPTIONS", "http://localhost:8081", "PATCH", "authorization", "", 403, false},
		{"extra header", "OPTIONS", "http://localhost:8081", "GET", "X-Profile-ID", "", 403, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			before := queries
			request := httptest.NewRequest(test.method, "/floor-templates", nil)
			request.Header.Set("Origin", test.origin)
			request.Header.Set("Access-Control-Request-Method", test.preflightMethod)
			request.Header.Set("Access-Control-Request-Headers", test.headers)
			if test.token != "" {
				request.Header.Set("Authorization", "Bearer "+test.token)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != test.status || (queries-before == 1) != test.wantQuery {
				t.Fatalf("status=%d, query delta=%d", response.Code, queries-before)
			}
			allowed := response.Header().Get("Access-Control-Allow-Origin")
			if test.origin == "http://localhost:8081" || test.origin == "http://127.0.0.1:8081" {
				if allowed != test.origin {
					t.Fatal("allowed-origin success/error response cannot be read by the browser")
				}
			} else if allowed != "" {
				t.Fatal("unlisted origin received CORS permission")
			}
			if !strings.Contains(strings.Join(response.Header().Values("Vary"), ","), "Origin") || response.Header().Get("Access-Control-Allow-Credentials") != "" {
				t.Fatal("unexpected cache variation or cookie permission")
			}
			if response.Code == http.StatusNoContent {
				if response.Header().Get("Access-Control-Allow-Methods") != "GET, POST, PUT, DELETE" || !strings.Contains(response.Header().Get("Access-Control-Allow-Headers"), "Content-Type") || response.Body.Len() != 0 {
					t.Fatal("invalid preflight response")
				}
			}
		})
	}
}

func TestCORSCanBeDisabled(t *testing.T) {
	called := false
	handler := WithCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}), nil)
	request := httptest.NewRequest("GET", "/health", nil)
	request.Header.Set("Origin", "http://localhost:8081")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden || called {
		t.Fatal("empty allowlist accepted a browser origin")
	}
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/health", nil))
	if !called {
		t.Fatal("empty allowlist blocked a request without Origin")
	}
}

func TestCORSRejectionContract(t *testing.T) {
	const origin = "http://localhost:8081"
	for _, test := range []struct {
		name, method, origin, requestedMethod, headers, code string
		status                                               int
		called                                               bool
	}{
		{"unlisted actual origin", "GET", "http://localhost:8082", "", "", "origin_forbidden", 403, false},
		{"exact origin case", "GET", "http://LOCALHOST:8081", "", "", "origin_forbidden", 403, false},
		{"unsupported preflight method", "OPTIONS", origin, "PATCH", "authorization", "cors_forbidden", 403, false},
		{"OPTIONS as requested method", "OPTIONS", origin, "OPTIONS", "authorization", "cors_forbidden", 403, false},
		{"HEAD as requested method", "OPTIONS", origin, "HEAD", "authorization", "cors_forbidden", 403, false},
		{"unsupported preflight header", "OPTIONS", origin, "GET", "authorization, x-profile-id", "cors_forbidden", 403, false},
		{"actual method reaches router", "PATCH", origin, "", "", "", 418, true},
		{"plain OPTIONS reaches router", "OPTIONS", origin, "", "", "", 418, true},
		{"no-origin OPTIONS reaches router", "OPTIONS", "", "GET", "authorization", "", 418, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			called := false
			handler := WithCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				w.WriteHeader(http.StatusTeapot)
			}), []string{origin})
			request := httptest.NewRequest(test.method, "/health", nil)
			request.Header.Set("Origin", test.origin)
			request.Header.Set("Access-Control-Request-Method", test.requestedMethod)
			request.Header.Set("Access-Control-Request-Headers", test.headers)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != test.status || called != test.called {
				t.Fatalf("status=%d called=%v", response.Code, called)
			}
			wantOrigin := ""
			if test.origin == origin {
				wantOrigin = origin
			}
			if got := response.Header().Get("Access-Control-Allow-Origin"); got != wantOrigin {
				t.Fatalf("allowed origin=%q, want %q", got, wantOrigin)
			}
			if test.code != "" {
				if response.Header().Get("Access-Control-Allow-Methods") != "" || response.Header().Get("Access-Control-Allow-Headers") != "" {
					t.Fatal("rejected request advertised preflight permissions")
				}
				var body struct {
					Error struct{ Code string } `json:"error"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body.Error.Code != test.code {
					t.Fatalf("unexpected error response: %s", response.Body.String())
				}
			}
		})
	}
}

// The profile, invite, and joined-workspace routes need no new methods or headers,
// but browsers must be able to preflight and read them like the other routes.
func TestBrowserAccessRequests(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	store := &accessStoreStub{validation: database.InviteValidation{Status: "blocked", Reason: "not_found"}}
	handler := WithCORS(NewHandler(verifier, profileLookup{profile: accessProfile}, nil, nil, store, store, store, nil, nil, nil), []string{"http://localhost:8081"})
	const origin = "http://localhost:8081"
	for _, route := range []struct{ method, path string }{
		{"PUT", "/profile"}, {"GET", "/profile"}, {"POST", "/invites/validate"}, {"POST", "/invites/accept"},
		{"GET", "/joined-workspace"}, {"GET", "/shifts/" + testTemplateID + "/invites"},
		{"POST", "/shifts/" + testTemplateID + "/invites"}, {"POST", "/shifts/" + testTemplateID + "/invites/regenerate"},
	} {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			preflight := httptest.NewRequest("OPTIONS", route.path, nil)
			preflight.Header.Set("Origin", origin)
			preflight.Header.Set("Access-Control-Request-Method", route.method)
			preflight.Header.Set("Access-Control-Request-Headers", "authorization, content-type")
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, preflight)
			if response.Code != http.StatusNoContent || response.Header().Get("Access-Control-Allow-Origin") != origin {
				t.Fatalf("preflight status=%d headers=%v", response.Code, response.Header())
			}
			var body io.Reader
			switch {
			case strings.HasPrefix(route.path, "/invites/"):
				body = strings.NewReader(`{"code":"K7QX2M"}`)
			case route.method == "POST":
				body = strings.NewReader(`{"nurse_id":"n1"}`)
			}
			actual := httptest.NewRequest(route.method, route.path, body)
			actual.Header.Set("Content-Type", "application/json")
			actual.Header.Set("Origin", origin)
			actual.Header.Set("Authorization", "Bearer "+sign(accessAuthUserID, time.Now().Add(time.Hour)))
			response = httptest.NewRecorder()
			handler.ServeHTTP(response, actual)
			if response.Code != http.StatusOK && response.Code != http.StatusCreated || response.Header().Get("Access-Control-Allow-Origin") != origin {
				t.Fatalf("status=%d headers=%v body=%s", response.Code, response.Header(), response.Body.String())
			}
		})
	}
}

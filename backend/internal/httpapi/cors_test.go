package httpapi

import (
	"context"
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
	handler := WithCORS(NewHandler(verifier, testProfileReader{profile: profile}, reader), []string{"http://localhost:8081", " http://127.0.0.1:8081 "})
	tests := []struct {
		name, method, origin, preflightMethod, headers, token string
		status                                                int
		wantQuery                                             bool
	}{
		{"preflight", "OPTIONS", "http://localhost:8081", "GET", "authorization", "", 204, false},
		{"header case and spacing", "OPTIONS", "http://127.0.0.1:8081", "GET", " Authorization, Accept ", "", 204, false},
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

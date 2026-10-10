package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

func TestRequireIdentity(t *testing.T) {
	key := testPrivateKey(t)
	verifier, _ := testVerifier(t, key)
	validToken := signedToken(t, key, "first", fixtureClaims())
	tests := []struct {
		name   string
		header []string
		status int
	}{
		{"valid", []string{"Bearer " + validToken}, http.StatusOK},
		{"case insensitive scheme", []string{"bearer " + validToken}, http.StatusOK},
		{"missing", nil, http.StatusUnauthorized},
		{"wrong scheme", []string{"Basic secret"}, http.StatusUnauthorized},
		{"empty bearer", []string{"Bearer "}, http.StatusUnauthorized},
		{"malformed", []string{"Bearer secret-invalid-token"}, http.StatusUnauthorized},
		{"extra token", []string{"Bearer " + validToken + " extra"}, http.StatusUnauthorized},
		{"multiple headers", []string{"Bearer " + validToken, "Bearer " + validToken}, http.StatusUnauthorized},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			called := false
			handler := verifier.RequireIdentity(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				identity, ok := IdentityFromContext(r.Context())
				if !ok || identity.AuthUserID != fixtureUserID {
					t.Fatal("handler did not receive verified identity")
				}
				w.WriteHeader(http.StatusOK)
			}))
			request := httptest.NewRequest(http.MethodGet, "/auth/check?auth_user_id=someone-else", nil)
			for _, header := range test.header {
				request.Header.Add("Authorization", header)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != test.status || called != (test.status == http.StatusOK) {
				t.Fatalf("status = %d, handler called = %v", response.Code, called)
			}
			if test.status == http.StatusUnauthorized {
				var body httpresponse.ErrorResponse
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body.Error.Code != "unauthenticated" {
					t.Fatal("missing consistent JSON error")
				}
				if response.Header().Get("WWW-Authenticate") != "Bearer" || response.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("missing authentication response headers")
				}
				if strings.Contains(response.Body.String(), "secret") || strings.Contains(response.Body.String(), validToken) {
					t.Fatal("error exposed credentials")
				}
			}
		})
	}
	verifier, _ = testVerifierWithSetup(t, key, func(state *keyServer) {
		state.status.Store(http.StatusServiceUnavailable)
	}, time.Hour)
	request := httptest.NewRequest(http.MethodGet, "/auth/check", nil)
	request.Header.Set("Authorization", "Bearer "+validToken)
	response := httptest.NewRecorder()
	verifier.RequireIdentity(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("handler ran during key-source failure")
	})).ServeHTTP(response, request)
	var body httpresponse.ErrorResponse
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || response.Code != http.StatusServiceUnavailable || body.Error.Code != "auth_unavailable" {
		t.Fatal("key outage did not produce controlled 503 error")
	}
}

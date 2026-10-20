package httpapi

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
)

func TestHealthEndpoint(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	response := httptest.NewRecorder()

	NewHandler(&auth.Verifier{}, nil, nil, nil).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if contentType := response.Header().Get("Content-Type"); contentType != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", contentType)
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if body.Status != "ok" {
		t.Fatalf("status field = %q, want ok", body.Status)
	}
}

type keyTransportFunc func(*http.Request) (*http.Response, error)

func (f keyTransportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type diagnosticProfiles struct {
	profile database.Profile
}

func (p *diagnosticProfiles) ProfileByAuthUserID(_ context.Context, id string) (database.Profile, error) {
	if id != p.profile.AuthUserID {
		return database.Profile{}, database.ErrProfileNotFound
	}
	return p.profile, nil
}

func testDiagnosticVerifier(t *testing.T) (*auth.Verifier, func(string, time.Time) string) {
	t.Helper()
	// Serve a synthetic public key through the verifier's HTTP transport; no real
	// Supabase token or private project credential is needed for this router test.
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	jwks, err := json.Marshal(map[string]any{"keys": []map[string]string{{
		"kid": "diagnostic", "kty": "EC", "alg": "ES256", "use": "sig", "crv": "P-256",
		"x": base64.RawURLEncoding.EncodeToString(key.X.FillBytes(make([]byte, 32))),
		"y": base64.RawURLEncoding.EncodeToString(key.Y.FillBytes(make([]byte, 32))),
	}}})
	if err != nil {
		t.Fatal(err)
	}
	previous := http.DefaultTransport
	http.DefaultTransport = keyTransportFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != auth.DevelopmentIssuer+"/.well-known/jwks.json" {
			return nil, fmt.Errorf("unexpected key discovery URL")
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(string(jwks)))}, nil
	})
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(func() { cancel(); http.DefaultTransport = previous })
	verifier, err := auth.NewDevelopment(ctx)
	if err != nil {
		t.Fatal(err)
	}
	return verifier, func(subject string, expiry time.Time) string {
		t.Helper()
		token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
			"iss": auth.DevelopmentIssuer, "aud": "authenticated", "sub": subject,
			"role": "authenticated", "exp": expiry.Unix(),
		})
		token.Header["kid"] = "diagnostic"
		bearer, err := token.SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return bearer
	}
}

func TestChargeDiagnosticResponse(t *testing.T) {
	verifier, sign := testDiagnosticVerifier(t)
	profiles := &diagnosticProfiles{profile: database.Profile{
		ID:         "10000000-0000-0000-0000-000000000001",
		AuthUserID: "20000000-0000-0000-0000-000000000001", Role: "charge_nurse",
	}}
	bearer := sign(profiles.profile.AuthUserID, time.Now().Add(time.Hour))
	handler := NewHandler(verifier, profiles, nil, nil)
	request := httptest.NewRequest(http.MethodGet, "/auth/charge-check?profile_id=other", nil)
	request.Header.Set("Authorization", "Bearer "+bearer)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	var body map[string]string
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || response.Code != http.StatusOK ||
		len(body) != 2 || body["profile_id"] != profiles.profile.ID || body["role"] != "charge_nurse" {
		t.Fatalf("unexpected charge diagnostic: %d %s", response.Code, response.Body.String())
	}
	profiles.profile.Role = "regular_nurse"
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatal("charge route did not reject a regular nurse")
	}
	request.URL.Path = "/auth/check"
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || response.Code != http.StatusOK || body["auth_user_id"] != profiles.profile.AuthUserID {
		t.Fatal("authentication-only diagnostic rejected regular nurse or changed response")
	}
}

func TestHealthRouting(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
	}{
		{"unsupported method", http.MethodPost, "/health", http.StatusMethodNotAllowed},
		{"template list unsupported method", http.MethodPatch, "/floor-templates", http.StatusMethodNotAllowed},
		{"unsupported template read", http.MethodGet, "/floor-templates/missing", http.StatusMethodNotAllowed},
		{"unknown path", http.MethodGet, "/missing", http.StatusNotFound},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(test.method, test.path, nil)
			response := httptest.NewRecorder()
			NewHandler(&auth.Verifier{}, nil, nil, nil).ServeHTTP(response, request)

			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, test.wantStatus)
			}
		})
	}
}

func TestAuthCheckRejectsUnauthenticatedRequest(t *testing.T) {
	for _, path := range []string{"/auth/check", "/auth/charge-check", "/floor-templates"} {
		for _, authorization := range []string{"", "Bearer invalid-token"} {
			request := httptest.NewRequest(http.MethodGet, path, nil)
			request.Header.Set("Authorization", authorization)
			response := httptest.NewRecorder()
			NewHandler(&auth.Verifier{}, nil, nil, nil).ServeHTTP(response, request)
			if response.Code != http.StatusUnauthorized || response.Header().Get("Content-Type") != "application/json" {
				t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
			}
		}
	}
}

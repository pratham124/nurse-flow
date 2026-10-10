package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
)

func TestHealthEndpoint(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	response := httptest.NewRecorder()

	newHandler(&auth.Verifier{}).ServeHTTP(response, request)

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

func TestHealthRouting(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
	}{
		{"unsupported method", http.MethodPost, "/health", http.StatusMethodNotAllowed},
		{"unknown path", http.MethodGet, "/missing", http.StatusNotFound},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(test.method, test.path, nil)
			response := httptest.NewRecorder()
			newHandler(&auth.Verifier{}).ServeHTTP(response, request)

			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, test.wantStatus)
			}
		})
	}
}

func TestAuthCheckRejectsUnauthenticatedRequest(t *testing.T) {
	for _, authorization := range []string{"", "Bearer invalid-token"} {
		request := httptest.NewRequest(http.MethodGet, "/auth/check", nil)
		request.Header.Set("Authorization", authorization)
		response := httptest.NewRecorder()
		newHandler(&auth.Verifier{}).ServeHTTP(response, request)
		if response.Code != http.StatusUnauthorized || response.Header().Get("Content-Type") != "application/json" {
			t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
		}
	}
}

package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

type profileReaderFunc func(context.Context, string) (database.Profile, error)

func (f profileReaderFunc) ProfileByAuthUserID(ctx context.Context, id string) (database.Profile, error) {
	return f(ctx, id)
}

func TestRequireChargeNurse(t *testing.T) {
	key := testPrivateKey(t)
	verifier, _ := testVerifier(t, key)
	token := signedToken(t, key, "first", fixtureClaims())
	charge := database.Profile{ID: "10000000-0000-0000-0000-000000000001", AuthUserID: fixtureUserID, Role: "charge_nurse"}
	regular := charge
	regular.Role = "regular_nurse"
	unknownRole := charge
	unknownRole.Role = "administrator"
	wrongOwner := charge
	wrongOwner.AuthUserID = "5e7093ff-d8ea-4734-ae77-73a3906f936e"
	missingID := charge
	missingID.ID = ""
	tests := []struct {
		name    string
		profile database.Profile
		err     error
		status  int
		code    string
	}{
		{"charge nurse", charge, nil, http.StatusOK, ""},
		{"regular nurse", regular, nil, http.StatusForbidden, "forbidden"},
		{"unknown role", unknownRole, nil, http.StatusForbidden, "forbidden"},
		{"missing profile", database.Profile{}, database.ErrProfileNotFound, http.StatusForbidden, "profile_missing"},
		{"database failure", database.Profile{}, errors.New("secret driver connection detail"), http.StatusServiceUnavailable, "database_unavailable"},
		{"wrong owner", wrongOwner, nil, http.StatusInternalServerError, "internal_error"},
		{"missing profile ID", missingID, nil, http.StatusInternalServerError, "internal_error"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			lookups, calls := 0, 0
			profiles := profileReaderFunc(func(ctx context.Context, id string) (database.Profile, error) {
				lookups++
				if id != fixtureUserID || ctx == nil {
					t.Fatal("lookup did not receive verified identity and request context")
				}
				return test.profile, test.err
			})
			handler := verifier.RequireIdentity(RequireChargeNurse(profiles, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				profile, ok := ProfileFromContext(r.Context())
				if !ok || profile.ID != charge.ID || profile.AuthUserID != fixtureUserID || profile.Role != "charge_nurse" {
					t.Fatal("protected handler did not receive authorized application profile")
				}
				httpresponse.WriteJSON(w, http.StatusOK, struct {
					ProfileID string `json:"profile_id"`
				}{ProfileID: profile.ID})
			})))
			request := httptest.NewRequest(http.MethodGet, "/auth/charge-check?auth_user_id=other&profile_id=other&role=charge_nurse", nil)
			request.Header.Set("Authorization", "Bearer "+token)
			request.Header.Set("X-Profile-ID", "other")
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != test.status || lookups != 1 || (calls == 1) != (test.status == http.StatusOK) {
				t.Fatalf("status=%d, lookups=%d, handler calls=%d, body=%s", response.Code, lookups, calls, response.Body.String())
			}
			if response.Header().Get("Content-Type") != "application/json" || response.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("missing consistent JSON response headers")
			}
			if test.code != "" {
				var body httpresponse.ErrorResponse
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body.Error.Code != test.code {
					t.Fatal("unexpected error response")
				}
				if strings.Contains(response.Body.String(), "secret") {
					t.Fatal("database details leaked into public error")
				}
			}
		})
	}
	for _, header := range []string{"", "Bearer invalid-token"} {
		request := httptest.NewRequest(http.MethodGet, "/auth/charge-check", nil)
		request.Header.Set("Authorization", header)
		response := httptest.NewRecorder()
		profiles := profileReaderFunc(func(context.Context, string) (database.Profile, error) {
			t.Fatal("unverified request reached database")
			return database.Profile{}, nil
		})
		verifier.RequireIdentity(RequireChargeNurse(profiles, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			t.Fatal("unverified request reached handler")
		}))).ServeHTTP(response, request)
		if response.Code != http.StatusUnauthorized {
			t.Fatal("unverified request was not rejected")
		}
	}
}

func TestChargeNurseRoleIsReadOnEveryRequest(t *testing.T) {
	key := testPrivateKey(t)
	verifier, _ := testVerifier(t, key)
	token := signedToken(t, key, "first", fixtureClaims())
	role := "charge_nurse"
	lookups := 0
	profiles := profileReaderFunc(func(context.Context, string) (database.Profile, error) {
		lookups++
		return database.Profile{ID: "profile", AuthUserID: fixtureUserID, Role: role}, nil
	})
	handler := verifier.RequireIdentity(RequireChargeNurse(profiles, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))
	for _, status := range []int{http.StatusOK, http.StatusForbidden} {
		request := httptest.NewRequest(http.MethodGet, "/auth/charge-check", nil)
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != status {
			t.Fatalf("status=%d, want=%d", response.Code, status)
		}
		role = "regular_nurse"
	}
	if lookups != 2 {
		t.Fatal("profile role was cached between requests")
	}
}

func TestRequireChargeNurseWithoutIdentity(t *testing.T) {
	profiles := profileReaderFunc(func(context.Context, string) (database.Profile, error) {
		t.Fatal("missing verified identity reached database")
		return database.Profile{}, nil
	})
	response := httptest.NewRecorder()
	RequireChargeNurse(profiles, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("missing verified identity reached handler")
	})).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/", nil))
	if response.Code != http.StatusInternalServerError {
		t.Fatal("missing authentication middleware did not fail closed")
	}
	if _, ok := ProfileFromContext(context.Background()); ok {
		t.Fatal("absent profile context reported success")
	}
}

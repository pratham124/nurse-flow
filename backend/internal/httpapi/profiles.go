package httpapi

import (
	"context"
	"errors"
	"io"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

// ProfileStore creates the caller's application profile on first sign-in.
// Loading a profile uses the auth.ProfileReader that NewHandler already receives.
type ProfileStore interface {
	EnsureProfile(ctx context.Context, authUserID, displayName string) (database.Profile, error)
}

// registerProfileRoutes needs only a verified identity: a first sign-in has no profile yet.
func registerProfileRoutes(mux *http.ServeMux, verifier *auth.Verifier, profiles auth.ProfileReader, store ProfileStore) {
	mux.Handle("GET /profile", verifier.RequireIdentity(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity, ok := auth.IdentityFromContext(r.Context())
		if !ok || !requireNoBody(w, r) {
			return
		}
		profile, err := profiles.ProfileByAuthUserID(r.Context(), identity.AuthUserID)
		if errors.Is(err, database.ErrProfileNotFound) {
			httpresponse.WriteError(w, http.StatusNotFound, "profile_missing", "A NurseFlow profile is required.")
			return
		}
		if err != nil {
			writeProfileUnavailable(w)
			return
		}
		writeProfile(w, profile)
	})))
	mux.Handle("PUT /profile", verifier.RequireIdentity(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity, ok := auth.IdentityFromContext(r.Context())
		if !ok || !requireNoBody(w, r) {
			return
		}
		profile, err := store.EnsureProfile(r.Context(), identity.AuthUserID, identity.ProfileName())
		if err != nil {
			writeProfileUnavailable(w)
			return
		}
		writeProfile(w, profile)
	})))
}

func writeProfile(w http.ResponseWriter, profile database.Profile) {
	httpresponse.WriteJSON(w, http.StatusOK, struct {
		Profile database.Profile `json:"profile"`
	}{profile})
}

func writeProfileUnavailable(w http.ResponseWriter) {
	httpresponse.WriteError(w, http.StatusServiceUnavailable, "database_unavailable", "Profile lookup is temporarily unavailable. Try again.")
}

// requireNoBody rejects requests that try to send a name, role, or identity.
func requireNoBody(w http.ResponseWriter, r *http.Request) bool {
	// A limit of 0 makes even one byte an error, so only an empty body passes.
	if _, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 0)); err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_profile", "This request does not take a body.")
		return false
	}
	return true
}

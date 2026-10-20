package auth

import (
	"context"
	"errors"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

// ProfileReader is the one database operation needed by profile authorization.
type ProfileReader interface {
	ProfileByAuthUserID(context.Context, string) (database.Profile, error)
}

type profileContextKey struct{}

// ProfileFromContext retrieves the charge-nurse profile authorized by RequireChargeNurse.
func ProfileFromContext(ctx context.Context) (database.Profile, bool) {
	profile, ok := ctx.Value(profileContextKey{}).(database.Profile)
	return profile, ok
}

// RequireChargeNurse must run after RequireIdentity. It reads the current database
// role on every request; the token's authenticated claim is not a nurse role.
func RequireChargeNurse(profiles ProfileReader, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity, ok := IdentityFromContext(r.Context())
		if !ok || identity.AuthUserID == "" {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
			return
		}
		profile, err := profiles.ProfileByAuthUserID(r.Context(), identity.AuthUserID)
		if errors.Is(err, database.ErrProfileNotFound) {
			httpresponse.WriteError(w, http.StatusForbidden, "profile_missing", "A NurseFlow profile is required.")
			return
		}
		if err != nil {
			httpresponse.WriteError(w, http.StatusServiceUnavailable, "database_unavailable", "Profile lookup is temporarily unavailable. Try again.")
			return
		}
		if profile.ID == "" || profile.AuthUserID != identity.AuthUserID {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
			return
		}
		if profile.Role != "charge_nurse" {
			httpresponse.WriteError(w, http.StatusForbidden, "forbidden", "A charge-nurse profile is required.")
			return
		}
		ctx := context.WithValue(r.Context(), profileContextKey{}, profile)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

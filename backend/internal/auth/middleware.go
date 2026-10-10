package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

type identityContextKey struct{}

func IdentityFromContext(ctx context.Context) (Identity, bool) {
	identity, ok := ctx.Value(identityContextKey{}).(Identity)
	return identity, ok
}

// RequireIdentity verifies the bearer token before calling the protected handler.
func (v *Verifier) RequireIdentity(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headers := r.Header.Values("Authorization")
		if len(headers) != 1 {
			writeUnauthorized(w)
			return
		}
		parts := strings.Fields(headers[0])
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			writeUnauthorized(w)
			return
		}
		identity, err := v.Verify(r.Context(), parts[1])
		if err != nil {
			if errors.Is(err, ErrUnavailable) {
				httpresponse.WriteError(w, http.StatusServiceUnavailable, "auth_unavailable", "Authentication is temporarily unavailable. Try again.")
			} else {
				writeUnauthorized(w)
			}
			return
		}
		ctx := context.WithValue(r.Context(), identityContextKey{}, identity)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", "Bearer")
	httpresponse.WriteError(w, http.StatusUnauthorized, "unauthenticated", "A valid access token is required.")
}

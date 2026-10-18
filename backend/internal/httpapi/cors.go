package httpapi

import (
	"net/http"
	"strings"

	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

// WithCORS permits browser reads from exact configured origins. Token and role
// checks still run for the actual request; preflight does not access user data.
func WithCORS(next http.Handler, origins []string) http.Handler {
	allowed := make(map[string]bool, len(origins))
	for _, origin := range origins {
		if origin = strings.TrimSpace(origin); origin != "" {
			allowed[origin] = true
		}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		origin := r.Header.Get("Origin")
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}
		if !allowed[origin] {
			httpresponse.WriteError(w, http.StatusForbidden, "origin_forbidden", "This web origin is not allowed.")
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			w.Header().Add("Vary", "Access-Control-Request-Method")
			w.Header().Add("Vary", "Access-Control-Request-Headers")
			if r.Header.Get("Access-Control-Request-Method") != http.MethodGet {
				httpresponse.WriteError(w, http.StatusForbidden, "cors_forbidden", "This web request is not allowed.")
				return
			}
			for _, header := range strings.Split(r.Header.Get("Access-Control-Request-Headers"), ",") {
				switch strings.ToLower(strings.TrimSpace(header)) {
				case "", "authorization", "accept":
				default:
					httpresponse.WriteError(w, http.StatusForbidden, "cors_forbidden", "This web request is not allowed.")
					return
				}
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Accept")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

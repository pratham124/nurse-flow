package httpapi

import (
	"net/http"
	"slices"
	"strings"

	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
	"github.com/rs/cors"
)

// WithCORS permits browser requests from exact configured origins. Token and role
// checks still run for the actual request; preflight does not access user data.
func WithCORS(next http.Handler, origins []string) http.Handler {
	allowed := make(map[string]bool, len(origins))
	for _, origin := range origins {
		if origin = strings.TrimSpace(origin); origin != "" {
			allowed[origin] = true
		}
	}
	policy := cors.New(cors.Options{
		// A callback preserves exact matching and denies every origin when the
		// allowlist is empty; the library's default is to allow all origins.
		AllowOriginFunc:    func(origin string) bool { return allowed[origin] },
		AllowedMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete},
		AllowedHeaders:     []string{"Authorization", "Accept", "Content-Type"},
		OptionsPassthrough: true,
	})
	handler := policy.Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}
		if !allowed[origin] {
			httpresponse.WriteError(w, http.StatusForbidden, "origin_forbidden", "This web origin is not allowed.")
			return
		}
		// The library omits permission headers on failed preflights. Preserve our
		// JSON 403 response and allow the configured origin to read that error.
		permitted := w.Header().Get("Access-Control-Allow-Origin") != ""
		w.Header().Set("Access-Control-Allow-Origin", origin)
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			// rs/cors always permits OPTIONS itself; our API only advertises
			// GET, POST, PUT, and DELETE as requested application methods.
			if !permitted || r.Header.Get("Access-Control-Request-Method") == http.MethodOptions {
				w.Header().Del("Access-Control-Allow-Methods")
				w.Header().Del("Access-Control-Allow-Headers")
				httpresponse.WriteError(w, http.StatusForbidden, "cors_forbidden", "This web request is not allowed.")
				return
			}
			// Keep the existing advertised lists, rather than echoing only the
			// requested method and headers as the library normally does.
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Accept, Content-Type")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	}))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			// Browsers send sorted lowercase names. Normalize other clients too,
			// preserving our previous tolerance for case, spacing, and duplicates.
			r = r.Clone(r.Context())
			names := []string{}
			for _, name := range strings.Split(r.Header.Get("Access-Control-Request-Headers"), ",") {
				if name = strings.ToLower(strings.TrimSpace(name)); name != "" {
					names = append(names, name)
				}
			}
			slices.Sort(names)
			r.Header.Set("Access-Control-Request-Headers", strings.Join(slices.Compact(names), ","))
		}
		handler.ServeHTTP(w, r)
	})
}

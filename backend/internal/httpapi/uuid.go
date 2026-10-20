package httpapi

import (
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
	"github.com/pratham124/nurse-flow/backend/internal/identifiers"
)

// requireUUID checks that the route's {id} parameter has UUID format.
func requireUUID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !identifiers.ValidUUID(r.PathValue("id")) {
			httpresponse.WriteError(w, http.StatusBadRequest, "invalid_id", "The ID must be a UUID.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

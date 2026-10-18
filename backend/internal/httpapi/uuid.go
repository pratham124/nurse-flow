package httpapi

import (
	"net/http"
	"regexp"

	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// requireUUID checks that the route's {id} parameter has UUID format.
func requireUUID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !uuidPattern.MatchString(r.PathValue("id")) {
			httpresponse.WriteError(w, http.StatusBadRequest, "invalid_id", "The ID must be a UUID.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

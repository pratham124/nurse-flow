package httpapi

import (
	"context"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

// JoinedWorkspaceStore supplies a joined nurse's view of another charge nurse's shift.
type JoinedWorkspaceStore interface {
	JoinedWorkspace(ctx context.Context, authUserID, profileID string) (*database.JoinedAssignment, error)
}

func registerJoinedWorkspaceRoutes(mux *http.ServeMux, verifier *auth.Verifier, profiles auth.ProfileReader, store JoinedWorkspaceStore) {
	mux.Handle("GET /joined-workspace", verifier.RequireIdentity(auth.RequireChargeNurse(profiles, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, _ := auth.ProfileFromContext(r.Context())
		assignment, err := store.JoinedWorkspace(r.Context(), profile.AuthUserID, profile.ID)
		if err != nil {
			httpresponse.WriteError(w, http.StatusServiceUnavailable, "database_unavailable", "The joined workspace is temporarily unavailable. Try again.")
			return
		}
		httpresponse.WriteJSON(w, http.StatusOK, struct {
			Assignment *database.JoinedAssignment `json:"assignment"`
		}{assignment})
	}))))
}

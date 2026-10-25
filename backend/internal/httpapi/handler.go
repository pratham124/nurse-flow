// Package httpapi assembles the API routes and their HTTP handlers.
package httpapi

import (
	"fmt"
	"log"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

// NewHandler connects the routes to the supplied verifier and database stores.
func NewHandler(verifier *auth.Verifier, profiles auth.ProfileReader, templates FloorTemplateStore, shifts ShiftStore, profileStore ProfileStore, inviteStore InviteStore, joinedStore JoinedWorkspaceStore, requestStore RequestStore, threadStore ThreadStore) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler)
	mux.Handle("GET /auth/check", verifier.RequireIdentity(http.HandlerFunc(authCheckHandler)))
	mux.Handle("GET /auth/charge-check", verifier.RequireIdentity(auth.RequireChargeNurse(profiles, http.HandlerFunc(chargeCheckHandler))))
	mux.Handle("GET /floor-templates", verifier.RequireIdentity(auth.RequireChargeNurse(profiles, floorTemplatesHandler(templates))))
	mux.Handle("POST /floor-templates", verifier.RequireIdentity(auth.RequireChargeNurse(profiles, saveFloorTemplateHandler(templates))))
	mux.Handle("PUT /floor-templates/{id}", verifier.RequireIdentity(auth.RequireChargeNurse(profiles, requireUUID(saveFloorTemplateHandler(templates)))))
	mux.Handle("DELETE /floor-templates/{id}", verifier.RequireIdentity(auth.RequireChargeNurse(profiles, requireUUID(deleteFloorTemplateHandler(templates)))))
	registerShiftRoutes(mux, verifier, profiles, shifts)
	registerProfileRoutes(mux, verifier, profiles, profileStore)
	registerInviteRoutes(mux, verifier, profiles, inviteStore)
	registerJoinedWorkspaceRoutes(mux, verifier, profiles, joinedStore)
	registerRequestRoutes(mux, verifier, profiles, requestStore)
	registerThreadRoutes(mux, verifier, profiles, threadStore)
	return mux
}

// This diagnostic route proves authentication only; regular nurses can use it too.
func authCheckHandler(w http.ResponseWriter, r *http.Request) {
	identity, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
		return
	}
	httpresponse.WriteJSON(w, http.StatusOK, struct {
		AuthUserID string `json:"auth_user_id"`
	}{AuthUserID: identity.AuthUserID})
}

func chargeCheckHandler(w http.ResponseWriter, r *http.Request) {
	profile, ok := auth.ProfileFromContext(r.Context())
	if !ok {
		httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
		return
	}
	httpresponse.WriteJSON(w, http.StatusOK, struct {
		ProfileID string `json:"profile_id"`
		Role      string `json:"role"`
	}{ProfileID: profile.ID, Role: profile.Role})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if _, err := fmt.Fprintln(w, `{"status":"ok"}`); err != nil {
		log.Print("Could not write health response")
	}
}

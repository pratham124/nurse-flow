package httpapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
	"github.com/pratham124/nurse-flow/backend/internal/invites"
)

// InviteStore supplies nurse invites for charge nurses and joining by invite code.
type InviteStore interface {
	ListInvites(ctx context.Context, authUserID, profileID, shiftID string) (database.InviteList, error)
	CreateInvite(ctx context.Context, authUserID, profileID, shiftID, nurseID, tokenHash string) (database.InviteRow, error)
	RegenerateInvite(ctx context.Context, authUserID, profileID, shiftID, nurseID, tokenHash string) (database.InviteRow, error)
	ValidateInvite(ctx context.Context, authUserID, profileID, tokenHash string) (database.InviteValidation, error)
	AcceptInvite(ctx context.Context, authUserID, profileID, tokenHash string) (database.InviteJoin, error)
}

func registerInviteRoutes(mux *http.ServeMux, verifier *auth.Verifier, profiles auth.ProfileReader, store InviteStore) {
	protect := func(handler http.Handler) http.Handler {
		return verifier.RequireIdentity(auth.RequireChargeNurse(profiles, handler))
	}
	mux.Handle("GET /shifts/{id}/invites", protect(requireUUID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, _ := auth.ProfileFromContext(r.Context())
		list, err := store.ListInvites(r.Context(), profile.AuthUserID, profile.ID, r.PathValue("id"))
		if err != nil {
			writeInviteError(w, err)
			return
		}
		httpresponse.WriteJSON(w, http.StatusOK, list)
	}))))
	mux.Handle("POST /shifts/{id}/invites", protect(requireUUID(createInviteHandler(func(ctx context.Context, authUserID, profileID, shiftID, nurseID, tokenHash string) (database.InviteRow, error) {
		return store.CreateInvite(ctx, authUserID, profileID, shiftID, nurseID, tokenHash)
	}))))
	mux.Handle("POST /shifts/{id}/invites/regenerate", protect(requireUUID(createInviteHandler(func(ctx context.Context, authUserID, profileID, shiftID, nurseID, tokenHash string) (database.InviteRow, error) {
		return store.RegenerateInvite(ctx, authUserID, profileID, shiftID, nurseID, tokenHash)
	}))))

	mux.Handle("POST /invites/validate", protect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hash, ok := readInviteCodeHash(w, r)
		if !ok {
			return
		}
		if hash == "" {
			httpresponse.WriteJSON(w, http.StatusOK, database.InviteValidation{Status: invites.StatusBlocked, Reason: invites.ReasonInvalidFormat})
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		result, err := store.ValidateInvite(r.Context(), profile.AuthUserID, profile.ID, hash)
		if err != nil {
			writeInviteError(w, err)
			return
		}
		httpresponse.WriteJSON(w, http.StatusOK, result)
	})))
	mux.Handle("POST /invites/accept", protect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hash, ok := readInviteCodeHash(w, r)
		if !ok {
			return
		}
		if hash == "" {
			httpresponse.WriteJSON(w, http.StatusOK, database.InviteJoin{Status: invites.StatusBlocked, Reason: invites.ReasonInvalidFormat})
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		result, err := store.AcceptInvite(r.Context(), profile.AuthUserID, profile.ID, hash)
		if err != nil {
			writeInviteError(w, err)
			return
		}
		httpresponse.WriteJSON(w, http.StatusOK, result)
	})))
}

// createInviteHandler serves both generate and regenerate; they differ only in the store method.
func createInviteHandler(create func(ctx context.Context, authUserID, profileID, shiftID, nurseID, tokenHash string) (database.InviteRow, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			NurseID string `json:"nurse_id"`
		}
		if !decodeInviteRequest(w, r, &body) {
			return
		}
		// Any other unknown ID is rejected by the store's on-shift check.
		if body.NurseID == "" {
			httpresponse.WriteError(w, http.StatusBadRequest, "invalid_invite", "Choose a nurse from the active shift before creating an invite.")
			return
		}
		code, err := invites.GenerateCode()
		if err != nil {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		invite, err := create(r.Context(), profile.AuthUserID, profile.ID, r.PathValue("id"), body.NurseID, invites.HashCode(code))
		if err != nil {
			writeInviteError(w, err)
			return
		}
		// This is the only time the raw code is sent; it is never logged or stored.
		httpresponse.WriteJSON(w, http.StatusCreated, struct {
			Code   string             `json:"code"`
			Invite database.InviteRow `json:"invite"`
		}{code, invite})
	})
}

// readInviteCodeHash returns the hash of the submitted code, or "" when the code
// has the wrong format. ok is false when the request itself was rejected.
func readInviteCodeHash(w http.ResponseWriter, r *http.Request) (hash string, ok bool) {
	var body struct {
		Code string `json:"code"`
	}
	if !decodeInviteRequest(w, r, &body) {
		return "", false
	}
	code := invites.NormalizeCode(body.Code)
	if !invites.ValidCode(code) {
		return "", true
	}
	return invites.HashCode(code), true
}

func decodeInviteRequest(w http.ResponseWriter, r *http.Request, body any) bool {
	return decodeOrReject(w, r, body, jsonRejection{
		mediaTypeMessage: "Send invite requests as application/json.",
		tooLargeCode:     "request_too_large",
		tooLargeMessage:  "The request is too large.",
		invalidCode:      "invalid_invite",
		invalidMessage:   "Send one valid invite request with only the expected fields.",
	})
}

func writeInviteError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, database.ErrShiftNotFound):
		httpresponse.WriteError(w, http.StatusNotFound, "shift_not_found", "This shift is no longer available. Refresh and try again.")
	case errors.Is(err, database.ErrShiftEnded):
		httpresponse.WriteError(w, http.StatusConflict, "shift_ended", "Nurse invites can only be created for an active shift.")
	case errors.Is(err, database.ErrNurseNotOnShift):
		httpresponse.WriteError(w, http.StatusUnprocessableEntity, "nurse_not_on_shift", "Choose a nurse from the active shift before creating an invite.")
	case errors.Is(err, database.ErrNurseUnassigned):
		httpresponse.WriteError(w, http.StatusUnprocessableEntity, "nurse_unassigned", "Assign at least one patient to this nurse before generating a code.")
	case errors.Is(err, database.ErrInviteExists):
		httpresponse.WriteError(w, http.StatusConflict, "invite_exists", "This nurse already has an active invite for this shift.")
	default:
		httpresponse.WriteError(w, http.StatusServiceUnavailable, "database_unavailable", "Nurse invites are temporarily unavailable. Try again.")
	}
}

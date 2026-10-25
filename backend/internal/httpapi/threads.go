package httpapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
)

// ThreadStore reads and appends nurse request thread messages. The caller's
// profile is always taken from the verified token, never from the request body.
type ThreadStore interface {
	ListThreadMessages(ctx context.Context, authUserID, profileID, shiftID, requestID string) ([]database.ThreadMessage, error)
	AppendThreadMessage(ctx context.Context, authUserID, profileID, shiftID, requestID, body, clientMutationID string) (message database.ThreadMessage, duplicate bool, err error)
}

// registerThreadRoutes serves a request's message thread to the charge nurse who
// owns the shift and to the joined nurse who made the request. Every app profile
// passes RequireChargeNurse, so joined nurses use the same routes.
func registerThreadRoutes(mux *http.ServeMux, verifier *auth.Verifier, profiles auth.ProfileReader, threads ThreadStore) {
	protect := func(handler http.Handler) http.Handler {
		return verifier.RequireIdentity(auth.RequireChargeNurse(profiles, requireUUID(handler)))
	}
	mux.Handle("GET /shifts/{id}/requests/{requestId}/messages", protect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, _ := auth.ProfileFromContext(r.Context())
		messages, err := threads.ListThreadMessages(r.Context(), profile.AuthUserID, profile.ID, r.PathValue("id"), r.PathValue("requestId"))
		if err != nil {
			writeThreadError(w, err)
			return
		}
		httpresponse.WriteJSON(w, http.StatusOK, struct {
			Messages []database.ThreadMessage `json:"messages"`
		}{messages})
	})))
	mux.Handle("POST /shifts/{id}/requests/{requestId}/messages", protect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Body             string `json:"body"`
			ClientMutationID string `json:"client_mutation_id"`
		}
		if !decodeOrReject(w, r, &body, jsonRejection{
			mediaTypeMessage: "Send messages as application/json.",
			tooLargeCode:     "request_too_large",
			tooLargeMessage:  "The request is too large.",
			invalidCode:      "invalid_request",
			invalidMessage:   "Send one valid message with only the expected fields.",
		}) {
			return
		}
		text, mutationID, err := shifts.CleanMessage(body.Body, body.ClientMutationID)
		if err != nil {
			httpresponse.WriteError(w, http.StatusUnprocessableEntity, "invalid_request", err.Error())
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		message, duplicate, err := threads.AppendThreadMessage(r.Context(), profile.AuthUserID, profile.ID, r.PathValue("id"), r.PathValue("requestId"), text, mutationID)
		if err != nil {
			writeThreadError(w, err)
			return
		}
		status, code := "saved", http.StatusCreated
		if duplicate {
			status, code = "duplicate", http.StatusOK
		}
		httpresponse.WriteJSON(w, code, struct {
			Status  string                 `json:"status"`
			Message database.ThreadMessage `json:"message"`
		}{status, message})
	})))
}

func writeThreadError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, database.ErrThreadNotFound):
		httpresponse.WriteError(w, http.StatusNotFound, "thread_not_found", "You do not have access to this request thread.")
	case errors.Is(err, database.ErrMutationIDReused):
		httpresponse.WriteError(w, http.StatusConflict, "mutation_id_reused", "That message retry identifier was already used.")
	default:
		httpresponse.WriteError(w, http.StatusServiceUnavailable, "database_unavailable", "Request threads are temporarily unavailable. Try again.")
	}
}

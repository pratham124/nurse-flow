package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
)

// RequestStore supplies manual assignment moves and nurse requests.
type RequestStore interface {
	MoveAssignment(ctx context.Context, authUserID, profileID, shiftID string, request shifts.MoveRequest) (database.MoveOutcome, error)
	SubmitIssueRequest(ctx context.Context, authUserID, profileID, message string) (json.RawMessage, error)
	SubmitSwapRequest(ctx context.Context, authUserID, profileID, sourceBedID, message string) (json.RawMessage, error)
	UpdateIssueStatus(ctx context.Context, authUserID, profileID, shiftID, requestID, status string) (json.RawMessage, error)
	ResolveSwapRequest(ctx context.Context, authUserID, profileID, shiftID, requestID, status string) (json.RawMessage, error)
}

func registerRequestRoutes(mux *http.ServeMux, verifier *auth.Verifier, profiles auth.ProfileReader, store RequestStore) {
	protect := func(handler http.Handler) http.Handler {
		return verifier.RequireIdentity(auth.RequireChargeNurse(profiles, handler))
	}
	mux.Handle("POST /shifts/{id}/assignment-moves", protect(requireUUID(moveHandler(store))))
	mux.Handle("POST /joined-workspace/issue-requests", protect(issueRequestHandler(store)))
	mux.Handle("POST /joined-workspace/swap-requests", protect(swapRequestHandler(store)))
	mux.Handle("POST /shifts/{id}/requests/{requestId}/issue-status", protect(requireUUID(reviewHandler(shifts.ValidateIssueStatus, func(ctx context.Context, authUserID, profileID, shiftID, requestID, status string) (json.RawMessage, error) {
		return store.UpdateIssueStatus(ctx, authUserID, profileID, shiftID, requestID, status)
	}))))
	mux.Handle("POST /shifts/{id}/requests/{requestId}/swap-resolution", protect(requireUUID(reviewHandler(shifts.ValidateResolution, func(ctx context.Context, authUserID, profileID, shiftID, requestID, status string) (json.RawMessage, error) {
		return store.ResolveSwapRequest(ctx, authUserID, profileID, shiftID, requestID, status)
	}))))
}

func decodeRequestBody(w http.ResponseWriter, r *http.Request, body any) bool {
	return decodeOrReject(w, r, body, jsonRejection{
		mediaTypeMessage: "Send requests as application/json.",
		tooLargeCode:     "request_too_large",
		tooLargeMessage:  "The request is too large.",
		invalidCode:      "invalid_request",
		invalidMessage:   "Send one valid request with only the expected fields.",
	})
}

// writeRequest sends the stored request object, exactly as saved.
func writeRequest(w http.ResponseWriter, status int, request json.RawMessage) {
	httpresponse.WriteJSON(w, status, struct {
		Request json.RawMessage `json:"request"`
	}{request})
}

func moveHandler(store RequestStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			BaselineAssignmentResultID string          `json:"baseline_assignment_result_id"`
			BedID                      string          `json:"bed_id"`
			FromNurseID                string          `json:"from_nurse_id"`
			ToNurseID                  string          `json:"to_nurse_id"`
			WarningAcknowledgements    json.RawMessage `json:"warning_acknowledgements"`
			RelatedSwapRequestID       *string         `json:"related_swap_request_id"`
			ClientMutationID           string          `json:"client_mutation_id"`
		}
		if !decodeRequestBody(w, r, &body) {
			return
		}
		move := shifts.MoveRequest{
			BaselineAssignmentResultID: body.BaselineAssignmentResultID, BedID: body.BedID,
			FromNurseID: body.FromNurseID, ToNurseID: body.ToNurseID,
			WarningAcknowledgements: body.WarningAcknowledgements,
			RelatedSwapRequestID:    body.RelatedSwapRequestID, ClientMutationID: body.ClientMutationID,
		}
		if err := move.Validate(); err != nil {
			writeRequestError(w, err, "")
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		outcome, err := store.MoveAssignment(r.Context(), profile.AuthUserID, profile.ID, r.PathValue("id"), move)
		if err != nil {
			writeRequestError(w, err, "")
			return
		}
		httpresponse.WriteJSON(w, http.StatusOK, outcome.Body())
	})
}

func issueRequestHandler(store RequestStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Message string `json:"message"`
		}
		if !decodeRequestBody(w, r, &body) {
			return
		}
		if err := shifts.ValidateIssueMessage(body.Message); err != nil {
			writeRequestError(w, err, "")
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		request, err := store.SubmitIssueRequest(r.Context(), profile.AuthUserID, profile.ID, body.Message)
		if err != nil {
			writeRequestError(w, err, "Join a shift before submitting an issue.")
			return
		}
		writeRequest(w, http.StatusCreated, request)
	})
}

func swapRequestHandler(store RequestStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SourceBedID string `json:"source_bed_id"`
			Message     string `json:"message"`
		}
		if !decodeRequestBody(w, r, &body) {
			return
		}
		if err := shifts.ValidateSwapInput(body.SourceBedID, body.Message); err != nil {
			writeRequestError(w, err, "")
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		request, err := store.SubmitSwapRequest(r.Context(), profile.AuthUserID, profile.ID, body.SourceBedID, body.Message)
		if err != nil {
			writeRequestError(w, err, "Join a shift before submitting a swap request.")
			return
		}
		writeRequest(w, http.StatusCreated, request)
	})
}

// reviewHandler serves both issue-status and swap-resolution; they differ only in
// how the status is validated and which store method applies it.
func reviewHandler(
	validate func(status string) error,
	apply func(ctx context.Context, authUserID, profileID, shiftID, requestID, status string) (json.RawMessage, error),
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Status string `json:"status"`
		}
		if !decodeRequestBody(w, r, &body) {
			return
		}
		if err := validate(body.Status); err != nil {
			writeRequestError(w, err, "")
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		request, err := apply(r.Context(), profile.AuthUserID, profile.ID, r.PathValue("id"), r.PathValue("requestId"), body.Status)
		if err != nil {
			writeRequestError(w, err, "")
			return
		}
		writeRequest(w, http.StatusOK, request)
	})
}

// ruleStatuses maps the API code of a refused request to its HTTP status.
var ruleStatuses = map[string]int{
	"invalid_move":        http.StatusUnprocessableEntity,
	"invalid_request":     http.StatusUnprocessableEntity,
	"request_pending":     http.StatusConflict,
	"request_not_pending": http.StatusConflict,
	"invalid_transition":  http.StatusConflict,
	"request_not_found":   http.StatusNotFound,
}

// writeRequestError sends the right response for a refused or failed request.
// notJoinedMessage is the user-visible text for a caller with no joined shift.
func writeRequestError(w http.ResponseWriter, err error, notJoinedMessage string) {
	var rule *shifts.RuleError
	switch {
	case errors.As(err, &rule):
		status, known := ruleStatuses[rule.Code]
		if !known {
			status = http.StatusUnprocessableEntity
		}
		httpresponse.WriteError(w, status, rule.Code, rule.Message)
	case errors.Is(err, database.ErrShiftNotFound):
		httpresponse.WriteError(w, http.StatusNotFound, "shift_not_found", "This shift is no longer available. Refresh and try again.")
	case errors.Is(err, database.ErrShiftNotAssigned):
		httpresponse.WriteError(w, http.StatusConflict, "shift_not_assigned", "This shift is no longer available for assignment moves.")
	case errors.Is(err, database.ErrMoveConflict):
		httpresponse.WriteError(w, http.StatusConflict, "move_conflict", "This bed assignment changed. Review the current board and try again.")
	case errors.Is(err, database.ErrNotJoined):
		httpresponse.WriteError(w, http.StatusConflict, "not_joined", notJoinedMessage)
	case errors.Is(err, database.ErrShiftEnded):
		httpresponse.WriteError(w, http.StatusConflict, "shift_ended", "This shift is no longer active.")
	default:
		httpresponse.WriteError(w, http.StatusServiceUnavailable, "database_unavailable", "Requests are temporarily unavailable. Try again.")
	}
}

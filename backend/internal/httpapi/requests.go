package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
)

// RequestStore supplies manual assignment moves and nurse chats.
type RequestStore interface {
	MoveAssignment(ctx context.Context, authUserID, profileID, shiftID string, request shifts.MoveRequest) (database.MoveOutcome, error)
	OpenJoinedChat(ctx context.Context, authUserID, profileID string) (chat json.RawMessage, created bool, err error)
	OpenShiftNurseChat(ctx context.Context, authUserID, profileID, shiftID, nurseID string) (chat json.RawMessage, created bool, err error)
	LeaveJoinedShift(ctx context.Context, authUserID, profileID string) error
}

func registerRequestRoutes(mux *http.ServeMux, verifier *auth.Verifier, profiles auth.ProfileReader, store RequestStore) {
	protect := func(handler http.Handler) http.Handler {
		return verifier.RequireIdentity(auth.RequireChargeNurse(profiles, handler))
	}
	mux.Handle("POST /shifts/{id}/assignment-moves", protect(requireUUID(moveHandler(store))))
	mux.Handle("POST /joined-workspace/chat", protect(joinedChatHandler(store)))
	mux.Handle("POST /joined-workspace/leave", protect(leaveJoinedShiftHandler(store)))
	mux.Handle("POST /shifts/{id}/nurses/{nurseId}/chat", protect(requireUUID(shiftNurseChatHandler(store))))
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

// writeChat sends the chat entry: 201 when this call created it, 200 when it
// already existed.
func writeChat(w http.ResponseWriter, chat json.RawMessage, created bool) {
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	writeRequest(w, status, chat)
}

// joinedChatHandler opens the signed-in nurse's chat with charge. It takes no
// body: the nurse comes from the caller's linked shift access, never the client.
func joinedChatHandler(store RequestStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, _ := auth.ProfileFromContext(r.Context())
		chat, created, err := store.OpenJoinedChat(r.Context(), profile.AuthUserID, profile.ID)
		if err != nil {
			writeRequestError(w, err, "Join a shift before chatting with charge.")
			return
		}
		writeChat(w, chat, created)
	})
}

// leaveJoinedShiftHandler lets the signed-in nurse leave the shift they joined.
// It takes no body: the shift comes from the caller's own linked access.
func leaveJoinedShiftHandler(store RequestStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, _ := auth.ProfileFromContext(r.Context())
		if err := store.LeaveJoinedShift(r.Context(), profile.AuthUserID, profile.ID); err != nil {
			writeRequestError(w, err, "You are not on a shift.")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

// shiftNurseChatHandler opens the charge nurse's chat with one nurse.
func shiftNurseChatHandler(store RequestStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, _ := auth.ProfileFromContext(r.Context())
		nurseID := strings.TrimSpace(r.PathValue("nurseId"))
		chat, created, err := store.OpenShiftNurseChat(r.Context(), profile.AuthUserID, profile.ID, r.PathValue("id"), nurseID)
		if err != nil {
			writeRequestError(w, err, "")
			return
		}
		writeChat(w, chat, created)
	})
}

// ruleStatuses maps the API code of a refused request to its HTTP status.
var ruleStatuses = map[string]int{
	"invalid_move":    http.StatusUnprocessableEntity,
	"invalid_request": http.StatusUnprocessableEntity,
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
	case errors.Is(err, database.ErrNurseNotOnShift):
		httpresponse.WriteError(w, http.StatusNotFound, "nurse_not_found", "This nurse is no longer on this shift.")
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

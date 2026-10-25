package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
	"github.com/pratham124/nurse-flow/backend/internal/identifiers"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"github.com/pratham124/nurse-flow/backend/internal/templates"
)

// ShiftStore supplies the authorized reads and mutations used by shift handlers.
type ShiftStore interface {
	CurrentShift(context.Context, string, string) (*database.ActiveShift, error)
	PreviousShifts(context.Context, string, string) ([]database.PreviousShift, error)
	StartShift(context.Context, string, string, string) (database.ActiveShift, error)
	SaveShiftSetup(context.Context, string, string, string, time.Time, shifts.Setup) (database.ActiveShift, error)
	ReopenShift(context.Context, string, string, string, string) (database.ReopenResult, error)
	EndShift(context.Context, string, string, string) (database.ActiveShift, error)
}

func registerShiftRoutes(mux *http.ServeMux, verifier *auth.Verifier, profiles auth.ProfileReader, store ShiftStore) {
	protect := func(handler http.Handler) http.Handler {
		return verifier.RequireIdentity(auth.RequireChargeNurse(profiles, handler))
	}
	mux.Handle("GET /active-shifts/current", protect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, _ := auth.ProfileFromContext(r.Context())
		row, err := store.CurrentShift(r.Context(), profile.AuthUserID, profile.ID)
		if err != nil {
			writeShiftError(w, err)
			return
		}
		httpresponse.WriteJSON(w, http.StatusOK, struct {
			Shift *database.ActiveShift `json:"active_shift"`
		}{row})
	})))
	mux.Handle("GET /previous-shift-snapshots", protect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, _ := auth.ProfileFromContext(r.Context())
		rows, err := store.PreviousShifts(r.Context(), profile.AuthUserID, profile.ID)
		if err != nil {
			writeShiftError(w, err)
			return
		}
		if rows == nil {
			rows = []database.PreviousShift{}
		}
		httpresponse.WriteJSON(w, http.StatusOK, struct {
			Snapshots []database.PreviousShift `json:"snapshots"`
		}{rows})
	})))
	mux.Handle("POST /active-shifts", protect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			FloorTemplateID string `json:"floor_template_id"`
		}
		if !decodeShiftRequest(w, r, &body) {
			return
		}
		if !identifiers.ValidUUID(body.FloorTemplateID) {
			httpresponse.WriteError(w, http.StatusBadRequest, "invalid_id", "Start a shift from a saved account template.")
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		row, err := store.StartShift(r.Context(), profile.AuthUserID, profile.ID, body.FloorTemplateID)
		if err != nil {
			writeShiftError(w, err)
			return
		}
		writeShift(w, http.StatusCreated, row)
	})))
	mux.Handle("PUT /active-shifts/{id}/setup", protect(requireUUID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ExpectedUpdatedAt time.Time    `json:"expected_updated_at"`
			Setup             shifts.Setup `json:"setup"`
		}
		if !decodeShiftRequest(w, r, &body) {
			return
		}
		if body.ExpectedUpdatedAt.IsZero() {
			httpresponse.WriteError(w, http.StatusBadRequest, "invalid_shift", "Reload the shift before saving setup.")
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		row, err := store.SaveShiftSetup(r.Context(), profile.AuthUserID, profile.ID, r.PathValue("id"), body.ExpectedUpdatedAt, body.Setup)
		if err != nil {
			writeShiftError(w, err)
			return
		}
		writeShift(w, http.StatusOK, row)
	}))))
	mux.Handle("POST /active-shifts/{id}/reopen", protect(requireUUID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ExpectedBaseline string `json:"expected_baseline_assignment_result_id"`
		}
		if !decodeShiftRequest(w, r, &body) {
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		result, err := store.ReopenShift(r.Context(), profile.AuthUserID, profile.ID, r.PathValue("id"), body.ExpectedBaseline)
		if err != nil {
			writeShiftError(w, err)
			return
		}
		httpresponse.WriteJSON(w, http.StatusOK, result)
	}))))
	mux.Handle("POST /active-shifts/{id}/end", protect(requireUUID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct{}
		if !decodeShiftRequest(w, r, &body) {
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		row, err := store.EndShift(r.Context(), profile.AuthUserID, profile.ID, r.PathValue("id"))
		if err != nil {
			writeShiftError(w, err)
			return
		}
		writeShift(w, http.StatusOK, row)
	}))))
}

func writeShift(w http.ResponseWriter, status int, row database.ActiveShift) {
	httpresponse.WriteJSON(w, status, struct {
		Shift database.ActiveShift `json:"active_shift"`
	}{row})
}

func decodeShiftRequest(w http.ResponseWriter, r *http.Request, body any) bool {
	return decodeOrReject(w, r, body, jsonRejection{
		mediaTypeMessage: "Send shift changes as application/json.",
		tooLargeCode:     "shift_too_large",
		tooLargeMessage:  "The shift setup is too large.",
		invalidCode:      "invalid_shift",
		invalidMessage:   "Send one valid shift request with only editable fields.",
	})
}

func writeShiftError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, database.ErrShiftNotFound), errors.Is(err, database.ErrTemplateNotFound):
		httpresponse.WriteError(w, http.StatusNotFound, "shift_not_found", "This shift or floor template is no longer available. Refresh and try again.")
	case errors.Is(err, database.ErrShiftStale):
		httpresponse.WriteError(w, http.StatusConflict, "shift_stale", "The shift changed. Reload the workspace and review the current setup before saving.")
	case errors.Is(err, database.ErrShiftAssigned):
		httpresponse.WriteError(w, http.StatusConflict, "shift_assigned", "Reopen the assigned shift before saving setup.")
	case errors.Is(err, database.ErrShiftAlreadyOpen):
		httpresponse.WriteError(w, http.StatusConflict, "shift_already_open", "An active shift already exists. Reload the workspace to resume it.")
	case errors.Is(err, shifts.ErrInvalidSetup), errors.Is(err, templates.ErrInvalidLayout):
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_shift", "The shift setup is incomplete or inconsistent.")
	default:
		httpresponse.WriteError(w, http.StatusServiceUnavailable, "database_unavailable", "Shifts are temporarily unavailable. Try again.")
	}
}

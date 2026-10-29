package httpapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
	"github.com/pratham124/nurse-flow/backend/internal/templates"
)

// FloorTemplateStore supplies owned template reads, saves, and deletions.
type FloorTemplateStore interface {
	FloorTemplateReader
	SaveFloorTemplate(context.Context, string, string, string, templates.Snapshot) (database.FloorTemplate, error)
	DeleteFloorTemplate(context.Context, string, string, string) error
}

type floorTemplateSaveRequest struct {
	TemplateSnapshot templates.Snapshot `json:"template_snapshot"`
}

type floorTemplateSaveResponse struct {
	Template database.FloorTemplate `json:"template"`
}

func saveFloorTemplateHandler(store FloorTemplateStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, ok := auth.ProfileFromContext(r.Context())
		if !ok {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
			return
		}
		id := r.PathValue("id")
		var body floorTemplateSaveRequest
		if err := decodeJSONRequest(w, r, &body); err != nil {
			var tooLarge *http.MaxBytesError
			if errors.Is(err, errUnsupportedJSONMediaType) {
				httpresponse.WriteError(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Send the template as application/json.")
			} else if errors.Is(err, errNullJSONRequest) {
				httpresponse.WriteError(w, http.StatusBadRequest, "invalid_template", "The floor template layout is incomplete or inconsistent.")
			} else if errors.As(err, &tooLarge) {
				httpresponse.WriteError(w, http.StatusRequestEntityTooLarge, "template_too_large", "The floor template is too large.")
			} else {
				httpresponse.WriteError(w, http.StatusBadRequest, "invalid_template", "Send one valid reusable floor template.")
			}
			return
		}
		if err := body.TemplateSnapshot.Validate(); err != nil {
			httpresponse.WriteError(w, http.StatusBadRequest, "invalid_template", "The floor template layout is incomplete or inconsistent.")
			return
		}
		saved, err := store.SaveFloorTemplate(r.Context(), profile.AuthUserID, profile.ID, id, body.TemplateSnapshot)
		if err != nil {
			writeTemplateError(w, err)
			return
		}
		status := http.StatusOK
		if r.Method == http.MethodPost {
			status = http.StatusCreated
		}
		httpresponse.WriteJSON(w, status, floorTemplateSaveResponse{Template: saved})
	})
}

func deleteFloorTemplateHandler(store FloorTemplateStore) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, ok := auth.ProfileFromContext(r.Context())
		if !ok {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
			return
		}
		id := r.PathValue("id")
		if err := store.DeleteFloorTemplate(r.Context(), profile.AuthUserID, profile.ID, id); err != nil {
			writeTemplateError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusNoContent)
	})
}

func writeTemplateError(w http.ResponseWriter, err error) {
	if errors.Is(err, database.ErrTemplateNotFound) {
		httpresponse.WriteError(w, http.StatusNotFound, "template_not_found", "This floor template is no longer available. Refresh and try again.")
		return
	}
	httpresponse.WriteError(w, http.StatusServiceUnavailable, "database_unavailable", "Floor templates are temporarily unavailable. Try again.")
}

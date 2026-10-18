package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
	"github.com/pratham124/nurse-flow/backend/internal/templates"
)

type FloorTemplateStore interface {
	FloorTemplateReader
	SaveFloorTemplate(context.Context, string, string, string, templates.Snapshot) (database.FloorTemplate, error)
	DeleteFloorTemplate(context.Context, string, string, string) error
}

const maxTemplateBodyBytes = 1 << 20

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
			httpresponse.WriteError(w, 500, "internal_error", "The request could not be completed.")
			return
		}
		id := r.PathValue("id")
		mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			httpresponse.WriteError(w, 415, "unsupported_media_type", "Send the template as application/json.")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxTemplateBodyBytes)
		decoder := json.NewDecoder(r.Body)
		// Only reusable layout fields are accepted; owner/timestamp/shift fields
		// cannot accidentally become writable as the schema evolves.
		decoder.DisallowUnknownFields()
		var body floorTemplateSaveRequest
		err = decoder.Decode(&body)
		if err == nil {
			err = decoder.Decode(new(any))
			if err == io.EOF {
				err = nil
			} else if err == nil {
				err = errors.New("multiple JSON values")
			}
		}
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				httpresponse.WriteError(w, 413, "template_too_large", "The floor template is too large.")
			} else {
				httpresponse.WriteError(w, 400, "invalid_template", "Send one valid reusable floor template.")
			}
			return
		}
		if err := body.TemplateSnapshot.Validate(); err != nil {
			httpresponse.WriteError(w, 400, "invalid_template", "The floor template layout is incomplete or inconsistent.")
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
			httpresponse.WriteError(w, 500, "internal_error", "The request could not be completed.")
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
		httpresponse.WriteError(w, 404, "template_not_found", "This floor template is no longer available. Refresh and try again.")
		return
	}
	httpresponse.WriteError(w, 503, "database_unavailable", "Floor templates are temporarily unavailable. Try again.")
}

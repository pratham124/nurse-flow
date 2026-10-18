package httpapi

import (
	"context"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

// FloorTemplateReader supplies the database query needed by the list handler.
type FloorTemplateReader interface {
	FloorTemplatesByProfile(context.Context, string, string) ([]database.FloorTemplate, error)
}

type floorTemplateListResponse struct {
	Templates []database.FloorTemplate `json:"templates"`
}

func floorTemplatesHandler(reader FloorTemplateReader) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		profile, ok := auth.ProfileFromContext(r.Context())
		if !ok {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
			return
		}
		templates, err := reader.FloorTemplatesByProfile(r.Context(), profile.AuthUserID, profile.ID)
		if err != nil {
			httpresponse.WriteError(w, http.StatusServiceUnavailable, "database_unavailable", "Floor templates are temporarily unavailable. Try again.")
			return
		}
		if templates == nil {
			templates = make([]database.FloorTemplate, 0)
		}
		httpresponse.WriteJSON(w, http.StatusOK, floorTemplateListResponse{Templates: templates})
	})
}

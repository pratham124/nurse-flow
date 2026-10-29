package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"

	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

const maxJSONRequestBodyBytes = 1 << 20

var (
	errUnsupportedJSONMediaType = errors.New("request must use application/json")
	errNullJSONRequest          = errors.New("null request")
)

// decodeJSONRequest accepts one non-null JSON value with only known fields.
// Handlers retain their own public error messages and domain validation.
func decodeJSONRequest(w http.ResponseWriter, r *http.Request, body any) error {
	return decodeJSONRequestLimit(w, r, body, maxJSONRequestBodyBytes)
}

// decodeJSONRequestLimit is decodeJSONRequest with a handler-chosen body size limit.
func decodeJSONRequestLimit(w http.ResponseWriter, r *http.Request, body any, limit int64) error {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return errUnsupportedJSONMediaType
	}
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	decoder := json.NewDecoder(r.Body)
	var raw json.RawMessage
	if err := decoder.Decode(&raw); err != nil {
		return err
	}
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return errNullJSONRequest
	}
	fields := json.NewDecoder(bytes.NewReader(raw))
	fields.DisallowUnknownFields()
	if err := fields.Decode(body); err != nil {
		return err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		if err != nil {
			return err
		}
		return errors.New("multiple JSON values")
	}
	return nil
}

// jsonRejection holds one handler's public messages for a rejected request body.
type jsonRejection struct {
	mediaTypeMessage string
	tooLargeCode     string
	tooLargeMessage  string
	invalidCode      string
	invalidMessage   string
}

// decodeOrReject decodes the body like decodeJSONRequest and, on failure, writes
// the matching error response and reports false.
func decodeOrReject(w http.ResponseWriter, r *http.Request, body any, rejection jsonRejection) bool {
	err := decodeJSONRequest(w, r, body)
	if err == nil {
		return true
	}
	var tooLarge *http.MaxBytesError
	switch {
	case errors.Is(err, errUnsupportedJSONMediaType):
		httpresponse.WriteError(w, http.StatusUnsupportedMediaType, "unsupported_media_type", rejection.mediaTypeMessage)
	case errors.As(err, &tooLarge):
		httpresponse.WriteError(w, http.StatusRequestEntityTooLarge, rejection.tooLargeCode, rejection.tooLargeMessage)
	default:
		httpresponse.WriteError(w, http.StatusBadRequest, rejection.invalidCode, rejection.invalidMessage)
	}
	return false
}

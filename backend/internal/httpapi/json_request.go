package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
)

const maxJSONRequestBodyBytes = 1 << 20

var (
	errUnsupportedJSONMediaType = errors.New("request must use application/json")
	errNullJSONRequest          = errors.New("null request")
)

// decodeJSONRequest accepts one non-null JSON value with only known fields.
// Handlers retain their own public error messages and domain validation.
func decodeJSONRequest(w http.ResponseWriter, r *http.Request, body any) error {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return errUnsupportedJSONMediaType
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONRequestBodyBytes)
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

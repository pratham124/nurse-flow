// Package httpresponse keeps JSON responses and public errors consistent.
package httpresponse

import (
	"encoding/json"
	"log"
	"net/http"
)

// ErrorDetails contains a stable error code and a user-facing message.
type ErrorDetails struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ErrorResponse is the shared JSON envelope for API errors.
type ErrorResponse struct {
	Error ErrorDetails `json:"error"`
}

// WriteJSON writes a JSON response with the supplied HTTP status and disables caching.
func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Print("Could not write JSON response")
	}
}

// WriteError writes the shared error envelope without exposing internal error details.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	WriteJSON(w, status, ErrorResponse{Error: ErrorDetails{Code: code, Message: message}})
}

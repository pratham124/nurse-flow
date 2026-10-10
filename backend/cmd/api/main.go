package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	verifier, err := auth.NewDevelopment(ctx)
	if err != nil {
		return fmt.Errorf("configure authentication: %w", err)
	}
	address := os.Getenv("NURSEFLOW_HTTP_ADDR")
	if address == "" {
		address = "127.0.0.1:8080"
	}

	server := &http.Server{
		Addr:              address,
		Handler:           newHandler(verifier),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("Starting NurseFlow API on %s", address)
	if err := server.ListenAndServe(); err != nil {
		return fmt.Errorf("start HTTP server: %w", err)
	}
	return nil
}

func newHandler(verifier *auth.Verifier) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler)
	mux.Handle("GET /auth/check", verifier.RequireIdentity(http.HandlerFunc(authCheckHandler)))
	return mux
}

// This diagnostic route proves authentication only; profile authorization is task 8.
func authCheckHandler(w http.ResponseWriter, r *http.Request) {
	identity, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
		return
	}
	httpresponse.WriteJSON(w, http.StatusOK, struct {
		AuthUserID string `json:"auth_user_id"`
	}{AuthUserID: identity.AuthUserID})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if _, err := fmt.Fprintln(w, `{"status":"ok"}`); err != nil {
		log.Print("Could not write health response")
	}
}

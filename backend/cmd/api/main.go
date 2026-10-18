package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpapi"
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
	store, err := database.OpenDevelopment(ctx)
	if err != nil {
		return fmt.Errorf("configure database: %w", err)
	}
	defer store.Close()
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
		Handler:           httpapi.NewHandler(verifier, store, store),
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

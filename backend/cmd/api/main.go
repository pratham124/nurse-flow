package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/assignmentruns"
	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpapi"
	"github.com/pratham124/nurse-flow/backend/internal/solver"
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
	// Check the solver settings at startup, so a missing token is not found by the
	// first charge nurse who runs the optimizer.
	solverClient, err := solver.New(os.Getenv("NURSEFLOW_SOLVER_URL"), os.Getenv("NURSEFLOW_SOLVER_TOKEN"))
	if err != nil {
		return fmt.Errorf("configure solver (set NURSEFLOW_SOLVER_URL and NURSEFLOW_SOLVER_TOKEN): %w", err)
	}
	address := os.Getenv("NURSEFLOW_HTTP_ADDR")
	if address == "" {
		address = "127.0.0.1:8080"
	}
	webOrigins, configured := os.LookupEnv("NURSEFLOW_WEB_ORIGINS")
	if !configured {
		webOrigins = "http://localhost:8081,http://127.0.0.1:8081"
	}
	handler := httpapi.WithCORS(httpapi.NewHandler(verifier, store, store, store, store, store, store, store, store, assignmentruns.NewCoordinator(store, solverClient)), strings.Split(webOrigins, ","))

	server := &http.Server{
		Addr:              address,
		Handler:           handler,
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

package main

import (
	"context"
	"fmt"
	"os"

	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/supabaseproject"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	projectRef, err := supabaseproject.FromEnvironment()
	if err != nil {
		return fmt.Errorf("configure Supabase project: %w", err)
	}
	store, err := database.Open(context.Background(), projectRef)
	if err != nil {
		return err
	}
	defer store.Close()
	fmt.Printf("Connected to Supabase project %s Postgres as nurseflow_go\n", projectRef)
	return nil
}

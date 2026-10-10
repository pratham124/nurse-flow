package main

import (
	"context"
	"fmt"
	"os"

	"github.com/pratham124/nurse-flow/backend/internal/database"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	store, err := database.OpenDevelopment(context.Background())
	if err != nil {
		return err
	}
	defer store.Close()
	fmt.Println("Connected to development Postgres as nurseflow_go")
	return nil
}

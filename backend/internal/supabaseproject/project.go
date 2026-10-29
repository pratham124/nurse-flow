// Package supabaseproject names the Supabase projects this backend may talk to.
package supabaseproject

import (
	"errors"
	"fmt"
	"os"
)

// Development is the isolated Supabase project used for development and testing.
const Development = "nmitctyxtjmlakcsmnuj"

// Production is the live Supabase project. Nothing should use it until the approved cutover.
const Production = "mkljczezkyqtuplzedpj"

// Valid reports whether ref is exactly one of the two allowed projects.
func Valid(ref string) bool {
	return ref == Development || ref == Production
}

// FromEnvironment reads NURSEFLOW_SUPABASE_PROJECT_REF and fails unless it is an allowed project.
// Requiring it lets one container image move between projects by configuration alone.
func FromEnvironment() (string, error) {
	ref := os.Getenv("NURSEFLOW_SUPABASE_PROJECT_REF")
	if ref == "" {
		return "", errors.New("set NURSEFLOW_SUPABASE_PROJECT_REF to the development or production project ref")
	}
	if !Valid(ref) {
		return "", fmt.Errorf("NURSEFLOW_SUPABASE_PROJECT_REF %q is not allowed; only the development and production refs are accepted", ref)
	}
	return ref, nil
}

package database

import (
	"os"
	"testing"
)

// Exposes the existing loopback-only test configuration to the external HTTP
// demo test. This symbol is absent from production builds.
func OpenLifecycleDemoStore(t *testing.T) *Store {
	t.Helper()
	if os.Getenv("NURSEFLOW_TEST_DATABASE_URL") == "" {
		t.Skip("HTTP demo requires isolated local Postgres")
	}
	return openIntegrationStore(t)
}

package database

import (
	"context"
	"encoding/json"
	"os"
	"testing"
)

// This test is read-only and supports the documented development fixtures.
func TestTemplateListIsolationIntegration(t *testing.T) {
	store := openIntegrationStore(t)
	ctx := context.Background()
	store.pool.SetMaxOpenConns(1)
	store.pool.SetMaxIdleConns(1)
	alphaID := os.Getenv("NURSEFLOW_TEST_ALPHA_ID")
	betaID := os.Getenv("NURSEFLOW_TEST_BETA_ID")
	regularID := os.Getenv("NURSEFLOW_TEST_REGULAR_ID")
	alpha, err := store.ProfileByAuthUserID(ctx, alphaID)
	if err != nil {
		t.Fatal(err)
	}
	beta, err := store.ProfileByAuthUserID(ctx, betaID)
	if err != nil {
		t.Fatal(err)
	}
	regular, err := store.ProfileByAuthUserID(ctx, regularID)
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name      string
		authID    string
		profileID string
		wantCount int
	}{
		{"Alpha own templates", alphaID, alpha.ID, 1},
		{"Beta empty list", betaID, beta.ID, 0},
		{"Alpha cannot select Beta", alphaID, beta.ID, 0},
		{"Beta cannot select Alpha", betaID, alpha.ID, 0},
		{"regular own templates denied by RLS", regularID, regular.ID, 0},
		{"regular cannot select Alpha", regularID, alpha.ID, 0},
		{"unknown cannot select Alpha", "ffffffff-ffff-ffff-ffff-ffffffffffff", alpha.ID, 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			templates, err := store.FloorTemplatesByProfile(ctx, test.authID, test.profileID)
			if err != nil {
				t.Fatal(err)
			}
			if templates == nil || len(templates) != test.wantCount {
				t.Fatalf("count=%d, want=%d; empty results must be non-nil", len(templates), test.wantCount)
			}
			for _, template := range templates {
				if template.OwnerProfileID != test.profileID || template.ID == "" || template.Name == "" || !json.Valid(template.TemplateSnapshot) {
					t.Fatal("incorrect ownership or incomplete existing-table mapping")
				}
			}
			var anonymous []FloorTemplate
			if err := store.db.Find(&anonymous).Error; err != nil || len(anonymous) != 0 {
				t.Fatal("template query leaked transaction identity into reused connection")
			}
		})
	}
	for _, ids := range [][2]string{{"bad-auth", alpha.ID}, {alphaID, "bad-profile"}} {
		if templates, err := store.FloorTemplatesByProfile(ctx, ids[0], ids[1]); err == nil || templates != nil {
			t.Fatal("invalid identity must fail without partial data")
		}
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if templates, err := store.FloorTemplatesByProfile(cancelled, alphaID, alpha.ID); err == nil || templates != nil {
		t.Fatal("cancelled query must fail without partial data")
	}
}

// Extra sorting fixtures exist only in testdata/template-list.sql, never in Supabase.
func TestTemplateListOrderingIntegration(t *testing.T) {
	if os.Getenv("NURSEFLOW_TEST_DATABASE_URL") == "" {
		t.Skip("ordering fixtures require the isolated local test database")
	}
	store := openIntegrationStore(t)
	ctx := context.Background()
	gammaAuth := "20000000-0000-0000-0000-000000000004"
	gammaProfile := "10000000-0000-0000-0000-000000000004"
	deltaAuth := "20000000-0000-0000-0000-000000000005"
	deltaProfile := "10000000-0000-0000-0000-000000000005"
	templates, err := store.FloorTemplatesByProfile(ctx, gammaAuth, gammaProfile)
	if err != nil {
		t.Fatal(err)
	}
	if len(templates) != 3 {
		t.Fatal("apply local testdata/template-list.sql before running ordering checks")
	}
	for i, template := range templates {
		if template.OwnerProfileID != gammaProfile {
			t.Fatal("another owner's newer template leaked into results")
		}
		if i > 0 && templates[i-1].UpdatedAt.Before(template.UpdatedAt) {
			t.Fatal("templates are not ordered by updated_at DESC")
		}
	}
	if !templates[0].UpdatedAt.Equal(templates[1].UpdatedAt) || templates[2].ID != "40000000-0000-0000-0000-000000000001" {
		t.Fatal("tied update times must precede the older row; no order within the tie is required")
	}
	var snapshot map[string]any
	if err := json.Unmarshal(templates[2].TemplateSnapshot, &snapshot); err != nil || snapshot["id"] != "old-snapshot-id" || snapshot["futureField"] != float64(42) {
		t.Fatal("query changed snapshot fields instead of preserving the raw JSON")
	}
	delta, err := store.FloorTemplatesByProfile(ctx, deltaAuth, deltaProfile)
	if err != nil || len(delta) != 1 || delta[0].OwnerProfileID != deltaProfile {
		t.Fatal("second nonempty charge account did not receive only its own row")
	}
	for _, ids := range [][2]string{{gammaAuth, deltaProfile}, {deltaAuth, gammaProfile}} {
		rows, err := store.FloorTemplatesByProfile(ctx, ids[0], ids[1])
		if err != nil || len(rows) != 0 {
			t.Fatal("two nonempty accounts could select each other's rows")
		}
	}
}

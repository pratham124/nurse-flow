package database

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

// Opt in explicitly. A local URL is accepted only here, never in the development API config.
func TestDatabaseOwnershipIntegration(t *testing.T) {
	if os.Getenv("NURSEFLOW_DATABASE_TESTS") != "1" {
		t.Skip("set NURSEFLOW_DATABASE_TESTS=1 and fixture Auth UUIDs to verify Postgres")
	}
	ctx := context.Background()
	var store *Store
	var err error
	if localURL := os.Getenv("NURSEFLOW_TEST_DATABASE_URL"); localURL != "" {
		parsed, parseErr := url.Parse(localURL)
		if parseErr != nil || parsed.Hostname() != "127.0.0.1" {
			t.Fatal("test override must target isolated local Postgres")
		}
		store, err = open(ctx, localURL)
	} else {
		store, err = OpenDevelopment(ctx)
	}
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	// Force connection reuse to detect identity leakage across commit and rollback.
	store.pool.SetMaxOpenConns(1)
	store.pool.SetMaxIdleConns(1)

	assertAnonymous := func() {
		t.Helper()
		var profiles []Profile
		var templates []FloorTemplate
		if err := store.db.Find(&profiles).Error; err != nil {
			t.Fatal(err)
		}
		if err := store.db.Find(&templates).Error; err != nil {
			t.Fatal(err)
		}
		if len(profiles) != 0 || len(templates) != 0 {
			t.Fatal("identity leaked outside transaction")
		}
	}
	assertAnonymous()
	var permissions struct {
		GoExecute     bool
		ClientExecute bool
	}
	if err := store.db.Raw(`SELECT
		has_function_privilege(current_user, 'public.accept_shift_nurse_invite_code(text)', 'EXECUTE') AS go_execute,
		has_function_privilege('authenticated', 'public.accept_shift_nurse_invite_code(text)', 'EXECUTE') AS client_execute
	`).Scan(&permissions).Error; err != nil {
		t.Fatal(err)
	}
	if permissions.GoExecute || !permissions.ClientExecute {
		t.Fatal("function grants must exclude Go and preserve existing client access")
	}
	var unexpectedFunctions int64
	if err := store.db.Raw(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
		WHERE n.nspname='public' AND has_function_privilege(current_user,p.oid,'EXECUTE')
	`).Scan(&unexpectedFunctions).Error; err != nil {
		t.Fatal(err)
	}
	if unexpectedFunctions != 0 {
		t.Fatal("Go inherited unexpected function execution privileges")
	}
	tests := []struct {
		name          string
		authID        string
		wantRole      string
		wantTemplates int
	}{
		{"Alpha", os.Getenv("NURSEFLOW_TEST_ALPHA_ID"), "charge_nurse", 1},
		{"Beta", os.Getenv("NURSEFLOW_TEST_BETA_ID"), "charge_nurse", 0},
		{"Regular", os.Getenv("NURSEFLOW_TEST_REGULAR_ID"), "regular_nurse", 0},
		{"Unknown", "ffffffff-ffff-ffff-ffff-ffffffffffff", "", 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if !uuidPattern.MatchString(test.authID) {
				t.Fatal("set fixture Auth UUIDs")
			}
			err := store.WithIdentity(ctx, test.authID, func(tx *gorm.DB) error {
				var profiles []Profile
				var templates []FloorTemplate
				if err := tx.Find(&profiles).Error; err != nil {
					return err
				}
				if err := tx.Find(&templates).Error; err != nil {
					return err
				}
				// No owner WHERE clause: the database itself must restrict the rows.
				if len(templates) != test.wantTemplates {
					t.Fatalf("template count = %d, want %d", len(templates), test.wantTemplates)
				}
				if test.wantRole == "" {
					if len(profiles) != 0 {
						t.Fatal("unknown user received a profile")
					}
					return nil
				}
				if len(profiles) != 1 || profiles[0].AuthUserID != test.authID || profiles[0].Role != test.wantRole {
					t.Fatal("profile ownership/role mapping failed")
				}
				for _, template := range templates {
					if template.OwnerProfileID != profiles[0].ID || template.ID == "" || template.Name == "" || template.CreatedAt.IsZero() || template.UpdatedAt.IsZero() || !json.Valid(template.TemplateSnapshot) {
						t.Fatal("template ownership or existing-table mapping failed")
					}
				}
				return nil
			})
			if err != nil {
				t.Fatal(err)
			}
			assertAnonymous()
		})
	}

	rollback := errors.New("intentional rollback")
	err = store.WithIdentity(ctx, tests[0].authID, func(tx *gorm.DB) error { return rollback })
	if !errors.Is(err, rollback) {
		t.Fatal("transaction did not return callback error")
	}
	assertAnonymous()
	if err := store.WithIdentity(ctx, "not-a-uuid", func(tx *gorm.DB) error { t.Fatal("invalid identity reached query"); return nil }); err == nil {
		t.Fatal("invalid identity accepted")
	}

	for _, statement := range []string{
		"UPDATE public.profiles SET display_name = display_name WHERE false",
		"DELETE FROM public.floor_templates WHERE false",
		"SELECT * FROM public.active_shifts LIMIT 0",
	} {
		err := store.db.Exec(statement).Error
		var postgresError *pgconn.PgError
		if !errors.As(err, &postgresError) || postgresError.Code != "42501" {
			t.Fatalf("expected insufficient privilege for %q", statement)
		}
	}
}

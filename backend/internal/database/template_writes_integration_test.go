package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pratham124/nurse-flow/backend/internal/templates"
	"gorm.io/gorm"
)

func validWriteSnapshot(t *testing.T) templates.Snapshot {
	t.Helper()
	var snapshot templates.Snapshot
	if err := json.Unmarshal([]byte(`{"id":"local-floor","name":" Milestone 2 Test ","doctorSides":[{"id":"a","name":"A"},{"id":"b","name":"B"}],"rooms":[{"id":"r","doctorSideId":"a","label":"101","bedCount":1}],"beds":[{"id":"bed","roomId":"r","label":"101-1","bedNumber":1}]}`), &snapshot); err != nil {
		t.Fatal(err)
	}
	return snapshot
}

// Opt-in live test creates only its own temporary synthetic templates and cleans
// them up. Existing Alpha/Beta fixture rows are never updated or deleted.
func TestTemplateWritesIntegration(t *testing.T) {
	store := openIntegrationStore(t)
	ctx := context.Background()
	store.pool.SetMaxOpenConns(1)
	store.pool.SetMaxIdleConns(1)
	alphaAuth := fixtureAuthID(t, "NURSEFLOW_TEST_ALPHA_ID")
	betaAuth := fixtureAuthID(t, "NURSEFLOW_TEST_BETA_ID")
	regularAuth := fixtureAuthID(t, "NURSEFLOW_TEST_REGULAR_ID")
	alpha, err := store.ProfileByAuthUserID(ctx, alphaAuth)
	if err != nil {
		t.Fatal(err)
	}
	beta, err := store.ProfileByAuthUserID(ctx, betaAuth)
	if err != nil {
		t.Fatal(err)
	}
	regular, err := store.ProfileByAuthUserID(ctx, regularAuth)
	if err != nil {
		t.Fatal(err)
	}
	snapshot := validWriteSnapshot(t)
	saved, err := store.SaveFloorTemplate(ctx, alphaAuth, alpha.ID, "", snapshot)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		err := store.DeleteFloorTemplate(ctx, alphaAuth, alpha.ID, saved.ID)
		if err != nil && !errors.Is(err, ErrTemplateNotFound) {
			t.Error(err)
		}
	})
	if !fixtureUUIDPattern.MatchString(saved.ID) || saved.ID == snapshot.ID || saved.Name != "Milestone 2 Test" || saved.OwnerProfileID != alpha.ID || saved.CreatedAt.IsZero() || saved.UpdatedAt.IsZero() {
		t.Fatal("create lost authoritative fields")
	}
	var actual templates.Snapshot
	if err := json.Unmarshal(saved.TemplateSnapshot, &actual); err != nil || actual.ID != saved.ID || actual.Name != saved.Name {
		t.Fatal("snapshot ID/name not synchronized")
	}

	t.Run("update and reload", func(t *testing.T) {
		snapshot.Name = "Updated Milestone 2 Test"
		snapshot.ID = "spoofed-snapshot-id"
		updated, err := store.SaveFloorTemplate(ctx, alphaAuth, alpha.ID, strings.ToUpper(saved.ID), snapshot)
		if err != nil || updated.ID != saved.ID || !updated.CreatedAt.Equal(saved.CreatedAt) || updated.UpdatedAt.Before(saved.UpdatedAt) {
			t.Fatalf("update failed: %v", err)
		}
		rows, err := store.FloorTemplatesByProfile(ctx, alphaAuth, alpha.ID)
		if err != nil {
			t.Fatal(err)
		}
		found := false
		for _, row := range rows {
			if row.ID == saved.ID {
				found = true
				if row.Name != snapshot.Name {
					t.Fatal("updated name not persisted")
				}
				if json.Unmarshal(row.TemplateSnapshot, &actual) != nil || actual.ID != saved.ID {
					t.Fatal("update trusted snapshot ID")
				}
			}
		}
		if !found {
			t.Fatal("saved template missing on reload")
		}
	})
	t.Run("two-user isolation", func(t *testing.T) {
		for _, owner := range []string{alpha.ID, beta.ID} {
			if row, err := store.SaveFloorTemplate(ctx, betaAuth, owner, saved.ID, snapshot); !errors.Is(err, ErrTemplateNotFound) || row.ID != "" {
				t.Fatal("foreign update succeeded or leaked a row")
			}
			if err := store.DeleteFloorTemplate(ctx, betaAuth, owner, saved.ID); !errors.Is(err, ErrTemplateNotFound) {
				t.Fatal("foreign delete did not use missing result")
			}
		}
		betaRow, err := store.SaveFloorTemplate(ctx, betaAuth, beta.ID, "", snapshot)
		if err != nil {
			t.Fatal(err)
		}
		defer func() {
			if err := store.DeleteFloorTemplate(ctx, betaAuth, beta.ID, betaRow.ID); err != nil {
				t.Error(err)
			}
		}()
		if _, err := store.SaveFloorTemplate(ctx, alphaAuth, alpha.ID, betaRow.ID, snapshot); !errors.Is(err, ErrTemplateNotFound) {
			t.Fatal("reverse foreign update succeeded")
		}
		if err := store.DeleteFloorTemplate(ctx, alphaAuth, alpha.ID, betaRow.ID); !errors.Is(err, ErrTemplateNotFound) {
			t.Fatal("reverse foreign delete succeeded")
		}
		for _, test := range [][2]string{{alphaAuth, beta.ID}, {regularAuth, regular.ID}, {"ffffffff-ffff-ffff-ffff-ffffffffffff", alpha.ID}} {
			_, err := store.SaveFloorTemplate(ctx, test[0], test[1], "", snapshot)
			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != "42501" {
				t.Fatalf("RLS accepted unauthorized INSERT: %v", err)
			}
		}
		if err := store.WithWriteIdentity(ctx, betaAuth, func(tx *gorm.DB) error {
			result := tx.Table("public.floor_templates").Where("id = ?", saved.ID).Update("name", "foreign write")
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 0 {
				t.Fatal("unfiltered update bypassed RLS")
			}
			return nil
		}); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("read boundary and immutable columns", func(t *testing.T) {
		err := store.WithIdentity(ctx, alphaAuth, func(tx *gorm.DB) error {
			return tx.Table("public.floor_templates").Where("id = ?", saved.ID).Update("name", "read transaction write").Error
		})
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "25006" {
			t.Fatalf("read transaction permitted a write: %v", err)
		}
		for _, column := range []string{"owner_profile_id", "id", "created_at"} {
			err := store.WithWriteIdentity(ctx, alphaAuth, func(tx *gorm.DB) error {
				return tx.Exec("UPDATE public.floor_templates SET "+column+" = "+column+" WHERE id = ?", saved.ID).Error
			})
			if !errors.As(err, &pgErr) || pgErr.Code != "42501" {
				t.Fatalf("immutable column %s writable", column)
			}
		}
	})
	t.Run("validation cancellation and missing rows", func(t *testing.T) {
		invalid := snapshot
		invalid.Beds = nil
		if _, err := store.SaveFloorTemplate(ctx, alphaAuth, alpha.ID, saved.ID, invalid); !errors.Is(err, templates.ErrInvalidLayout) {
			t.Fatal("invalid layout reached database")
		}
		cancelled, cancel := context.WithCancel(ctx)
		cancel()
		if row, err := store.SaveFloorTemplate(cancelled, alphaAuth, alpha.ID, saved.ID, snapshot); err == nil || row.ID != "" {
			t.Fatal("cancelled save returned success")
		}
		missing := "ffffffff-ffff-4fff-8fff-ffffffffffff"
		if _, err := store.SaveFloorTemplate(ctx, alphaAuth, alpha.ID, missing, snapshot); !errors.Is(err, ErrTemplateNotFound) {
			t.Fatal("missing update upserted")
		}
		if err := store.DeleteFloorTemplate(ctx, alphaAuth, alpha.ID, missing); !errors.Is(err, ErrTemplateNotFound) {
			t.Fatal("missing delete not distinguished")
		}
	})
	t.Run("delete and pooled identity cleanup", func(t *testing.T) {
		if err := store.DeleteFloorTemplate(ctx, alphaAuth, alpha.ID, saved.ID); err != nil {
			t.Fatal(err)
		}
		if err := store.DeleteFloorTemplate(ctx, alphaAuth, alpha.ID, saved.ID); !errors.Is(err, ErrTemplateNotFound) {
			t.Fatal("repeated delete returned success")
		}
		var anonymous []FloorTemplate
		if err := store.db.Find(&anonymous).Error; err != nil || len(anonymous) != 0 {
			t.Fatal("write identity leaked into pooled connection")
		}
	})
}

func TestTemplateWriteRollbackAndReferencesIntegration(t *testing.T) {
	if os.Getenv("NURSEFLOW_TEST_DATABASE_URL") == "" {
		t.Skip("synthetic failure trigger and reference fixtures are local-only")
	}
	store := openIntegrationStore(t)
	ctx := context.Background()
	adminURL, err := url.Parse(os.Getenv("NURSEFLOW_TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	adminURL.User = url.User("postgres")
	admin, err := sql.Open("pgx", adminURL.String())
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	alphaAuth := fixtureAuthID(t, "NURSEFLOW_TEST_ALPHA_ID")
	alpha, err := store.ProfileByAuthUserID(ctx, alphaAuth)
	if err != nil {
		t.Fatal(err)
	}
	snapshot := validWriteSnapshot(t)
	snapshot.Name = "Rollback Test"
	if row, err := store.SaveFloorTemplate(ctx, alphaAuth, alpha.ID, "", snapshot); err == nil || row.ID != "" {
		t.Fatal("second-statement failure reported success")
	}
	var count int
	if err := admin.QueryRow("SELECT count(*) FROM public.floor_templates WHERE name = 'Rollback Test'").Scan(&count); err != nil || count != 0 {
		t.Fatal("failed snapshot synchronization left a partial insert")
	}
	snapshot.Name = "Reference Test"
	saved, err := store.SaveFloorTemplate(ctx, alphaAuth, alpha.ID, "", snapshot)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.DeleteFloorTemplate(ctx, alphaAuth, alpha.ID, saved.ID) })
	shiftID := "50000000-0000-4000-8000-000000000001"
	if _, err := admin.Exec("INSERT INTO public.active_shifts (id, floor_template_id) VALUES ($1,$2)", shiftID, saved.ID); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec("DELETE FROM public.active_shifts WHERE id=$1", shiftID)
	if _, err := admin.Exec("INSERT INTO public.previous_shift_snapshots (floor_template_id) VALUES ($1)", saved.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteFloorTemplate(ctx, alphaAuth, alpha.ID, saved.ID); err != nil {
		t.Fatal(err)
	}
	var reference sql.NullString
	if err := admin.QueryRow("SELECT floor_template_id FROM public.active_shifts WHERE id=$1", shiftID).Scan(&reference); err != nil || reference.Valid {
		t.Fatal("delete did not preserve SET NULL reference action")
	}
	if err := admin.QueryRow("SELECT count(*) FROM public.previous_shift_snapshots WHERE floor_template_id=$1", saved.ID).Scan(&count); err != nil || count != 0 {
		t.Fatal("delete did not preserve carry-over CASCADE")
	}
}

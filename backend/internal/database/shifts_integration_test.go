package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"gorm.io/gorm"
)

// Uses the actual restored baseline, RLS and business triggers. Only the managed
// Auth/Realtime dependencies are local stand-ins. Never stages assigned fixtures
// or failure triggers in Supabase: an explicit loopback test URL is mandatory.
func TestShiftLifecycleIntegration(t *testing.T) {
	if os.Getenv("NURSEFLOW_TEST_DATABASE_URL") == "" {
		t.Skip("local-only assigned/failure fixtures")
	}
	store := openIntegrationStore(t)
	ctx := context.Background()
	adminURL, _ := url.Parse(os.Getenv("NURSEFLOW_TEST_DATABASE_URL"))
	adminURL.User = url.User("postgres")
	admin, err := sql.Open("pgx", adminURL.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close() })
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
	newTemplate := func(owner Profile) FloorTemplate {
		t.Helper()
		template, err := store.SaveFloorTemplate(ctx, owner.AuthUserID, owner.ID, "", validWriteSnapshot(t))
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			// Remove only this test's generated rows; template FK cleanup does not
			// delete active shifts, so explicitly remove them as the local admin.
			if _, err := admin.Exec("DELETE FROM public.active_shifts WHERE floor_template_id=$1", template.ID); err != nil {
				t.Error(err)
			}
			if err := store.DeleteFloorTemplate(ctx, owner.AuthUserID, owner.ID, template.ID); err != nil && !errors.Is(err, ErrTemplateNotFound) {
				t.Error(err)
			}
		})
		return template
	}
	alphaTemplate, betaTemplate := newTemplate(alpha), newTemplate(beta)
	readSetup := func(row ActiveShift) shifts.Setup {
		t.Helper()
		var setup shifts.Setup
		if err := json.Unmarshal(row.ShiftSnapshot, &setup); err != nil {
			t.Fatal(err)
		}
		return setup
	}
	assertSQL := func(query string, args ...any) {
		t.Helper()
		if _, err := admin.Exec(query, args...); err != nil {
			t.Fatal(err)
		}
	}
	count := func(query string, args ...any) int {
		t.Helper()
		var n int
		if err := admin.QueryRow(query, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	getCurrent := func() ActiveShift {
		t.Helper()
		row, err := store.CurrentShift(ctx, alphaAuth, alpha.ID)
		if err != nil || row == nil {
			t.Fatalf("current shift: %v", err)
		}
		return *row
	}
	var current ActiveShift
	t.Run("owned atomic start and duplicate serialization", func(t *testing.T) {
		if _, err := store.StartShift(ctx, alphaAuth, alpha.ID, betaTemplate.ID); !errors.Is(err, ErrTemplateNotFound) {
			t.Fatal("foreign template accepted")
		}
		if _, err := store.StartShift(ctx, betaAuth, alpha.ID, alphaTemplate.ID); !errors.Is(err, ErrTemplateNotFound) {
			t.Fatal("spoofed profile accepted")
		}
		var results [2]ActiveShift
		var failures [2]error
		var wg sync.WaitGroup
		for i := range 2 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				results[i], failures[i] = store.StartShift(ctx, alphaAuth, alpha.ID, alphaTemplate.ID)
			}()
		}
		wg.Wait()
		success := 0
		for i, err := range failures {
			if err == nil {
				success++
				current = results[i]
			} else if !errors.Is(err, ErrShiftAlreadyOpen) {
				t.Fatal(err)
			}
		}
		if success != 1 || count("SELECT count(*) FROM public.active_shifts WHERE charge_profile_id=$1 AND ended_at IS NULL", alpha.ID) != 1 {
			t.Fatal("concurrent start duplicated shift")
		}
		var snapshot struct{ ID, Status, FloorTemplateID string }
		if err := json.Unmarshal(current.ShiftSnapshot, &snapshot); err != nil || snapshot.ID != current.ID || snapshot.Status != "setup" {
			t.Fatal("snapshot ID not atomic")
		}
		if !fixtureUUIDPattern.MatchString(current.ID) || current.CreatedAt.IsZero() || current.UpdatedAt.IsZero() {
			t.Fatal("server metadata missing")
		}
	})
	t.Run("related reads ownership and pooled identity", func(t *testing.T) {
		store.pool.SetMaxOpenConns(1)
		store.pool.SetMaxIdleConns(1)
		for _, test := range [][2]string{{betaAuth, beta.ID}, {betaAuth, alpha.ID}, {regularAuth, regular.ID}, {"ffffffff-ffff-ffff-ffff-ffffffffffff", alpha.ID}} {
			row, err := store.CurrentShift(ctx, test[0], test[1])
			if err != nil || row != nil {
				t.Fatalf("foreign/current leak: %v", err)
			}
			previous, err := store.PreviousShifts(ctx, test[0], test[1])
			if err != nil || len(previous) != 0 {
				t.Fatal("foreign previous leak")
			}
		}
		if err := store.WithIdentity(ctx, betaAuth, func(tx *gorm.DB) error {
			var rows []ActiveShift
			if err := tx.Find(&rows).Error; err != nil {
				return err
			}
			if len(rows) != 0 {
				t.Fatal("unfiltered RLS leak")
			}
			return nil
		}); err != nil {
			t.Fatal(err)
		}
		var anonymous []ActiveShift
		if err := store.db.Find(&anonymous).Error; err != nil || len(anonymous) != 0 {
			t.Fatal("identity leaked")
		}
		row := getCurrent()
		if row.ID != current.ID || row.ActiveAssignmentOverridesByBedID == nil {
			t.Fatal("current mapping changed")
		}
		store.pool.SetMaxOpenConns(5)
	})
	t.Run("setup save stale race and validation", func(t *testing.T) {
		input := readSetup(current)
		input.AdmittingDoctorSideID = "a"
		input.Nurses = []shifts.Nurse{{ID: "n1", Name: "Nurse One", LicenseType: "RN", ExperienceLevel: "mid", MaxPatientLoad: 5}, {ID: "n2", Name: "Nurse Two", LicenseType: "LPN", ExperienceLevel: "experienced", MaxPatientLoad: 5}}
		input.BedStates[0].Patient = &shifts.Patient{Initials: "AB"}
		input.BedStates[0].Acuity = "yellow"
		var results [2]ActiveShift
		var failures [2]error
		var wg sync.WaitGroup
		for i := range 2 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				results[i], failures[i] = store.SaveShiftSetup(ctx, alphaAuth, alpha.ID, current.ID, current.UpdatedAt, input)
			}()
		}
		wg.Wait()
		success := 0
		for i, err := range failures {
			if err == nil {
				success++
				current = results[i]
			} else if !errors.Is(err, ErrShiftStale) {
				t.Fatal(err)
			}
		}
		if success != 1 {
			t.Fatal("concurrent setup overwrote newer save")
		}
		bad := readSetup(current)
		bad.BedStates[0].BedID = "foreign"
		if _, err := store.SaveShiftSetup(ctx, alphaAuth, alpha.ID, current.ID, current.UpdatedAt, bad); !errors.Is(err, shifts.ErrInvalidSetup) {
			t.Fatal("invalid setup accepted")
		}
		if _, err := store.SaveShiftSetup(ctx, betaAuth, alpha.ID, current.ID, current.UpdatedAt, input); !errors.Is(err, ErrShiftNotFound) {
			t.Fatal("foreign setup accepted")
		}
	})
	stageAssignment := func() {
		t.Helper()
		assertSQL(`UPDATE public.active_shifts SET status='assigned',shift_snapshot=shift_snapshot||'{"status":"assigned","assignmentResult":{"id":"baseline","generatedTeams":[],"roomCoverage":[],"bedAssignments":[{"id":"assign","bedId":"bed","nurseId":"n1"}]},"flags":[],"nurseRequests":[{"id":"request","type":"issue","status":"pending","requestingNurseId":"n1","requestingNurseName":"Nurse One","message":"Example","createdAt":"2026-10-18T00:00:00Z"}]}'::jsonb,updated_at=updated_at+interval '1 microsecond' WHERE id=$1`, current.ID)
		assertSQL(`INSERT INTO public.shift_nurse_access(shift_id,nurse_id,nurse_name,nurse_profile_id,status) VALUES($1,'n1','Nurse One',$2,'linked')`, current.ID, beta.ID)
		assertSQL(`INSERT INTO public.shift_nurse_invites(shift_id,nurse_id,created_by_profile_id,token_hash,expires_at) VALUES($1,'n2',$2,repeat('a',64),now()+interval '1 day')`, current.ID, alpha.ID)
		assertSQL(`INSERT INTO public.manual_assignment_overrides(shift_id,baseline_assignment_result_id,bed_id,from_nurse_id,to_nurse_id,created_by_profile_id,status,client_mutation_id) VALUES($1,'baseline','bed','n1','n2',$2,'active','local-test-move')`, current.ID, alpha.ID)
		current = getCurrent()
	}
	t.Run("reopen parity stale check related effects and notifications", func(t *testing.T) {
		stageAssignment()
		if len(current.ActiveAssignmentOverridesByBedID) != 1 || current.ActiveAssignmentOverridesByBedID["bed"].ToNurseID != "n2" {
			t.Fatal("effective overlay missing")
		}
		if _, err := store.SaveShiftSetup(ctx, alphaAuth, alpha.ID, current.ID, current.UpdatedAt, readSetup(current)); !errors.Is(err, ErrShiftAssigned) {
			t.Fatal("assigned setup accepted")
		}
		stale, err := store.ReopenShift(ctx, alphaAuth, alpha.ID, current.ID, "older-baseline")
		if err != nil || stale.Status != "stale" {
			t.Fatal("stale reopen accepted")
		}
		if count("SELECT count(*) FROM public.shift_nurse_access WHERE shift_id=$1 AND status='linked'", current.ID) != 1 {
			t.Fatal("stale reopen removed access")
		}
		if _, err := store.ReopenShift(ctx, betaAuth, beta.ID, current.ID, "baseline"); !errors.Is(err, ErrShiftNotFound) {
			t.Fatal("foreign reopen accepted")
		}
		before := count("SELECT count(*) FROM realtime.messages")
		result, err := store.ReopenShift(ctx, alphaAuth, alpha.ID, current.ID, " baseline ")
		if err != nil || result.Status != "saved" {
			t.Fatalf("reopen: %v", err)
		}
		current = getCurrent()
		snapshot, _ := shifts.Decode(current.ShiftSnapshot)
		if snapshot.BaselineID() != "" || current.Status != "setup" || len(current.ActiveAssignmentOverridesByBedID) != 0 || !strings.Contains(string(snapshot["nurseRequests"]), "request") {
			t.Fatal("reopen lost or retained wrong state")
		}
		if count("SELECT count(*) FROM public.manual_assignment_overrides WHERE shift_id=$1 AND status='superseded'", current.ID) != 1 || count("SELECT count(*) FROM public.shift_nurse_invites WHERE shift_id=$1 AND status='expired'", current.ID) != 1 || count("SELECT count(*) FROM public.shift_nurse_access WHERE shift_id=$1 AND status='removed'", current.ID) != 1 {
			t.Fatal("reopen effects incomplete")
		}
		if count("SELECT count(*) FROM realtime.messages") <= before {
			t.Fatal("retained broadcasts did not fire")
		}
		version := current.UpdatedAt
		noOp, err := store.ReopenShift(ctx, alphaAuth, alpha.ID, current.ID, "")
		if err != nil || noOp.Status != "saved" || !getCurrent().UpdatedAt.Equal(version) {
			t.Fatal("no-baseline reopen changed row")
		}
	})
	t.Run("failed end rolls back carryover invites and closure", func(t *testing.T) {
		assertSQL(`INSERT INTO public.previous_shift_snapshots(charge_profile_id,floor_template_id,completed_at,nurse_suggestions) VALUES($1,$2,now(),'[{"id":"old","previousNurseId":"old","name":"Old","licenseType":"RN","experienceLevel":"mid"}]')`, alpha.ID, alphaTemplate.ID)
		assertSQL(`INSERT INTO public.shift_nurse_invites(shift_id,nurse_id,created_by_profile_id,token_hash,expires_at) VALUES($1,'n2',$2,repeat('b',64),now()+interval '1 day')`, current.ID, alpha.ID)
		assertSQL(`CREATE FUNCTION public.test_reject_shift_end() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.ended_at IS NOT NULL THEN RAISE EXCEPTION 'synthetic close failure'; END IF; RETURN NEW; END $$`)
		assertSQL(`REVOKE ALL ON FUNCTION public.test_reject_shift_end() FROM PUBLIC`)
		assertSQL(`CREATE TRIGGER test_reject_shift_end BEFORE UPDATE ON public.active_shifts FOR EACH ROW EXECUTE FUNCTION public.test_reject_shift_end()`)
		defer assertSQL(`DROP TRIGGER test_reject_shift_end ON public.active_shifts; DROP FUNCTION public.test_reject_shift_end()`)
		if row, err := store.EndShift(ctx, alphaAuth, alpha.ID, current.ID); err == nil || row.ID != "" {
			t.Fatal("failed close reported success")
		}
		if count("SELECT count(*) FROM public.previous_shift_snapshots WHERE floor_template_id=$1 AND nurse_suggestions->0->>'id'='old'", alphaTemplate.ID) != 1 || count("SELECT count(*) FROM public.shift_nurse_invites WHERE shift_id=$1 AND status='active'", current.ID) != 1 || getCurrent().EndedAt != nil {
			t.Fatal("partial end effects committed")
		}
	})
	t.Run("authoritative end carryover and preserved linked access", func(t *testing.T) {
		assertSQL(`UPDATE public.shift_nurse_access SET status='linked' WHERE shift_id=$1`, current.ID)
		before := count("SELECT count(*) FROM realtime.messages")
		ended, err := store.EndShift(ctx, alphaAuth, alpha.ID, current.ID)
		if err != nil || ended.EndedAt == nil {
			t.Fatalf("end: %v", err)
		}
		if string(ended.ShiftSnapshot) != string(current.ShiftSnapshot) {
			t.Fatal("end overwrote authoritative snapshot")
		}
		row, err := store.CurrentShift(ctx, alphaAuth, alpha.ID)
		if err != nil || row != nil {
			t.Fatal("ended shift still current")
		}
		previous, err := store.PreviousShifts(ctx, alphaAuth, alpha.ID)
		if err != nil || len(previous) != 1 || !strings.Contains(string(previous[0].PatientSuggestions), "AB") || strings.Contains(string(previous[0].NurseSuggestions), "maxPatientLoad") {
			t.Fatalf("carryover missing/wrong: %v", err)
		}
		if count("SELECT count(*) FROM public.shift_nurse_access WHERE shift_id=$1 AND status='linked'", current.ID) != 1 || count("SELECT count(*) FROM public.shift_nurse_invites WHERE shift_id=$1 AND status='active'", current.ID) != 0 {
			t.Fatal("end access/invite semantics changed")
		}
		if count("SELECT count(*) FROM realtime.messages") <= before {
			t.Fatal("ended broadcast missing")
		}
		if _, err := store.EndShift(ctx, alphaAuth, alpha.ID, current.ID); !errors.Is(err, ErrShiftNotFound) {
			t.Fatal("repeated end changed carryover")
		}
		for _, owner := range []string{beta.ID, alpha.ID} {
			previous, err := store.PreviousShifts(ctx, betaAuth, owner)
			if err != nil || len(previous) != 0 {
				t.Fatal("carryover owner isolation failed")
			}
		}
	})
	t.Run("empty end clears old suggestions and immutable grants", func(t *testing.T) {
		row, err := store.StartShift(ctx, alphaAuth, alpha.ID, alphaTemplate.ID)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := store.EndShift(ctx, alphaAuth, alpha.ID, row.ID); err != nil {
			t.Fatal(err)
		}
		previous, err := store.PreviousShifts(ctx, alphaAuth, alpha.ID)
		if err != nil || len(previous) != 0 {
			t.Fatal("empty shift retained old suggestions")
		}
		for _, statement := range []string{
			"UPDATE public.active_shifts SET charge_profile_id=charge_profile_id WHERE false",
			"UPDATE public.active_shifts SET floor_template_id=floor_template_id WHERE false",
			"DELETE FROM public.active_shifts WHERE false",
			// Milestone 4 deliberately granted invite and access reads and invite
			// issuing, but never deletes or edits of identity, ownership, or hashes.
			"DELETE FROM public.shift_nurse_invites WHERE false",
			"DELETE FROM public.shift_nurse_access WHERE false",
			"UPDATE public.shift_nurse_invites SET token_hash=token_hash WHERE false",
			"UPDATE public.shift_nurse_invites SET shift_id=shift_id WHERE false",
			"UPDATE public.shift_nurse_access SET shift_id=shift_id WHERE false",
			"UPDATE public.profiles SET role=role WHERE false",
			"DELETE FROM public.profiles WHERE false",
		} {
			err := store.db.Exec(statement).Error
			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != "42501" {
				t.Fatalf("unexpected privilege: %s: %v", statement, err)
			}
		}
	})
	t.Run("clock skew revision advances", func(t *testing.T) {
		future := time.Now().UTC().Add(time.Hour).Truncate(time.Microsecond)
		if !nextShiftTime(future).After(future) {
			t.Fatal("revision went backwards")
		}
	})
	t.Run("end and template deletion use parent before shift lock", func(t *testing.T) {
		template := newTemplate(alpha)
		row, err := store.StartShift(ctx, alphaAuth, alpha.ID, template.ID)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			if _, err := admin.Exec("DELETE FROM public.active_shifts WHERE id=$1", row.ID); err != nil {
				t.Error(err)
			}
		})
		setup := readSetup(row)
		setup.Nurses = []shifts.Nurse{{ID: "n", Name: "Nurse", LicenseType: "RN", ExperienceLevel: "mid", MaxPatientLoad: 5}}
		if _, err := store.SaveShiftSetup(ctx, alphaAuth, alpha.ID, row.ID, row.UpdatedAt, setup); err != nil {
			t.Fatal(err)
		}
		parent, err := admin.BeginTx(ctx, nil)
		if err != nil {
			t.Fatal(err)
		}
		defer parent.Rollback()
		var locked string
		if err := parent.QueryRow("SELECT id FROM public.floor_templates WHERE id=$1 FOR UPDATE", template.ID).Scan(&locked); err != nil {
			t.Fatal(err)
		}
		ended := make(chan error, 1)
		go func() { _, err := store.EndShift(ctx, alphaAuth, alpha.ID, row.ID); ended <- err }()
		waiting := false
		deadline := time.Now().Add(2 * time.Second)
		for time.Now().Before(deadline) {
			if err := admin.QueryRow(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='nurseflow_go' AND wait_event_type='Lock' AND query LIKE '%floor_templates%' AND query LIKE '%KEY SHARE%')`).Scan(&waiting); err != nil {
				t.Fatal(err)
			}
			if waiting {
				break
			}
			time.Sleep(10 * time.Millisecond)
		}
		if !waiting {
			t.Fatal("end did not wait on the parent before locking the shift")
		}
		// This DELETE must acquire the child shift lock without deadlocking End.
		if _, err := parent.Exec("DELETE FROM public.floor_templates WHERE id=$1", template.ID); err != nil {
			t.Fatal(err)
		}
		if err := parent.Commit(); err != nil {
			t.Fatal(err)
		}
		if err := <-ended; !errors.Is(err, ErrTemplateNotFound) {
			t.Fatalf("deleted parent did not produce controlled missing result: %v", err)
		}
	})
}

// Safe, read-only verification for development or the local baseline. Counts
// depend on fixture state; every returned resource must belong to its identity.
func TestShiftWorkspaceIsolationIntegration(t *testing.T) {
	store := openIntegrationStore(t)
	ctx := context.Background()
	alphaAuth := fixtureAuthID(t, "NURSEFLOW_TEST_ALPHA_ID")
	betaAuth := fixtureAuthID(t, "NURSEFLOW_TEST_BETA_ID")
	alpha, err := store.ProfileByAuthUserID(ctx, alphaAuth)
	if err != nil {
		t.Fatal(err)
	}
	beta, err := store.ProfileByAuthUserID(ctx, betaAuth)
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name, authID, profileID string
		mayRead                 bool
	}{
		{"Alpha", alphaAuth, alpha.ID, true}, {"Beta", betaAuth, beta.ID, true},
		{"Alpha cannot read Beta", alphaAuth, beta.ID, false}, {"Beta cannot read Alpha", betaAuth, alpha.ID, false},
		{"Regular cannot read Alpha", fixtureAuthID(t, "NURSEFLOW_TEST_REGULAR_ID"), alpha.ID, false},
		{"Unknown cannot read Alpha", "ffffffff-ffff-ffff-ffff-ffffffffffff", alpha.ID, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			row, err := store.CurrentShift(ctx, test.authID, test.profileID)
			if err != nil {
				t.Fatal(err)
			}
			if row != nil && (!test.mayRead || row.ChargeProfileID != test.profileID || row.EndedAt != nil) {
				t.Fatal("active shift isolation failed")
			}
			previous, err := store.PreviousShifts(ctx, test.authID, test.profileID)
			if err != nil {
				t.Fatal(err)
			}
			if !test.mayRead && len(previous) != 0 {
				t.Fatal("carry-over isolation failed")
			}
			for _, snapshot := range previous {
				if snapshot.ChargeProfileID != test.profileID {
					t.Fatal("carry-over owner mismatch")
				}
			}
		})
	}
}

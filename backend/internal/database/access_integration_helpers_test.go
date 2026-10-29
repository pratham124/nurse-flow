package database

import (
	"context"
	"database/sql"
	"net/url"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/pratham124/nurse-flow/backend/internal/invites"
)

// accessSnapshot has three nurses and three beds on one side. n1 (Nina) has an
// occupied bed b1 and an empty bed b3, n2 (Omar) only a blank-initials bed b2,
// and n3 (Pia) nothing. Request q1 completed through an override, q2 belongs to
// another nurse, and q3 is Nina's request without a completed override.
const accessSnapshot = `{
  "floorName": "Test Floor",
  "doctorSides": [{"id":"d1","name":"A"},{"id":"d2","name":"B"}],
  "rooms": [{"id":"r1","doctorSideId":"d1","label":"101"}],
  "beds": [{"id":"b1","roomId":"r1","label":"101A"},{"id":"b2","roomId":"r1","label":"101B"},{"id":"b3","roomId":"r1","label":"101C"}],
  "nurses": [{"id":"n1","name":"Nina"},{"id":"n2","name":"Omar"},{"id":"n3","name":"Pia"}],
  "bedStates": [{"id":"s1","bedId":"b1","patient":{"initials":"AB"},"acuity":"red"},{"id":"s2","bedId":"b2","patient":{"initials":"  "}}],
  "assignmentResult": {"id":"res1","bedAssignments":[
    {"bedId":"b1","nurseId":"n1"},{"bedId":"b2","nurseId":"n2"},{"bedId":"b3","nurseId":"n1"}]},
  "nurseRequests": [
    {"id":"q1","requestingNurseId":"n1","completedOverrideId":"00000000-0000-4000-8000-0000000000aa"},
    {"id":"q2","requestingNurseId":"n2"},
    {"id":"q3","requestingNurseId":"n1"}]
}`

// accessFixture bundles an isolated local database with its fixture identities.
type accessFixture struct {
	store     *Store
	admin     *sql.DB
	alpha     Profile
	beta      Profile
	alphaAuth string
	betaAuth  string
}

// openAccessFixture skips unless the explicit local database is configured. The
// admin connection stages rows the limited role must never be able to create.
func openAccessFixture(t *testing.T) *accessFixture {
	t.Helper()
	if os.Getenv("NURSEFLOW_TEST_DATABASE_URL") == "" {
		t.Skip("access tests stage rows and need the isolated local Postgres")
	}
	store := openIntegrationStore(t)
	adminURL, err := url.Parse(os.Getenv("NURSEFLOW_TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	adminURL.User = url.User("postgres")
	admin, err := sql.Open("pgx", adminURL.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close() })
	fixture := &accessFixture{store: store, admin: admin}
	fixture.alphaAuth = fixtureAuthID(t, "NURSEFLOW_TEST_ALPHA_ID")
	fixture.betaAuth = fixtureAuthID(t, "NURSEFLOW_TEST_BETA_ID")
	fixture.alpha, err = store.ProfileByAuthUserID(contextForTest(), fixture.alphaAuth)
	if err != nil {
		t.Fatal(err)
	}
	fixture.beta, err = store.ProfileByAuthUserID(contextForTest(), fixture.betaAuth)
	if err != nil {
		t.Fatal(err)
	}
	return fixture
}

func (f *accessFixture) exec(t *testing.T, query string, args ...any) {
	t.Helper()
	if _, err := f.admin.Exec(query, args...); err != nil {
		t.Fatal(err)
	}
}

func (f *accessFixture) count(t *testing.T, query string, args ...any) int {
	t.Helper()
	var n int
	if err := f.admin.QueryRow(query, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func (f *accessFixture) text(t *testing.T, query string, args ...any) string {
	t.Helper()
	var value sql.NullString
	if err := f.admin.QueryRow(query, args...).Scan(&value); err != nil {
		t.Fatal(err)
	}
	return value.String
}

// newProfile creates a fresh Auth user and profile through the Go code under test.
func (f *accessFixture) newProfile(t *testing.T, name string) Profile {
	t.Helper()
	authID := uuid.NewString()
	f.exec(t, "INSERT INTO auth.users(id) VALUES ($1)", authID)
	profile, err := f.store.EnsureProfile(contextForTest(), authID, name)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		f.exec(t, "DELETE FROM public.active_shifts WHERE charge_profile_id = $1", profile.ID)
		f.exec(t, "DELETE FROM public.profiles WHERE id = $1", profile.ID)
		f.exec(t, "DELETE FROM auth.users WHERE id = $1", authID)
	})
	return profile
}

// stageShift inserts an unended shift for a charge profile as the local admin.
func (f *accessFixture) stageShift(t *testing.T, chargeProfileID, snapshot string) string {
	t.Helper()
	id := uuid.NewString()
	f.exec(t, "INSERT INTO public.active_shifts(id, charge_profile_id, status, shift_snapshot) VALUES ($1, $2, 'assigned', $3::jsonb)", id, chargeProfileID, snapshot)
	t.Cleanup(func() { f.exec(t, "DELETE FROM public.active_shifts WHERE id = $1", id) })
	return id
}

// stageOverride moves a bed to another nurse as an active manual override.
func (f *accessFixture) stageOverride(t *testing.T, shiftID, createdBy, bedID, from, to string) string {
	t.Helper()
	id := uuid.NewString()
	f.exec(t, `INSERT INTO public.manual_assignment_overrides
		(id, shift_id, baseline_assignment_result_id, bed_id, from_nurse_id, to_nurse_id, created_by_profile_id, status, client_mutation_id)
		VALUES ($1, $2, 'res1', $3, $4, $5, $6, 'active', $7)`, id, shiftID, bedID, from, to, createdBy, uuid.NewString())
	return id
}

// issue creates a real invite for a nurse and returns the raw code, as the API would.
func (f *accessFixture) issue(t *testing.T, owner Profile, shiftID, nurseID string, regenerate bool) (code string, invite InviteRow) {
	t.Helper()
	code, err := invites.GenerateCode()
	if err != nil {
		t.Fatal(err)
	}
	create := f.store.CreateInvite
	if regenerate {
		create = f.store.RegenerateInvite
	}
	invite, err = create(contextForTest(), owner.AuthUserID, owner.ID, shiftID, nurseID, invites.HashCode(code))
	if err != nil {
		t.Fatal(err)
	}
	return code, invite
}

func contextForTest() context.Context { return context.Background() }

// rpcAs runs a query as the retained client-facing database functions would see
// the user (auth.uid() reads this setting). It is used only to compare Go's
// results with the original SQL behavior.
func (f *accessFixture) rpcAs(t *testing.T, authUserID, query string, args ...any) string {
	t.Helper()
	tx, err := f.admin.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err := tx.Exec("SELECT set_config('request.jwt.claim.sub', $1, true)", authUserID); err != nil {
		t.Fatal(err)
	}
	var value sql.NullString
	if err := tx.QueryRow(query, args...).Scan(&value); err != nil {
		t.Fatal(err)
	}
	return value.String
}

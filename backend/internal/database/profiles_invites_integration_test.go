package database

import (
	"errors"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/pratham124/nurse-flow/backend/internal/invites"
	"gorm.io/gorm"
)

func TestEnsureProfileIntegration(t *testing.T) {
	f := openAccessFixture(t)
	ctx := contextForTest()

	t.Run("concurrent first sign-in creates one row and both succeed", func(t *testing.T) {
		authID := uuid.NewString()
		f.exec(t, "INSERT INTO auth.users(id) VALUES ($1)", authID)
		t.Cleanup(func() {
			f.exec(t, "DELETE FROM public.profiles WHERE auth_user_id = $1", authID)
			f.exec(t, "DELETE FROM auth.users WHERE id = $1", authID)
		})
		if _, err := f.store.ProfileByAuthUserID(ctx, authID); !errors.Is(err, ErrProfileNotFound) {
			t.Fatalf("before sign-in err = %v", err)
		}
		const callers = 8
		profiles := make([]Profile, callers)
		failures := make([]error, callers)
		var wg sync.WaitGroup
		for i := range callers {
			wg.Add(1)
			go func() {
				defer wg.Done()
				profiles[i], failures[i] = f.store.EnsureProfile(ctx, authID, "Racer")
			}()
		}
		wg.Wait()
		for i := range callers {
			if failures[i] != nil {
				t.Fatalf("caller %d failed: %v", i, failures[i])
			}
			if profiles[i].ID == "" || profiles[i].ID != profiles[0].ID || profiles[i].Role != "charge_nurse" || profiles[i].DisplayName != "Racer" || profiles[i].AuthUserID != authID {
				t.Fatalf("caller %d got %+v", i, profiles[i])
			}
		}
		if n := f.count(t, "SELECT count(*) FROM public.profiles WHERE auth_user_id = $1", authID); n != 1 {
			t.Fatalf("%d profile rows", n)
		}
	})

	t.Run("an existing profile is returned unchanged", func(t *testing.T) {
		profile, err := f.store.EnsureProfile(ctx, f.alphaAuth, "Someone Else")
		if err != nil || profile.ID != f.alpha.ID || profile.DisplayName != f.alpha.DisplayName || profile.Role != "charge_nurse" {
			t.Fatalf("profile = %+v, err = %v", profile, err)
		}
		// Even a regular-nurse profile is returned as data, never rewritten.
		regular, err := f.store.EnsureProfile(ctx, fixtureAuthID(t, "NURSEFLOW_TEST_REGULAR_ID"), "Nope")
		if err != nil || regular.Role != "regular_nurse" {
			t.Fatalf("regular profile = %+v, err = %v", regular, err)
		}
	})

	t.Run("the database refuses forged profile inserts", func(t *testing.T) {
		other := uuid.NewString()
		f.exec(t, "INSERT INTO auth.users(id) VALUES ($1)", other)
		t.Cleanup(func() { f.exec(t, "DELETE FROM auth.users WHERE id = $1", other) })
		forged := []struct{ name, auth, role string }{
			{"someone else's identity", other, "charge_nurse"},
			{"a client-chosen role", f.alphaAuth, "regular_nurse"},
		}
		for _, attempt := range forged {
			err := f.store.WithWriteIdentity(ctx, f.betaAuth, func(tx *gorm.DB) error {
				return tx.Exec("INSERT INTO public.profiles (auth_user_id, display_name, role) VALUES (?, 'Forged', ?)", attempt.auth, attempt.role).Error
			})
			if err == nil {
				t.Fatalf("%s was accepted", attempt.name)
			}
		}
		err := f.store.WithWriteIdentity(ctx, other, func(tx *gorm.DB) error {
			return tx.Exec("INSERT INTO public.profiles (auth_user_id, display_name, role) VALUES (?, 'Boss', 'regular_nurse')", other).Error
		})
		if err == nil {
			t.Fatal("the database accepted a non-charge role")
		}
		if n := f.count(t, "SELECT count(*) FROM public.profiles WHERE auth_user_id = $1", other); n != 0 {
			t.Fatal("a forged profile was stored")
		}
	})
}

func TestInviteGenerationIntegration(t *testing.T) {
	f := openAccessFixture(t)
	ctx := contextForTest()
	shiftID := f.stageShift(t, f.alpha.ID, accessSnapshot)
	create := func(owner Profile, shift, nurse, hash string, regenerate bool) (InviteRow, error) {
		if regenerate {
			return f.store.RegenerateInvite(ctx, owner.AuthUserID, owner.ID, shift, nurse, hash)
		}
		return f.store.CreateInvite(ctx, owner.AuthUserID, owner.ID, shift, nurse, hash)
	}
	freshHash := func() string {
		code, err := invites.GenerateCode()
		if err != nil {
			t.Fatal(err)
		}
		return invites.HashCode(code)
	}

	t.Run("another charge nurse cannot read or generate", func(t *testing.T) {
		if _, err := f.store.ListInvites(ctx, f.betaAuth, f.beta.ID, shiftID); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("list err = %v", err)
		}
		if _, err := create(f.beta, shiftID, "n1", freshHash(), false); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("generate err = %v", err)
		}
		// Claiming the owner's profile ID with Beta's verified identity is also denied.
		if _, err := f.store.CreateInvite(ctx, f.betaAuth, f.alpha.ID, shiftID, "n1", freshHash()); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("spoofed profile err = %v", err)
		}
		// The database policy itself refuses a forged insert.
		err := f.store.WithWriteIdentity(ctx, f.betaAuth, func(tx *gorm.DB) error {
			return tx.Exec(`INSERT INTO public.shift_nurse_invites (shift_id, nurse_id, created_by_profile_id, token_hash, status, expires_at)
				VALUES (?, 'n1', ?, ?, 'active', now() + interval '1 day')`, shiftID, f.beta.ID, freshHash()).Error
		})
		if err == nil {
			t.Fatal("policy accepted an invite on another charge nurse's shift")
		}
		if n := f.count(t, "SELECT count(*) FROM public.shift_nurse_invites WHERE shift_id = $1", shiftID); n != 0 {
			t.Fatalf("%d invites stored", n)
		}
	})

	t.Run("eligibility follows the stored snapshot and active overrides", func(t *testing.T) {
		if _, err := create(f.alpha, shiftID, "ghost", freshHash(), false); !errors.Is(err, ErrNurseNotOnShift) {
			t.Fatalf("unknown nurse err = %v", err)
		}
		if _, err := create(f.alpha, shiftID, "n2", freshHash(), false); !errors.Is(err, ErrNurseUnassigned) {
			t.Fatalf("blank-initials nurse err = %v", err)
		}
		if _, err := create(f.alpha, shiftID, "n3", freshHash(), false); !errors.Is(err, ErrNurseUnassigned) {
			t.Fatalf("bedless nurse err = %v", err)
		}
		overrideID := f.stageOverride(t, shiftID, f.alpha.ID, "b1", "n1", "n2")
		if _, err := create(f.alpha, shiftID, "n1", freshHash(), false); !errors.Is(err, ErrNurseUnassigned) {
			t.Fatalf("nurse whose bed moved away err = %v", err)
		}
		invite, err := create(f.alpha, shiftID, "n2", freshHash(), false)
		if err != nil || invite.NurseID != "n2" {
			t.Fatalf("nurse who received the bed: %+v, %v", invite, err)
		}
		f.exec(t, "DELETE FROM public.shift_nurse_invites WHERE shift_id = $1", shiftID)
		f.exec(t, "DELETE FROM public.manual_assignment_overrides WHERE id = $1", overrideID)
	})

	t.Run("generate, duplicate, and regenerate", func(t *testing.T) {
		first := freshHash()
		invite, err := create(f.alpha, shiftID, "n1", first, false)
		if err != nil {
			t.Fatal(err)
		}
		if invite.Status != "active" || invite.ShiftID != shiftID || invite.CreatedByProfileID != f.alpha.ID || invite.UsedAt != nil {
			t.Fatalf("invite = %+v", invite)
		}
		if hours := invite.ExpiresAt.Sub(invite.CreatedAt).Hours(); hours < 23.99 || hours > 24.01 {
			t.Fatalf("expires %v hours after creation", hours)
		}
		if stored := f.text(t, "SELECT token_hash FROM public.shift_nurse_invites WHERE id = $1", invite.ID); stored != first {
			t.Fatal("only the supplied hash should be stored")
		}
		if _, err := create(f.alpha, shiftID, "n1", freshHash(), false); !errors.Is(err, ErrInviteExists) {
			t.Fatalf("duplicate err = %v", err)
		}
		// The unique index is the backstop if the pre-check is ever bypassed.
		backstop := f.store.WithWriteIdentity(ctx, f.alphaAuth, func(tx *gorm.DB) error {
			return tx.Exec(`INSERT INTO public.shift_nurse_invites (shift_id, nurse_id, created_by_profile_id, token_hash, status, expires_at)
				VALUES (?, 'n1', ?, ?, 'active', now() + interval '1 day')`, shiftID, f.alpha.ID, freshHash()).Error
		})
		if backstop == nil {
			t.Fatal("two active invites for one nurse were stored")
		}

		second := freshHash()
		regenerated, err := create(f.alpha, shiftID, "n1", second, true)
		if err != nil || regenerated.ID == invite.ID {
			t.Fatalf("regenerate: %+v, %v", regenerated, err)
		}
		if status := f.text(t, "SELECT status FROM public.shift_nurse_invites WHERE id = $1", invite.ID); status != "revoked" {
			t.Fatalf("old invite status = %s", status)
		}
		if f.text(t, "SELECT revoked_at::text FROM public.shift_nurse_invites WHERE id = $1", invite.ID) == "" {
			t.Fatal("revoked_at not set")
		}
		if n := f.count(t, "SELECT count(*) FROM public.shift_nurse_invites WHERE shift_id = $1 AND nurse_id = 'n1' AND status = 'active'", shiftID); n != 1 {
			t.Fatalf("%d active invites", n)
		}

		list, err := f.store.ListInvites(ctx, f.alphaAuth, f.alpha.ID, shiftID)
		if err != nil || len(list.Invites) != 2 || list.Invites[0].ID != regenerated.ID || list.Access == nil {
			t.Fatalf("list = %+v, %v", list, err)
		}
	})

	t.Run("a failed regenerate leaves the existing invite active", func(t *testing.T) {
		before := f.text(t, "SELECT id::text FROM public.shift_nurse_invites WHERE shift_id = $1 AND nurse_id = 'n1' AND status = 'active'", shiftID)
		// A too-short hash violates the table's CHECK after the revoke statement ran.
		if _, err := create(f.alpha, shiftID, "n1", "short", true); err == nil {
			t.Fatal("invalid hash accepted")
		}
		after := f.text(t, "SELECT id::text FROM public.shift_nurse_invites WHERE shift_id = $1 AND nurse_id = 'n1' AND status = 'active'", shiftID)
		if before == "" || before != after {
			t.Fatalf("active invite before %q, after %q: revoke was not rolled back", before, after)
		}
	})

	t.Run("concurrent regenerate keeps exactly one active invite", func(t *testing.T) {
		const callers = 5
		var wg sync.WaitGroup
		failures := make([]error, callers)
		for i := range callers {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_, failures[i] = create(f.alpha, shiftID, "n1", freshHash(), true)
			}()
		}
		wg.Wait()
		for _, err := range failures {
			if err != nil {
				t.Fatal(err)
			}
		}
		if n := f.count(t, "SELECT count(*) FROM public.shift_nurse_invites WHERE shift_id = $1 AND nurse_id = 'n1' AND status = 'active'", shiftID); n != 1 {
			t.Fatalf("%d active invites", n)
		}
	})

	t.Run("concurrent first generation yields one winner", func(t *testing.T) {
		f.exec(t, "DELETE FROM public.shift_nurse_invites WHERE shift_id = $1", shiftID)
		const callers = 6
		var wg sync.WaitGroup
		failures := make([]error, callers)
		for i := range callers {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_, failures[i] = create(f.alpha, shiftID, "n1", freshHash(), false)
			}()
		}
		wg.Wait()
		winners := 0
		for _, err := range failures {
			switch {
			case err == nil:
				winners++
			case !errors.Is(err, ErrInviteExists):
				t.Fatalf("unexpected error: %v", err)
			}
		}
		if winners != 1 {
			t.Fatalf("%d generations succeeded", winners)
		}
	})

	t.Run("an ended shift accepts no invites and is not listed", func(t *testing.T) {
		ended := f.stageShift(t, f.alpha.ID, accessSnapshot)
		f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", ended)
		if _, err := create(f.alpha, ended, "n1", freshHash(), false); !errors.Is(err, ErrShiftEnded) {
			t.Fatalf("ended err = %v", err)
		}
		if _, err := f.store.ListInvites(ctx, f.alphaAuth, f.alpha.ID, ended); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("ended list err = %v", err)
		}
		if _, err := create(f.alpha, uuid.NewString(), "n1", freshHash(), false); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("missing shift err = %v", err)
		}
	})
}

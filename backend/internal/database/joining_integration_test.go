package database

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/invites"
	"gorm.io/gorm"
)

func TestInviteJoiningIntegration(t *testing.T) {
	f := openAccessFixture(t)
	ctx := contextForTest()
	validate := func(who Profile, code string) InviteValidation {
		t.Helper()
		result, err := f.store.ValidateInvite(ctx, who.AuthUserID, who.ID, invites.HashCode(code))
		if err != nil {
			t.Fatal(err)
		}
		// The retained SQL function is the behavior authority for every outcome.
		want := f.rpcAs(t, who.AuthUserID, "SELECT status || '/' || coalesce(reason, '') FROM public.validate_shift_nurse_invite_code($1)", invites.HashCode(code))
		if got := result.Status + "/" + result.Reason; got != want {
			t.Fatalf("Go validate = %s, SQL function = %s", got, want)
		}
		return result
	}
	accept := func(who Profile, code string) InviteJoin {
		t.Helper()
		result, err := f.store.AcceptInvite(ctx, who.AuthUserID, who.ID, invites.HashCode(code))
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	blockedValidation := func(who Profile, code, reason string) {
		t.Helper()
		if got := validate(who, code); got.Status != "blocked" || got.Reason != reason {
			t.Fatalf("validate = %+v, want blocked %s", got, reason)
		}
	}
	blockedAccept := func(who Profile, code, reason string) {
		t.Helper()
		if got := accept(who, code); got.Status != "blocked" || got.Reason != reason {
			t.Fatalf("accept = %+v, want blocked %s", got, reason)
		}
	}
	// Both entry points must agree on every blocked reason except the charge-shift rule.
	blockedBoth := func(who Profile, code, reason string) {
		t.Helper()
		blockedValidation(who, code, reason)
		blockedAccept(who, code, reason)
	}

	t.Run("valid code confirms only the nurse, floor, and expiry", func(t *testing.T) {
		shift := f.stageShift(t, f.alpha.ID, accessSnapshot)
		code, invite := f.issue(t, f.alpha, shift, "n1", false)
		joiner := f.newProfile(t, "Joiner")
		got := validate(joiner, code)
		if got.Status != "valid" || got.InviteID != invite.ID || got.ShiftID != shift || got.NurseID != "n1" ||
			got.NurseName != "Nina" || got.FloorName != "Test Floor" || got.ExpiresAt == nil || !got.ExpiresAt.Equal(invite.ExpiresAt) {
			t.Fatalf("validation = %+v", got)
		}
		if n := f.count(t, "SELECT count(*) FROM public.shift_nurse_access WHERE shift_id = $1", shift); n != 0 {
			t.Fatal("validation must not change anything")
		}
		if status := f.text(t, "SELECT status FROM public.shift_nurse_invites WHERE id = $1", invite.ID); status != "active" {
			t.Fatalf("validation changed the invite to %s", status)
		}
	})

	t.Run("unknown and revoked codes", func(t *testing.T) {
		shift := f.stageShift(t, f.alpha.ID, accessSnapshot)
		oldCode, _ := f.issue(t, f.alpha, shift, "n1", false)
		newCode, _ := f.issue(t, f.alpha, shift, "n1", true)
		joiner := f.newProfile(t, "Joiner")
		blockedBoth(joiner, "ZZZZZZ", invites.ReasonNotFound)
		blockedBoth(joiner, oldCode, invites.ReasonRevoked)
		if got := validate(joiner, newCode); got.Status != "valid" {
			t.Fatalf("regenerated code = %+v", got)
		}
		if got := accept(joiner, newCode); got.Status != "joined" {
			t.Fatalf("regenerated code join = %+v", got)
		}
		// The revoked code still cannot join, even after the nurse slot is taken.
		other := f.newProfile(t, "Other")
		blockedBoth(other, oldCode, invites.ReasonRevoked)
	})

	t.Run("expired by status or by time", func(t *testing.T) {
		shift := f.stageShift(t, f.alpha.ID, accessSnapshot)
		byTime, timed := f.issue(t, f.alpha, shift, "n1", false)
		f.exec(t, "UPDATE public.shift_nurse_invites SET created_at = now() - interval '2 days', expires_at = now() - interval '1 day' WHERE id = $1", timed.ID)
		joiner := f.newProfile(t, "Joiner")
		blockedBoth(joiner, byTime, invites.ReasonExpired)
		byStatus, flagged := f.issue(t, f.alpha, shift, "n1", true)
		f.exec(t, "UPDATE public.shift_nurse_invites SET status = 'expired' WHERE id = $1", flagged.ID)
		blockedBoth(joiner, byStatus, invites.ReasonExpired)
		if n := f.count(t, "SELECT count(*) FROM public.shift_nurse_access WHERE shift_id = $1", shift); n != 0 {
			t.Fatal("a blocked accept created access")
		}
	})

	t.Run("ended shift and stale nurse", func(t *testing.T) {
		ended := f.stageShift(t, f.alpha.ID, accessSnapshot)
		endedCode, _ := f.issue(t, f.alpha, ended, "n1", false)
		f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", ended)
		stale := f.stageShift(t, f.alpha.ID, accessSnapshot)
		staleCode, _ := f.issue(t, f.alpha, stale, "n1", false)
		f.exec(t, `UPDATE public.active_shifts SET shift_snapshot = jsonb_set(shift_snapshot, '{nurses}', '[{"id":"n2","name":"Omar"}]') WHERE id = $1`, stale)
		joiner := f.newProfile(t, "Joiner")
		blockedBoth(joiner, endedCode, invites.ReasonEndedShift)
		blockedBoth(joiner, staleCode, invites.ReasonStaleNurse)
	})

	t.Run("joining links the slot, uses the invite, and blocks reuse", func(t *testing.T) {
		shift := f.stageShift(t, f.alpha.ID, accessSnapshot)
		code, invite := f.issue(t, f.alpha, shift, "n1", false)
		first, second := f.newProfile(t, "First"), f.newProfile(t, "Second")
		joined := accept(first, code)
		if joined.Status != "joined" || joined.AccessID == "" || joined.ShiftID != shift || joined.NurseID != "n1" || joined.NurseName != "Nina" || joined.FloorName != "Test Floor" {
			t.Fatalf("joined = %+v", joined)
		}
		if f.text(t, "SELECT nurse_profile_id::text FROM public.shift_nurse_access WHERE id = $1", joined.AccessID) != first.ID ||
			f.text(t, "SELECT status FROM public.shift_nurse_access WHERE id = $1", joined.AccessID) != "linked" ||
			f.text(t, "SELECT nurse_email FROM public.shift_nurse_access WHERE id = $1", joined.AccessID) != "" ||
			f.text(t, "SELECT nurse_name FROM public.shift_nurse_access WHERE id = $1", joined.AccessID) != "Nina" {
			t.Fatal("access row was not linked to the joining profile with the snapshot name")
		}
		row := f.text(t, "SELECT status || ',' || used_by_profile_id::text || ',' || (used_at IS NOT NULL)::text FROM public.shift_nurse_invites WHERE id = $1", invite.ID)
		if row != "used,"+first.ID+",true" {
			t.Fatalf("invite row = %s", row)
		}
		blockedBoth(second, code, invites.ReasonAlreadyUsed)
		// The used code stays unusable even for the profile that used it.
		blockedBoth(first, code, invites.ReasonAlreadyUsed)

		// A new code for a slot that another profile holds is refused as already used.
		newCode, _ := f.issue(t, f.alpha, shift, "n1", false)
		if got := validate(second, newCode); got.Status != "valid" {
			t.Fatalf("validate does not check the slot owner (baseline): %+v", got)
		}
		blockedAccept(second, newCode, invites.ReasonAlreadyUsed)
		// The same profile reuses its own linked row.
		again := accept(first, newCode)
		if again.Status != "joined" || again.AccessID != joined.AccessID {
			t.Fatalf("own slot not reused: %+v", again)
		}
		if n := f.count(t, "SELECT count(*) FROM public.shift_nurse_access WHERE shift_id = $1", shift); n != 1 {
			t.Fatalf("%d access rows", n)
		}
	})

	t.Run("pending and removed rows are relinked, newest first", func(t *testing.T) {
		for _, state := range []string{"pending_link", "removed"} {
			shift := f.stageShift(t, f.alpha.ID, accessSnapshot)
			f.exec(t, "INSERT INTO public.shift_nurse_access(shift_id, nurse_id, nurse_name, status, nurse_email, updated_at) VALUES ($1, 'n1', 'Old Name', 'removed', 'old@example.com', now() - interval '1 hour')", shift)
			var rowID string
			if err := f.admin.QueryRow("INSERT INTO public.shift_nurse_access(shift_id, nurse_id, nurse_name, status, nurse_email) VALUES ($1, 'n1', 'Typed Name', $2, 'typed@example.com') RETURNING id::text", shift, state).Scan(&rowID); err != nil {
				t.Fatal(err)
			}
			code, _ := f.issue(t, f.alpha, shift, "n1", false)
			joiner := f.newProfile(t, "Joiner")
			joined := accept(joiner, code)
			if joined.Status != "joined" || joined.AccessID != rowID {
				t.Fatalf("%s: joined = %+v, want access %s", state, joined, rowID)
			}
			if got := f.text(t, "SELECT status || '|' || nurse_name || '|' || coalesce(nurse_email, 'NULL') FROM public.shift_nurse_access WHERE id = $1", rowID); got != "linked|Nina|NULL" {
				t.Fatalf("%s: relinked row = %s", state, got)
			}
			if n := f.count(t, "SELECT count(*) FROM public.shift_nurse_access WHERE shift_id = $1", shift); n != 2 {
				t.Fatalf("%s: %d access rows", state, n)
			}
		}
	})

	t.Run("participation conflicts", func(t *testing.T) {
		shiftA := f.stageShift(t, f.alpha.ID, accessSnapshot)
		shiftB := f.stageShift(t, f.beta.ID, accessSnapshot)
		codeA, _ := f.issue(t, f.alpha, shiftA, "n1", false)
		codeB, _ := f.issue(t, f.beta, shiftB, "n1", false)
		joiner := f.newProfile(t, "Joiner")
		if got := accept(joiner, codeA); got.Status != "joined" {
			t.Fatalf("first join = %+v", got)
		}
		blockedBoth(joiner, codeB, invites.ReasonParticipationConflict)

		// A charge nurse running an open shift cannot join another. The original
		// validate function has no such check, so only accept refuses.
		if got := validate(f.alpha, codeB); got.Status != "valid" {
			t.Fatalf("validate for a running charge nurse = %+v", got)
		}
		blockedAccept(f.alpha, codeB, invites.ReasonParticipationConflict)

		// Once the first shift has ended the profile is free to join elsewhere.
		f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", shiftA)
		if got := accept(joiner, codeB); got.Status != "joined" {
			t.Fatalf("join after the first shift ended = %+v", got)
		}
	})

	t.Run("two profiles accepting one code: one joins, one is already used", func(t *testing.T) {
		// The window is narrow, so race many fresh codes.
		for attempt := range 25 {
			shift := f.stageShift(t, f.alpha.ID, accessSnapshot)
			code, _ := f.issue(t, f.alpha, shift, "n1", false)
			people := []Profile{f.newProfile(t, "Racer one"), f.newProfile(t, "Racer two"), f.newProfile(t, "Racer three")}
			results := make([]InviteJoin, len(people))
			var wg sync.WaitGroup
			start := make(chan struct{})
			for i, person := range people {
				wg.Add(1)
				go func() {
					defer wg.Done()
					<-start
					var err error
					results[i], err = f.store.AcceptInvite(ctx, person.AuthUserID, person.ID, invites.HashCode(code))
					if err != nil {
						t.Error(err)
					}
				}()
			}
			close(start)
			wg.Wait()
			joined, used := 0, 0
			for _, result := range results {
				switch {
				case result.Status == "joined":
					joined++
				case result.Status == "blocked" && result.Reason == invites.ReasonAlreadyUsed:
					used++
				default:
					t.Fatalf("unexpected result %+v", result)
				}
			}
			if joined != 1 || used != len(people)-1 {
				t.Fatalf("attempt %d: joined=%d used=%d", attempt, joined, used)
			}
			if n := f.count(t, "SELECT count(*) FROM public.shift_nurse_access WHERE shift_id = $1 AND status = 'linked'", shift); n != 1 {
				t.Fatalf("%d linked rows", n)
			}
		}
	})

	t.Run("one profile accepting two shifts at once: one joins, one conflicts", func(t *testing.T) {
		// The window between the two joins is narrow, so race many fresh pairs.
		for attempt := range 25 {
			shiftA := f.stageShift(t, f.alpha.ID, accessSnapshot)
			shiftB := f.stageShift(t, f.beta.ID, accessSnapshot)
			codeA, _ := f.issue(t, f.alpha, shiftA, "n1", false)
			codeB, _ := f.issue(t, f.beta, shiftB, "n1", false)
			joiner := f.newProfile(t, "Double booked")
			results := make([]InviteJoin, 2)
			var wg sync.WaitGroup
			start := make(chan struct{})
			for i, code := range []string{codeA, codeB} {
				wg.Add(1)
				go func() {
					defer wg.Done()
					<-start
					var err error
					results[i], err = f.store.AcceptInvite(ctx, joiner.AuthUserID, joiner.ID, invites.HashCode(code))
					if err != nil {
						t.Error(err)
					}
				}()
			}
			close(start)
			wg.Wait()
			joined, conflicts := 0, 0
			for _, result := range results {
				switch {
				case result.Status == "joined":
					joined++
				case result.Status == "blocked" && result.Reason == invites.ReasonParticipationConflict:
					conflicts++
				default:
					t.Fatalf("unexpected result %+v", result)
				}
			}
			if joined != 1 || conflicts != 1 {
				t.Fatalf("attempt %d: joined=%d conflicts=%d", attempt, joined, conflicts)
			}
			if n := f.count(t, "SELECT count(*) FROM public.shift_nurse_access WHERE nurse_profile_id = $1 AND status = 'linked'", joiner.ID); n != 1 {
				t.Fatalf("%d linked rows for one profile", n)
			}
		}
	})

	t.Run("the hash capability unlocks only its own invite", func(t *testing.T) {
		shift := f.stageShift(t, f.alpha.ID, accessSnapshot)
		otherShift := f.stageShift(t, f.alpha.ID, accessSnapshot)
		code, invite := f.issue(t, f.alpha, shift, "n1", false)
		otherCode, otherInvite := f.issue(t, f.alpha, otherShift, "n1", false)
		joiner := f.newProfile(t, "Joiner")
		hash, otherHash := invites.HashCode(code), invites.HashCode(otherCode)
		visible := func(hash string) (inviteIDs, shiftIDs, accessRows int) {
			t.Helper()
			read := func(tx *gorm.DB) error {
				if err := tx.Raw("SELECT count(*) FROM public.shift_nurse_invites").Scan(&inviteIDs).Error; err != nil {
					return err
				}
				if err := tx.Raw("SELECT count(*) FROM public.active_shifts").Scan(&shiftIDs).Error; err != nil {
					return err
				}
				return tx.Raw("SELECT count(*) FROM public.shift_nurse_access").Scan(&accessRows).Error
			}
			var err error
			if hash == "" {
				err = f.store.WithIdentity(ctx, joiner.AuthUserID, read)
			} else {
				err = f.store.WithInviteCodeRead(ctx, joiner.AuthUserID, hash, read)
			}
			if err != nil {
				t.Fatal(err)
			}
			return
		}
		// Make sure the pool's connection reuse cannot leak the capability.
		f.store.pool.SetMaxOpenConns(1)
		f.store.pool.SetMaxIdleConns(1)
		defer f.store.pool.SetMaxOpenConns(5)
		defer f.store.pool.SetMaxIdleConns(2)
		if i, s, a := visible(""); i != 0 || s != 0 || a != 0 {
			t.Fatalf("no hash: invites=%d shifts=%d access=%d", i, s, a)
		}
		if i, s, a := visible(hash); i != 1 || s != 1 || a != 0 {
			t.Fatalf("with hash: invites=%d shifts=%d access=%d", i, s, a)
		}
		if i, s, _ := visible(invites.HashCode("ZZZZZZ")); i != 0 || s != 0 {
			t.Fatalf("wrong hash: invites=%d shifts=%d", i, s)
		}
		if i, s, a := visible(""); i != 0 || s != 0 || a != 0 {
			t.Fatalf("capability leaked past its transaction: invites=%d shifts=%d access=%d", i, s, a)
		}
		// The hash also does not grant write access beyond joining.
		writes := map[string]string{
			"mark another invite used": `UPDATE public.shift_nurse_invites SET status = 'used', used_by_profile_id = '` + joiner.ID + `' WHERE id = '` + otherInvite.ID + `'`,
			"set a different status":   `UPDATE public.shift_nurse_invites SET status = 'revoked' WHERE id = '` + invite.ID + `'`,
			"credit another profile":   `UPDATE public.shift_nurse_invites SET status = 'used', used_by_profile_id = '` + f.beta.ID + `' WHERE id = '` + invite.ID + `'`,
			"change the shift":         `UPDATE public.active_shifts SET status = 'setup'`,
			"link another profile":     `INSERT INTO public.shift_nurse_access(shift_id, nurse_id, nurse_name, nurse_profile_id, status, updated_at) VALUES ('` + shift + `', 'n1', 'Nina', '` + f.beta.ID + `', 'linked', now())`,
			"link a different nurse":   `INSERT INTO public.shift_nurse_access(shift_id, nurse_id, nurse_name, nurse_profile_id, status, updated_at) VALUES ('` + shift + `', 'n2', 'Omar', '` + joiner.ID + `', 'linked', now())`,
			"link another shift":       `INSERT INTO public.shift_nurse_access(shift_id, nurse_id, nurse_name, nurse_profile_id, status, updated_at) VALUES ('` + otherShift + `', 'n1', 'Nina', '` + joiner.ID + `', 'linked', now())`,
			"issue an invite":          `INSERT INTO public.shift_nurse_invites(shift_id, nurse_id, created_by_profile_id, token_hash, status, expires_at) VALUES ('` + shift + `', 'n2', '` + joiner.ID + `', '` + otherHash + `', 'active', now() + interval '1 day')`,
		}
		for name, statement := range writes {
			err := f.store.WithInviteCodeWrite(ctx, joiner.AuthUserID, hash, func(tx *gorm.DB) error {
				result := tx.Exec(statement)
				if result.Error != nil {
					return result.Error
				}
				if result.RowsAffected == 0 {
					return gorm.ErrRecordNotFound // hidden by policy: nothing changed
				}
				return errors.New("write was accepted")
			})
			if err == nil || err.Error() == "write was accepted" {
				t.Fatalf("%s: capability allowed it (err=%v)", name, err)
			}
		}
		if status := f.text(t, "SELECT status FROM public.shift_nurse_invites WHERE id = $1", otherInvite.ID); status != "active" {
			t.Fatalf("other invite is now %s", status)
		}
	})
}

// Milestone 3's ownership-only UPDATE policies would otherwise let a charge owner
// use the new column grants to attach access or a used invite to any profile.
func TestChargeOwnerCannotForgeJoinsIntegration(t *testing.T) {
	f := openAccessFixture(t)
	ctx := contextForTest()
	shift := f.stageShift(t, f.alpha.ID, accessSnapshot)
	code, invite := f.issue(t, f.alpha, shift, "n1", false)
	_ = code
	var accessID string
	if err := f.admin.QueryRow("INSERT INTO public.shift_nurse_access(shift_id, nurse_id, nurse_name, status) VALUES ($1, 'n1', 'Nina', 'pending_link') RETURNING id::text", shift).Scan(&accessID); err != nil {
		t.Fatal(err)
	}
	asOwner := func(statement string, args ...any) error {
		return f.store.WithWriteIdentity(ctx, f.alphaAuth, func(tx *gorm.DB) error {
			return tx.Exec(statement, args...).Error
		})
	}
	denied := map[string]string{
		"link access to another profile":     "UPDATE public.shift_nurse_access SET status = 'linked', nurse_profile_id = '" + f.beta.ID + "' WHERE id = '" + accessID + "'",
		"link access with an email":          "UPDATE public.shift_nurse_access SET status = 'linked', nurse_email = 'x@example.com', nurse_profile_id = '" + f.alpha.ID + "' WHERE id = '" + accessID + "'",
		"rename a pending row":               "UPDATE public.shift_nurse_access SET nurse_name = 'Renamed' WHERE id = '" + accessID + "'",
		"credit another profile with a join": "UPDATE public.shift_nurse_invites SET status = 'used', used_by_profile_id = '" + f.beta.ID + "' WHERE id = '" + invite.ID + "'",
		"set used without a profile":         "UPDATE public.shift_nurse_invites SET status = 'used' WHERE id = '" + invite.ID + "'",
		"reactivate an invite":               "UPDATE public.shift_nurse_invites SET status = 'active' WHERE id = '" + invite.ID + "'",
	}
	for name, statement := range denied {
		if err := asOwner(statement); err == nil {
			t.Errorf("%s: the owner session was allowed", name)
		}
	}
	// What milestone 3 and revoking legitimately do must still work.
	if err := asOwner("UPDATE public.shift_nurse_access SET status = 'removed', updated_at = now() WHERE id = ?", accessID); err != nil {
		t.Fatalf("removing access: %v", err)
	}
	for _, status := range []string{"expired", "revoked"} {
		if err := asOwner("UPDATE public.shift_nurse_invites SET status = ?, updated_at = now() WHERE id = ?", status, invite.ID); err != nil {
			t.Fatalf("setting invite %s: %v", status, err)
		}
	}
	if got := f.text(t, "SELECT coalesce(nurse_profile_id::text, 'none') FROM public.shift_nurse_access WHERE id = $1", accessID); got != "none" {
		t.Fatalf("access profile = %s", got)
	}
}

// The re-accepting profile locks its own linked row. If a charge nurse removes
// access while the accept waits, the accept relinks the removed row.
func TestAcceptWaitsForConcurrentRemovalIntegration(t *testing.T) {
	f := openAccessFixture(t)
	ctx := contextForTest()
	shift := f.stageShift(t, f.alpha.ID, accessSnapshot)
	firstCode, _ := f.issue(t, f.alpha, shift, "n1", false)
	joiner := f.newProfile(t, "Returning")
	joined, err := f.store.AcceptInvite(ctx, joiner.AuthUserID, joiner.ID, invites.HashCode(firstCode))
	if err != nil || joined.Status != "joined" {
		t.Fatalf("first join: %+v, %v", joined, err)
	}
	secondCode, _ := f.issue(t, f.alpha, shift, "n1", false)

	// Hold an uncommitted removal, then start the accept and wait until it blocks.
	removal, err := f.admin.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer removal.Rollback()
	if _, err := removal.Exec("UPDATE public.shift_nurse_access SET status = 'removed', updated_at = now() WHERE id = $1", joined.AccessID); err != nil {
		t.Fatal(err)
	}
	done := make(chan InviteJoin, 1)
	go func() {
		result, err := f.store.AcceptInvite(ctx, joiner.AuthUserID, joiner.ID, invites.HashCode(secondCode))
		if err != nil {
			t.Error(err)
		}
		done <- result
	}()
	deadline := time.Now().Add(5 * time.Second)
	for f.count(t, "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()") == 0 {
		if time.Now().After(deadline) {
			t.Fatal("accept never waited on the access row lock")
		}
		time.Sleep(20 * time.Millisecond)
	}
	select {
	case result := <-done:
		t.Fatalf("accept finished while the row was locked: %+v", result)
	default:
	}
	if err := removal.Commit(); err != nil {
		t.Fatal(err)
	}
	result := <-done
	if result.Status != "joined" || result.AccessID != joined.AccessID {
		t.Fatalf("accept after removal = %+v, want the removed row relinked", result)
	}
	if got := f.text(t, "SELECT status || ',' || nurse_profile_id::text FROM public.shift_nurse_access WHERE id = $1", joined.AccessID); got != "linked,"+joiner.ID {
		t.Fatalf("access row = %s", got)
	}
	if n := f.count(t, "SELECT count(*) FROM public.shift_nurse_access WHERE shift_id = $1", shift); n != 1 {
		t.Fatalf("%d access rows", n)
	}
}

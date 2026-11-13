package database

import (
	"errors"
	"testing"

	"github.com/pratham124/nurse-flow/backend/internal/invites"
	"gorm.io/gorm"
)

func (w world) leave(who Profile) error {
	return w.f.store.LeaveJoinedShift(contextForTest(), who.AuthUserID, who.ID)
}

func TestLeaveJoinedShiftIntegration(t *testing.T) {
	f := openAccessFixture(t)
	ctx := contextForTest()
	const chatID = "nurse-chat-n1"

	t.Run("leaving frees the slot, keeps the chat history, and refreshes charge", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		if _, _, err := w.openJoinedChat(nina); err != nil {
			t.Fatal(err)
		}
		if _, _, err := w.sendChat(nina, chatID, "Hello charge", ""); err != nil {
			t.Fatal(err)
		}
		revision, before := w.revisionText(t), f.sideEffects(t, w.shift)
		accessUpdated := f.text(t, "SELECT updated_at::text FROM public.shift_nurse_access WHERE shift_id = $1 AND nurse_id = 'n1'", w.shift)

		if err := w.leave(nina); err != nil {
			t.Fatal(err)
		}
		if got := f.text(t, "SELECT status FROM public.shift_nurse_access WHERE shift_id = $1 AND nurse_id = 'n1'", w.shift); got != "removed" {
			t.Fatalf("status = %q", got)
		}
		if f.text(t, "SELECT updated_at::text FROM public.shift_nurse_access WHERE shift_id = $1 AND nurse_id = 'n1'", w.shift) == accessUpdated {
			t.Fatal("the access row must be stamped")
		}
		if w.revisionText(t) == revision {
			t.Fatal("the shift revision must advance so charge's app refreshes")
		}
		if effects := f.sideEffects(t, w.shift).minus(before); effects.realtime == 0 {
			t.Fatalf("leaving must emit a realtime change on the shift: %+v", effects)
		}

		// The nurse no longer sees the shift or its chat.
		if assignment, err := f.store.JoinedWorkspace(ctx, nina.AuthUserID, nina.ID); err != nil || assignment != nil {
			t.Fatalf("workspace after leaving: %+v, %v", assignment, err)
		}
		if _, err := f.store.ListThreadMessages(ctx, nina.AuthUserID, nina.ID, w.shift, chatID); !errors.Is(err, ErrThreadNotFound) {
			t.Fatalf("list: %v", err)
		}
		if _, _, err := w.sendChat(nina, chatID, "still here?", ""); !errors.Is(err, ErrThreadNotFound) {
			t.Fatalf("send: %v", err)
		}
		if _, _, err := w.openJoinedChat(nina); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("open chat: %v", err)
		}
		// Charge still has the history.
		messages, err := f.store.ListThreadMessages(ctx, w.charge.AuthUserID, w.charge.ID, w.shift, chatID)
		if err != nil || len(messages) != 1 {
			t.Fatalf("charge history: %+v, %v", messages, err)
		}
		// Leaving twice is refused cleanly.
		if err := w.leave(nina); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("second leave: %v", err)
		}

		// The slot is free: charge invites someone new and they join.
		code, _ := f.issue(t, w.charge, w.shift, "n1", false)
		newcomer := f.newProfile(t, "Newcomer")
		if result, err := f.store.AcceptInvite(ctx, newcomer.AuthUserID, newcomer.ID, invites.HashCode(code)); err != nil || result.Status != "joined" {
			t.Fatalf("rejoin: %+v, %v", result, err)
		}
		if assignment, err := f.store.JoinedWorkspace(ctx, newcomer.AuthUserID, newcomer.ID); err != nil || assignment == nil {
			t.Fatalf("newcomer workspace: %+v, %v", assignment, err)
		}
	})

	t.Run("a nurse who never joined or whose shift ended cannot leave", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		if err := w.leave(f.newProfile(t, "Stranger")); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("stranger: %v", err)
		}
		if err := w.leave(w.charge); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("owner: %v", err)
		}
		f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", w.shift)
		if err := w.leave(nina); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("ended shift: %v", err)
		}
	})

	t.Run("a nurse cannot remove someone else's access", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		w.joinNurse(t, "n1")
		stranger := f.newProfile(t, "Stranger")
		var affected int64
		err := f.store.WithWriteIdentity(ctx, stranger.AuthUserID, func(tx *gorm.DB) error {
			result := tx.Table("public.shift_nurse_access").Where("shift_id = ? AND nurse_id = 'n1'", w.shift).
				Updates(map[string]any{"status": "removed", "updated_at": gorm.Expr("now()")})
			affected = result.RowsAffected
			return result.Error
		})
		if err != nil || affected != 0 {
			t.Fatalf("affected=%d err=%v", affected, err)
		}
		if got := f.text(t, "SELECT status FROM public.shift_nurse_access WHERE shift_id = $1 AND nurse_id = 'n1'", w.shift); got != "linked" {
			t.Fatalf("status = %q", got)
		}
	})

	t.Run("starting a charge shift is refused while joined and allowed after leaving", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		template, err := f.store.SaveFloorTemplate(ctx, nina.AuthUserID, nina.ID, "", validWriteSnapshot(t))
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			f.exec(t, "DELETE FROM public.active_shifts WHERE floor_template_id = $1", template.ID)
			f.exec(t, "DELETE FROM public.floor_templates WHERE id = $1", template.ID)
		})
		if _, err := f.store.StartShift(ctx, nina.AuthUserID, nina.ID, template.ID); !errors.Is(err, ErrJoinedShiftActive) {
			t.Fatalf("start while joined: %v", err)
		}
		if f.count(t, "SELECT count(*) FROM public.active_shifts WHERE charge_profile_id = $1", nina.ID) != 0 {
			t.Fatal("a refused start must not create a shift")
		}
		if err := w.leave(nina); err != nil {
			t.Fatal(err)
		}
		if _, err := f.store.StartShift(ctx, nina.AuthUserID, nina.ID, template.ID); err != nil {
			t.Fatalf("start after leaving: %v", err)
		}
	})
}

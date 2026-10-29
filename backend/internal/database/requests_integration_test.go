package database

import (
	"encoding/json"
	"errors"
	"reflect"
	"sync"
	"testing"
)

func (w world) submitIssue(who Profile, message string) (json.RawMessage, error) {
	return w.f.store.SubmitIssueRequest(contextForTest(), who.AuthUserID, who.ID, message)
}

func (w world) submitSwap(who Profile, bed, message string) (json.RawMessage, error) {
	return w.f.store.SubmitSwapRequest(contextForTest(), who.AuthUserID, who.ID, bed, message)
}

func decodeObject(t *testing.T, raw json.RawMessage) map[string]any {
	t.Helper()
	var object map[string]any
	if err := json.Unmarshal(raw, &object); err != nil {
		t.Fatal(err)
	}
	return object
}

func TestIssueRequestIntegration(t *testing.T) {
	f := openAccessFixture(t)

	t.Run("a joined nurse appends one pending issue", func(t *testing.T) {
		w := newWorld(t, f, `[{"id":"old","type":"issue","status":"pending","requestingNurseId":"n2","message":"other","futureKey":true}]`)
		nina := w.joinNurse(t, "n1")
		before := f.text(t, "SELECT updated_at::text FROM public.active_shifts WHERE id = $1", w.shift)
		raw, err := w.submitIssue(nina, "  Pump is broken  ")
		if err != nil {
			t.Fatal(err)
		}
		request := decodeObject(t, raw)
		if request["type"] != "issue" || request["status"] != "pending" || request["requestingNurseId"] != "n1" ||
			request["requestingNurseName"] != "Nina" || request["message"] != "Pump is broken" || request["createdAt"] == nil {
			t.Fatalf("%v", request)
		}
		if got := f.count(t, "SELECT jsonb_array_length(shift_snapshot -> 'nurseRequests') FROM public.active_shifts WHERE id = $1", w.shift); got != 2 {
			t.Fatalf("%d requests", got)
		}
		if w.requestByID(t, "old")["futureKey"] != true || string(w.snapshot(t)["futureField"]) != `{"keep": true}` {
			t.Fatal("unknown keys must survive")
		}
		if f.text(t, "SELECT updated_at::text FROM public.active_shifts WHERE id = $1", w.shift) == before {
			t.Fatal("the revision must advance")
		}
		// It shows up in the nurse's own history.
		workspace, err := f.store.JoinedWorkspace(contextForTest(), nina.AuthUserID, nina.ID)
		if err != nil || len(workspace.RequestHistory) != 1 {
			t.Fatalf("%+v %v", workspace, err)
		}
		// A repeat of the pending message is a duplicate.
		_, err = w.submitIssue(nina, "pump is BROKEN")
		if code, message := ruleCode(t, err); code != "request_pending" || message != "This issue is already pending." {
			t.Fatal(code, message)
		}
	})

	t.Run("callers who have not joined are refused", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		if _, err := w.submitIssue(w.charge, "I am the owner"); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("owner submitting as a nurse: %v", err)
		}
		stranger := f.newProfile(t, "Stranger")
		if _, err := w.submitIssue(stranger, "hello"); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("stranger: %v", err)
		}
		f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", w.shift)
		if _, err := w.submitIssue(nina, "late"); !errors.Is(err, ErrNotJoined) {
			t.Fatalf("ended shift: %v", err)
		}
		if f.count(t, "SELECT jsonb_array_length(shift_snapshot -> 'nurseRequests') FROM public.active_shifts WHERE id = $1", w.shift) != 0 {
			t.Fatal("refused submissions must not write")
		}
	})

	t.Run("concurrent duplicate submissions: one saved, one pending", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		errs := make([]error, 2)
		var wg sync.WaitGroup
		for i := range errs {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_, errs[i] = w.submitIssue(nina, "Same words")
			}()
		}
		wg.Wait()
		saved, pending := 0, 0
		for _, err := range errs {
			if err == nil {
				saved++
			} else if code, _ := ruleCode(t, err); code == "request_pending" {
				pending++
			}
		}
		if saved != 1 || pending != 1 || f.count(t, "SELECT jsonb_array_length(shift_snapshot -> 'nurseRequests') FROM public.active_shifts WHERE id = $1", w.shift) != 1 {
			t.Fatalf("saved=%d pending=%d", saved, pending)
		}
	})

	t.Run("matches the original SQL function", func(t *testing.T) {
		goWorld, sqlWorld := newWorld(t, f, "[]"), newWorld(t, f, "[]")
		goNurse, sqlNurse := goWorld.joinNurse(t, "n1"), sqlWorld.joinNurse(t, "n1")
		goBefore, sqlBefore := f.sideEffects(t, goWorld.shift), f.sideEffects(t, sqlWorld.shift)
		raw, err := goWorld.submitIssue(goNurse, "Need help")
		if err != nil {
			t.Fatal(err)
		}
		f.rpcCommit(t, sqlNurse.AuthUserID, "SELECT public.submit_joined_nurse_issue_request('Need help')::text")
		if g, s := f.sideEffects(t, goWorld.shift).minus(goBefore), f.sideEffects(t, sqlWorld.shift).minus(sqlBefore); g != s || g.realtime == 0 {
			t.Fatalf("go=%+v sql=%+v", g, s)
		}
		var sqlRequests []map[string]any
		_ = json.Unmarshal(sqlWorld.snapshot(t)["nurseRequests"], &sqlRequests)
		if len(sqlRequests) != 1 || !reflect.DeepEqual(keysOf(decodeObject(t, raw)), keysOf(sqlRequests[0])) {
			t.Fatalf("go=%v sql=%v", keysOf(decodeObject(t, raw)), sqlRequests)
		}
	})
}

func TestIssueStatusIntegration(t *testing.T) {
	f := openAccessFixture(t)
	issue := `{"id":"i1","type":"issue","status":"pending","requestingNurseId":"n1","message":"m","extra":"keep"}`
	update := func(w world, who Profile, shift, id, status string) (json.RawMessage, error) {
		return f.store.UpdateIssueStatus(contextForTest(), who.AuthUserID, who.ID, shift, id, status)
	}

	t.Run("allowed transitions record who and when", func(t *testing.T) {
		w := newWorld(t, f, `[`+issue+`]`)
		raw, err := update(w, w.charge, w.shift, " i1 ", "reviewed")
		if err != nil {
			t.Fatal(err)
		}
		request := decodeObject(t, raw)
		if request["issueReviewStatus"] != "reviewed" || request["reviewedByProfileId"] != w.charge.ID || request["extra"] != "keep" {
			t.Fatalf("%v", request)
		}
		if _, err := update(w, w.charge, w.shift, "i1", "resolved"); err != nil {
			t.Fatal(err)
		}
		stored := w.requestByID(t, "i1")
		if stored["issueReviewStatus"] != "resolved" || stored["issueResolvedByProfileId"] != w.charge.ID {
			t.Fatalf("%v", stored)
		}
		if _, err := update(w, w.charge, w.shift, "i1", "open"); err != nil {
			t.Fatal(err)
		}
		reopened := w.requestByID(t, "i1")
		if _, has := reopened["issueResolvedAt"]; has || reopened["issueReviewStatus"] != "open" {
			t.Fatalf("%v", reopened)
		}
	})

	t.Run("the same status is a no-op and an invalid change is refused", func(t *testing.T) {
		w := newWorld(t, f, `[`+issue+`]`)
		revision := f.text(t, "SELECT updated_at::text FROM public.active_shifts WHERE id = $1", w.shift)
		effectsBefore := f.sideEffects(t, w.shift)
		raw, err := update(w, w.charge, w.shift, "i1", "open")
		if err != nil || decodeObject(t, raw)["id"] != "i1" {
			t.Fatalf("%s %v", raw, err)
		}
		if f.text(t, "SELECT updated_at::text FROM public.active_shifts WHERE id = $1", w.shift) != revision || f.sideEffects(t, w.shift) != effectsBefore {
			t.Fatal("a no-op must not write")
		}
		if _, err := update(w, w.charge, w.shift, "i1", "reviewed"); err != nil {
			t.Fatal(err)
		}
		_, err = update(w, w.charge, w.shift, "i1", "open")
		if code, message := ruleCode(t, err); code != "invalid_transition" || message != "That issue status change is not allowed." {
			t.Fatal(code, message)
		}
		_, err = update(w, w.charge, w.shift, "ghost", "reviewed")
		if code, _ := ruleCode(t, err); code != "request_not_found" {
			t.Fatal(code)
		}
	})

	t.Run("only the owner can review an unended shift", func(t *testing.T) {
		w := newWorld(t, f, `[`+issue+`]`)
		nina := w.joinNurse(t, "n1")
		if _, err := update(w, nina, w.shift, "i1", "reviewed"); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("joined nurse: %v", err)
		}
		other := newWorld(t, f, "[]")
		if _, err := update(w, other.charge, w.shift, "i1", "reviewed"); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("other charge: %v", err)
		}
		f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", w.shift)
		if _, err := update(w, w.charge, w.shift, "i1", "reviewed"); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("ended: %v", err)
		}
	})

	t.Run("matches the original SQL function", func(t *testing.T) {
		goWorld, sqlWorld := newWorld(t, f, `[`+issue+`]`), newWorld(t, f, `[`+issue+`]`)
		goBefore, sqlBefore := f.sideEffects(t, goWorld.shift), f.sideEffects(t, sqlWorld.shift)
		if _, err := update(goWorld, goWorld.charge, goWorld.shift, "i1", "resolved"); err != nil {
			t.Fatal(err)
		}
		f.rpcCommit(t, sqlWorld.charge.AuthUserID, "SELECT public.update_shift_nurse_issue_status('i1', 'resolved')::text")
		if g, s := f.sideEffects(t, goWorld.shift).minus(goBefore), f.sideEffects(t, sqlWorld.shift).minus(sqlBefore); g != s || g.realtime == 0 {
			t.Fatalf("go=%+v sql=%+v", g, s)
		}
		if !reflect.DeepEqual(keysOf(goWorld.requestByID(t, "i1")), keysOf(sqlWorld.requestByID(t, "i1"))) {
			t.Fatal("stored request keys differ")
		}
	})
}

func TestSwapRequestIntegration(t *testing.T) {
	f := openAccessFixture(t)

	t.Run("a nurse requests a swap for a bed they hold", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		raw, err := w.submitSwap(nina, "b2", " Please swap ")
		if err != nil {
			t.Fatal(err)
		}
		request := decodeObject(t, raw)
		if request["type"] != "swap" || request["sourceBedId"] != "b2" || request["message"] != "Please swap" || request["requestingNurseName"] != "Nina" {
			t.Fatalf("%v", request)
		}
		_, err = w.submitSwap(nina, "b2", "please swap")
		if code, message := ruleCode(t, err); code != "request_pending" || message != "This swap request is already pending." {
			t.Fatal(code, message)
		}
		_, err = w.submitSwap(nina, "b3", "mine?")
		if _, message := ruleCode(t, err); message != "Choose one of your assigned beds for the swap." {
			t.Fatal(message)
		}
	})

	t.Run("ownership follows manual moves", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina, omar := w.joinNurse(t, "n1"), w.joinNurse(t, "n2")
		if _, err := w.move("b2", "n1", "n2", "m1", `[]`, nil); err != nil {
			t.Fatal(err)
		}
		_, err := w.submitSwap(nina, "b2", "moved away")
		if _, message := ruleCode(t, err); message != "Choose one of your assigned beds for the swap." {
			t.Fatalf("a bed moved away must be refused: %v", err)
		}
		if _, err := w.submitSwap(omar, "b2", "moved to me"); err != nil {
			t.Fatalf("a bed moved to the nurse is allowed: %v", err)
		}
	})

	t.Run("accept, decline, and repeat", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		first, _ := w.submitSwap(nina, "b1", "first")
		second, _ := w.submitSwap(nina, "b2", "second")
		resolve := func(who Profile, id, status string) (json.RawMessage, error) {
			return f.store.ResolveSwapRequest(contextForTest(), who.AuthUserID, who.ID, w.shift, id, status)
		}
		firstID, secondID := decodeObject(t, first)["id"].(string), decodeObject(t, second)["id"].(string)
		raw, err := resolve(w.charge, firstID, "accepted")
		if err != nil {
			t.Fatal(err)
		}
		if request := decodeObject(t, raw); request["status"] != "accepted" || request["resolutionNote"] != "Accepted by charge" || request["resolvedAt"] == nil {
			t.Fatalf("%v", request)
		}
		raw, err = resolve(w.charge, secondID, "declined")
		if err != nil || decodeObject(t, raw)["resolutionNote"] != "Declined by charge" {
			t.Fatalf("%s %v", raw, err)
		}
		_, err = resolve(w.charge, firstID, "declined")
		if code, message := ruleCode(t, err); code != "request_not_pending" || message != "Only pending swap requests can be resolved." {
			t.Fatal(code, message)
		}
		if _, err := resolve(nina, secondID, "accepted"); !errors.Is(err, ErrShiftNotFound) {
			t.Fatalf("a joined nurse cannot resolve: %v", err)
		}
	})

	t.Run("an accepted swap completes through a move", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		nina := w.joinNurse(t, "n1")
		raw, _ := w.submitSwap(nina, "b1", "swap please")
		id := decodeObject(t, raw)["id"].(string)
		// A pending swap cannot be linked yet.
		_, err := w.move("b1", "n1", "n2", "m0", `[]`, &id)
		if _, message := ruleCode(t, err); message != "Only an accepted swap for this bed can be linked." {
			t.Fatal(message)
		}
		if _, err := f.store.ResolveSwapRequest(contextForTest(), w.charge.AuthUserID, w.charge.ID, w.shift, id, "accepted"); err != nil {
			t.Fatal(err)
		}
		outcome, err := w.move("b1", "n1", "n2", "m1", `[]`, &id)
		if err != nil || outcome.Saved == nil {
			t.Fatalf("%+v %v", outcome, err)
		}
		if stored := w.requestByID(t, id); stored["completedOverrideId"] != outcome.Saved.Override.ID || stored["status"] != "accepted" {
			t.Fatalf("%v", stored)
		}
	})

	t.Run("matches the original SQL function", func(t *testing.T) {
		goWorld, sqlWorld := newWorld(t, f, "[]"), newWorld(t, f, "[]")
		goNurse, sqlNurse := goWorld.joinNurse(t, "n1"), sqlWorld.joinNurse(t, "n1")
		goBefore, sqlBefore := f.sideEffects(t, goWorld.shift), f.sideEffects(t, sqlWorld.shift)
		raw, err := goWorld.submitSwap(goNurse, "b1", "Swap me")
		if err != nil {
			t.Fatal(err)
		}
		f.rpcCommit(t, sqlNurse.AuthUserID, "SELECT public.submit_joined_nurse_swap_request('b1', 'Swap me')::text")
		goRequest := decodeObject(t, raw)
		sqlID := sqlWorld.snapshotRequests(t)[0]["id"].(string)
		goEffects, sqlEffects := f.sideEffects(t, goWorld.shift).minus(goBefore), f.sideEffects(t, sqlWorld.shift).minus(sqlBefore)
		if goEffects != sqlEffects || goEffects.realtime == 0 || !reflect.DeepEqual(keysOf(goRequest), keysOf(sqlWorld.requestByID(t, sqlID))) {
			t.Fatalf("go=%+v sql=%+v", goEffects, sqlEffects)
		}
		// Resolve through both paths and compare the stored result and effects.
		goBefore, sqlBefore = f.sideEffects(t, goWorld.shift), f.sideEffects(t, sqlWorld.shift)
		if _, err := f.store.ResolveSwapRequest(contextForTest(), goWorld.charge.AuthUserID, goWorld.charge.ID, goWorld.shift, goRequest["id"].(string), "accepted"); err != nil {
			t.Fatal(err)
		}
		f.rpcCommit(t, sqlWorld.charge.AuthUserID, "SELECT public.resolve_shift_nurse_swap_request($1, 'accepted')::text", sqlID)
		if g, s := f.sideEffects(t, goWorld.shift).minus(goBefore), f.sideEffects(t, sqlWorld.shift).minus(sqlBefore); g != s {
			t.Fatalf("resolve effects differ: go=%+v sql=%+v", g, s)
		}
		if !reflect.DeepEqual(keysOf(goWorld.requestByID(t, goRequest["id"].(string))), keysOf(sqlWorld.requestByID(t, sqlID))) {
			t.Fatal("resolved request keys differ")
		}
	})
}

func (w world) snapshotRequests(t *testing.T) []map[string]any {
	t.Helper()
	var requests []map[string]any
	if err := json.Unmarshal(w.snapshot(t)["nurseRequests"], &requests); err != nil {
		t.Fatal(err)
	}
	return requests
}

package assignmentruns

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"testing"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/solver"
)

type fakeStore struct {
	prepared    database.PreparedRun
	prepareErr  error
	finalized   database.RunResponse
	finalizeErr error
	failErr     error
	releaseErr  error

	failures     []string
	finalizeCtx  context.Context
	failCtxErr   error
	finalizeRuns int
	releases     []string
	releaseCtx   error
}

func (s *fakeStore) PrepareAssignmentRun(context.Context, database.RunCaller, string, database.RunRequest) (database.PreparedRun, error) {
	return s.prepared, s.prepareErr
}

func (s *fakeStore) FinalizeAssignmentRun(ctx context.Context, _ database.RunCaller, _ string, _ solver.Output) (database.RunResponse, error) {
	s.finalizeCtx = ctx
	s.finalizeRuns++
	return s.finalized, s.finalizeErr
}

func (s *fakeStore) FailAssignmentRun(ctx context.Context, _ database.RunCaller, _ string, code string) error {
	s.failCtxErr = ctx.Err()
	s.failures = append(s.failures, code)
	return s.failErr
}

func (s *fakeStore) ReleaseAssignmentRun(ctx context.Context, _ database.RunCaller, runID string) error {
	s.releaseCtx = ctx.Err()
	s.releases = append(s.releases, runID)
	return s.releaseErr
}

type fakeSolver struct {
	result solver.Result
	wait   time.Duration
	calls  int
	runID  string
}

func (s *fakeSolver) Solve(ctx context.Context, runID string, _ json.RawMessage) solver.Result {
	s.calls++
	s.runID = runID
	if s.wait > 0 {
		select {
		case <-time.After(s.wait):
		case <-ctx.Done():
			return solver.Result{Kind: solver.KindTimedOut}
		}
	}
	return s.result
}

func solvable() database.PreparedRun {
	return database.PreparedRun{Solve: &database.RunSolveJob{RunID: "run-1", ShiftSnapshot: json.RawMessage(`{}`)}}
}

func newCoordinator(store *fakeStore, s *fakeSolver) *Coordinator {
	coordinator := NewCoordinator(store, s)
	coordinator.logf = func(string, ...any) {}
	return coordinator
}

func run(c *Coordinator, ctx context.Context) database.RunResponse {
	return c.Run(ctx, database.RunCaller{AuthUserID: "auth", ProfileID: "profile"}, "shift", database.RunRequest{ClientMutationID: "m"})
}

func TestRunSavesASolvedRun(t *testing.T) {
	store := &fakeStore{prepared: solvable(), finalized: database.RunResponse{Status: database.RunStatusSaved, RunID: "run-1", ResultID: "res-1"}}
	s := &fakeSolver{result: solver.Result{Kind: solver.KindSolved}}
	got := run(newCoordinator(store, s), context.Background())
	if got != (database.RunResponse{Status: database.RunStatusSaved, RunID: "run-1", ResultID: "res-1"}) {
		t.Fatalf("unexpected outcome %+v", got)
	}
	if s.runID != "run-1" || len(store.failures) != 0 {
		t.Fatalf("solver run id %q, failures %v", s.runID, store.failures)
	}
}

func TestRunReturnsPrepareOutcomesWithoutSolving(t *testing.T) {
	tests := []struct {
		name     string
		prepared database.PreparedRun
		err      error
		want     database.RunResponse
	}{
		{"replay saved", database.PreparedRun{Response: &database.RunResponse{Status: database.RunStatusSaved, RunID: "r", ResultID: "x"}}, nil, database.RunResponse{Status: database.RunStatusSaved, RunID: "r", ResultID: "x"}},
		{"in progress", database.PreparedRun{Response: &database.RunResponse{Status: database.RunStatusRunning, RunID: "r"}}, nil, database.RunResponse{Status: database.RunStatusRunning, RunID: "r"}},
		{"stale without run", database.PreparedRun{Response: &database.RunResponse{Status: database.RunStatusStale}}, nil, database.RunResponse{Status: database.RunStatusStale}},
		{"conflict", database.PreparedRun{Response: &database.RunResponse{Status: database.RunStatusConflict}}, nil, database.RunResponse{Status: database.RunStatusConflict}},
		{"failed replay as invalid input", database.PreparedRun{Response: &database.RunResponse{Status: database.RunStatusInvalidInput, RunID: "r"}}, nil, database.RunResponse{Status: database.RunStatusInvalidInput, RunID: "r"}},
		{"timed out replay", database.PreparedRun{Response: &database.RunResponse{Status: database.RunStatusTimedOut, RunID: "r"}}, nil, database.RunResponse{Status: database.RunStatusTimedOut, RunID: "r"}},
		{"foreign shift", database.PreparedRun{}, database.ErrShiftNotFound, database.RunResponse{Status: database.RunStatusForbidden}},
		{"database down", database.PreparedRun{}, errors.New("connection refused"), database.RunResponse{Status: database.RunStatusUnavailable}},
		{"nothing to do", database.PreparedRun{}, nil, database.RunResponse{Status: database.RunStatusFailed}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			s := &fakeSolver{}
			got := run(newCoordinator(&fakeStore{prepared: test.prepared, prepareErr: test.err}, s), context.Background())
			if got != test.want || s.calls != 0 {
				t.Fatalf("got %+v (solver calls %d), want %+v", got, s.calls, test.want)
			}
		})
	}
}

func TestRunRecordsSolverFailures(t *testing.T) {
	tests := []struct {
		kind solver.Kind
		code string
		want database.RunResponse
	}{
		{solver.KindInvalidInput, "invalid_input", database.RunResponse{Status: database.RunStatusInvalidInput, RunID: "run-1"}},
		{solver.KindTimedOut, "timed_out", database.RunResponse{Status: database.RunStatusTimedOut, RunID: "run-1"}},
		{solver.KindFailed, "solver_failed", database.RunResponse{Status: database.RunStatusFailed, RunID: "run-1"}},
		{solver.KindUnauthorized, "internal_failure", database.RunResponse{Status: database.RunStatusFailed, RunID: "run-1"}},
		{solver.KindUnreadable, "internal_failure", database.RunResponse{Status: database.RunStatusFailed, RunID: "run-1"}},
	}
	for _, test := range tests {
		t.Run(string(test.kind), func(t *testing.T) {
			store := &fakeStore{prepared: solvable()}
			got := run(newCoordinator(store, &fakeSolver{result: solver.Result{Kind: test.kind}}), context.Background())
			if got != test.want || len(store.failures) != 1 || store.failures[0] != test.code || store.finalizeRuns != 0 {
				t.Fatalf("got %+v, failures %v", got, store.failures)
			}
		})
	}
}

func TestRunLeavesTheRunRunningWhenTheSolverIsUnavailable(t *testing.T) {
	store := &fakeStore{prepared: solvable()}
	got := run(newCoordinator(store, &fakeSolver{result: solver.Result{Kind: solver.KindUnavailable}}), context.Background())
	if got.Status != database.RunStatusUnavailable || len(store.failures) != 0 || store.finalizeRuns != 0 || len(store.releases) != 0 {
		t.Fatalf("got %+v, failures %v, releases %v", got, store.failures, store.releases)
	}
}

func TestRunReleasesTheRunWhenTheSolverIsUnreachable(t *testing.T) {
	store := &fakeStore{prepared: solvable()}
	got := run(newCoordinator(store, &fakeSolver{result: solver.Result{Kind: solver.KindUnreachable}}), context.Background())
	if got != (database.RunResponse{Status: database.RunStatusUnavailable, RunID: "run-1"}) {
		t.Fatalf("got %+v", got)
	}
	if len(store.releases) != 1 || store.releases[0] != "run-1" || len(store.failures) != 0 || store.finalizeRuns != 0 {
		t.Fatalf("releases %v, failures %v", store.releases, store.failures)
	}
}

func TestRunReleaseErrorDoesNotReplaceTheOutcome(t *testing.T) {
	store := &fakeStore{prepared: solvable(), releaseErr: errors.New("db down")}
	got := run(newCoordinator(store, &fakeSolver{result: solver.Result{Kind: solver.KindUnreachable}}), context.Background())
	if got != (database.RunResponse{Status: database.RunStatusUnavailable, RunID: "run-1"}) {
		t.Fatalf("got %+v", got)
	}
}

func TestRunReleasesOnALiveContextAfterTheDeadline(t *testing.T) {
	store := &fakeStore{prepared: solvable()}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	run(newCoordinator(store, &fakeSolver{result: solver.Result{Kind: solver.KindUnreachable}}), ctx)
	if len(store.releases) != 1 || store.releaseCtx != nil {
		t.Fatalf("releases %v, context error %v", store.releases, store.releaseCtx)
	}
}

func TestRunFailureRecordingErrorDoesNotReplaceTheOutcome(t *testing.T) {
	store := &fakeStore{prepared: solvable(), failErr: errors.New("db down")}
	got := run(newCoordinator(store, &fakeSolver{result: solver.Result{Kind: solver.KindInvalidInput}}), context.Background())
	if got.Status != database.RunStatusInvalidInput {
		t.Fatalf("got %+v", got)
	}
}

func TestRunFinalizeOutcomes(t *testing.T) {
	solved := &fakeSolver{result: solver.Result{Kind: solver.KindSolved}}
	t.Run("stale", func(t *testing.T) {
		store := &fakeStore{prepared: solvable(), finalized: database.RunResponse{Status: database.RunStatusStale, RunID: "run-1"}}
		got := run(newCoordinator(store, solved), context.Background())
		if got.Status != database.RunStatusStale || got.RunID != "run-1" {
			t.Fatalf("got %+v", got)
		}
	})
	t.Run("rejected output", func(t *testing.T) {
		store := &fakeStore{prepared: solvable(), finalized: database.RunResponse{Status: database.RunStatusFailed, RunID: "run-1"}}
		got := run(newCoordinator(store, solved), context.Background())
		if got.Status != database.RunStatusFailed {
			t.Fatalf("got %+v", got)
		}
		if len(store.failures) != 0 {
			t.Fatal("finalize already records a rejected output; the coordinator must not fail it again")
		}
	})
	t.Run("database unreachable keeps the run running", func(t *testing.T) {
		for name, finalizeErr := range map[string]error{
			"deadline": fmt.Errorf("finalize: %w", context.DeadlineExceeded),
			"network":  &net.OpError{Op: "read", Err: errors.New("connection reset")},
			"bad conn": driver.ErrBadConn,
		} {
			store := &fakeStore{prepared: solvable(), finalizeErr: finalizeErr}
			got := run(newCoordinator(store, solved), context.Background())
			if got != (database.RunResponse{Status: database.RunStatusUnavailable, RunID: "run-1"}) || len(store.failures) != 0 {
				t.Fatalf("%s: got %+v, failures %v", name, got, store.failures)
			}
		}
	})
	t.Run("other database error fails the run", func(t *testing.T) {
		store := &fakeStore{prepared: solvable(), finalizeErr: errors.New("constraint violation")}
		got := run(newCoordinator(store, solved), context.Background())
		if got != (database.RunResponse{Status: database.RunStatusFailed, RunID: "run-1"}) {
			t.Fatalf("got %+v", got)
		}
		if len(store.failures) != 1 || store.failures[0] != "finalization_failed" {
			t.Fatalf("failures %v", store.failures)
		}
	})
}

func TestRunSolverTimeoutViaDeadline(t *testing.T) {
	store := &fakeStore{prepared: solvable()}
	s := &fakeSolver{wait: time.Minute}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	got := run(newCoordinator(store, s), ctx)
	if got.Status != database.RunStatusTimedOut {
		t.Fatalf("got %+v", got)
	}
	if len(store.failures) != 1 || store.failures[0] != "timed_out" {
		t.Fatalf("failures %v", store.failures)
	}
	// The run deadline has passed, but recording the failure still gets a live context.
	if store.failCtxErr != nil {
		t.Fatalf("failure was recorded on a dead context: %v", store.failCtxErr)
	}
}

func TestRunGivesUpWhenLessThanTheReserveRemains(t *testing.T) {
	store := &fakeStore{prepared: solvable(), finalized: database.RunResponse{Status: database.RunStatusSaved}}
	s := &fakeSolver{result: solver.Result{Kind: solver.KindSolved}}
	c := newCoordinator(store, s)
	c.Reserve = time.Hour
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	got := run(c, ctx)
	if got.Status != database.RunStatusTimedOut || store.finalizeRuns != 0 {
		t.Fatalf("got %+v, finalize runs %d", got, store.finalizeRuns)
	}
	if len(store.failures) != 1 || store.failures[0] != "timed_out" {
		t.Fatalf("failures %v", store.failures)
	}
}

func TestRunKeepsGoingWhenTheReserveRemains(t *testing.T) {
	store := &fakeStore{prepared: solvable(), finalized: database.RunResponse{Status: database.RunStatusSaved, RunID: "run-1", ResultID: "res"}}
	c := newCoordinator(store, &fakeSolver{result: solver.Result{Kind: solver.KindSolved}})
	c.Reserve = time.Second
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if got := run(c, ctx); got.Status != database.RunStatusSaved {
		t.Fatalf("got %+v", got)
	}
}

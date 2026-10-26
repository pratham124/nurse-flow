// Package assignmentruns coordinates one optimizer run: prepare it in the database,
// solve it in the Python service with no database lock held, then record the result.
// It holds the workflow only; the database and the solver are reached through the
// small interfaces below.
package assignmentruns

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/solver"
)

// Run limits. The solver call has its own 125 s deadline (solver.CallTimeout); the
// whole run, from prepare to finalize, must finish inside RunDeadline.
const (
	RunDeadline = 135 * time.Second
	// FinalizeReserve is the time kept after the solve to save its result.
	FinalizeReserve = 10 * time.Second
	// recordTimeout bounds recording a failure, even after the run deadline passed.
	recordTimeout = 5 * time.Second
)

// Store is the database side of a run. Every method is one short transaction.
type Store interface {
	// PrepareAssignmentRun returns database.ErrShiftNotFound for a missing or foreign shift.
	PrepareAssignmentRun(ctx context.Context, caller database.RunCaller, shiftID string, request database.RunRequest) (database.PreparedRun, error)
	FinalizeAssignmentRun(ctx context.Context, caller database.RunCaller, runID string, output solver.Output) (database.RunResponse, error)
	FailAssignmentRun(ctx context.Context, caller database.RunCaller, runID, errorCode string) error
	// ReleaseAssignmentRun marks a run whose solver was never reached as free to retry now.
	ReleaseAssignmentRun(ctx context.Context, caller database.RunCaller, runID string) error
}

// Solver is the Python side of a run.
type Solver interface {
	Solve(ctx context.Context, runID string, shiftSnapshot json.RawMessage) solver.Result
}

// Coordinator runs assignment runs. Reserve may be lowered in tests.
type Coordinator struct {
	Store   Store
	Solver  Solver
	Reserve time.Duration
	logf    func(format string, args ...any)
}

// NewCoordinator connects the store and the solver with the production reserve.
func NewCoordinator(store Store, solve Solver) *Coordinator {
	return &Coordinator{Store: store, Solver: solve, Reserve: FinalizeReserve, logf: log.Printf}
}

func reply(status database.RunStatus, runID string) database.RunResponse {
	return database.RunResponse{Status: status, RunID: runID}
}

// Run prepares, solves, and records one run. The caller supplies a context that
// does not end when the phone disconnects and that carries the run deadline; the
// work then always finishes or fails cleanly instead of being abandoned halfway.
func (c *Coordinator) Run(ctx context.Context, caller database.RunCaller, shiftID string, request database.RunRequest) database.RunResponse {
	prepared, err := c.Store.PrepareAssignmentRun(ctx, caller, shiftID, request)
	if errors.Is(err, database.ErrShiftNotFound) {
		return reply(database.RunStatusForbidden, "")
	}
	if err != nil {
		return reply(database.RunStatusUnavailable, "")
	}
	if prepared.Response != nil {
		return *prepared.Response
	}
	if prepared.Solve == nil {
		return reply(database.RunStatusFailed, "")
	}
	return c.solveAndRecord(ctx, caller, *prepared.Solve)
}

// solveAndRecord solves with no database transaction open, then records the result.
func (c *Coordinator) solveAndRecord(ctx context.Context, caller database.RunCaller, job database.RunSolveJob) database.RunResponse {
	result := c.Solver.Solve(ctx, job.RunID, job.ShiftSnapshot)
	switch result.Kind {
	case solver.KindSolved:
		// Keep enough time to save the result; otherwise give up cleanly.
		if deadline, ok := ctx.Deadline(); ok && time.Until(deadline) < c.Reserve {
			return c.fail(ctx, caller, job.RunID, database.RunErrorTimedOut, database.RunStatusTimedOut)
		}
		return c.finalize(ctx, caller, job.RunID, result.Output)
	case solver.KindInvalidInput:
		return c.fail(ctx, caller, job.RunID, database.RunErrorInvalidInput, database.RunStatusInvalidInput)
	case solver.KindTimedOut:
		return c.fail(ctx, caller, job.RunID, database.RunErrorTimedOut, database.RunStatusTimedOut)
	case solver.KindFailed:
		return c.fail(ctx, caller, job.RunID, database.RunErrorSolverFailed, database.RunStatusFailed)
	case solver.KindUnreachable:
		// Nothing reached the solver, so no solve can be in flight: let the next
		// retry of this mutation start at once instead of waiting out the lease.
		return c.release(ctx, caller, job.RunID)
	case solver.KindUnavailable:
		// The solver may have started; leave the run for a retry or the lease.
		return reply(database.RunStatusUnavailable, job.RunID)
	}
	// Unauthorized (a misconfigured token) and unreadable answers are our fault.
	c.logf("assignment run %s: solver answered %s", job.RunID, result.Kind)
	return c.fail(ctx, caller, job.RunID, database.RunErrorInternalFailure, database.RunStatusFailed)
}

// finalize saves the solver's output. Only an unreachable database leaves the run
// running; any other error is a real failure and is recorded as one.
func (c *Coordinator) finalize(ctx context.Context, caller database.RunCaller, runID string, output solver.Output) database.RunResponse {
	response, err := c.Store.FinalizeAssignmentRun(ctx, caller, runID, output)
	if err == nil {
		return response
	}
	if database.IsUnavailable(err) {
		// Nothing was saved. The run stays running, so a retry of the same
		// mutation is told to wait until the lease lets it solve again.
		c.logf("assignment run %s: database unavailable while finalizing", runID)
		return reply(database.RunStatusUnavailable, runID)
	}
	c.logf("assignment run %s: finalize failed", runID)
	return c.fail(ctx, caller, runID, database.RunErrorFinalizationFailed, database.RunStatusFailed)
}

// fail records the failure and returns the matching response. A recording error is
// logged and never replaces the response. Recording gets its own short deadline so
// a run that used up its time can still be marked failed.
func (c *Coordinator) fail(ctx context.Context, caller database.RunCaller, runID, errorCode string, status database.RunStatus) database.RunResponse {
	recordContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), recordTimeout)
	defer cancel()
	if err := c.Store.FailAssignmentRun(recordContext, caller, runID, errorCode); err != nil {
		c.logf("assignment run %s: could not record %s", runID, errorCode)
	}
	return reply(status, runID)
}

// release hands back a run whose solver was never reached. A recording error is
// logged and never replaces the response; the lease still covers that case. Like
// fail, it gets its own short deadline.
func (c *Coordinator) release(ctx context.Context, caller database.RunCaller, runID string) database.RunResponse {
	recordContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), recordTimeout)
	defer cancel()
	if err := c.Store.ReleaseAssignmentRun(recordContext, caller, runID); err != nil {
		c.logf("assignment run %s: could not release the run", runID)
	}
	return reply(database.RunStatusUnavailable, runID)
}

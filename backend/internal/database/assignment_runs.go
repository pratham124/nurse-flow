package database

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"net"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pratham124/nurse-flow/backend/internal/solver"
	"gorm.io/gorm"
)

// This file holds what the prepare and finalize steps of an assignment run share.
// assignment_run_prepare.go and assignment_run_finalize.go hold the two steps.

// runLease is how long a run may stay "running" before the same mutation can
// reclaim it. It is longer than the 135 s run deadline, so a live request never
// has its run taken over. It is measured with the database clock.
const runLease = 150 * time.Second

// RunStatus is the public name of a run outcome, sent to the app.
type RunStatus string

// The statuses the app understands.
const (
	RunStatusSaved        RunStatus = "saved"
	RunStatusRunning      RunStatus = "running"
	RunStatusStale        RunStatus = "stale"
	RunStatusConflict     RunStatus = "conflict"
	RunStatusInvalidInput RunStatus = "invalid_input"
	RunStatusTimedOut     RunStatus = "timed_out"
	RunStatusUnavailable  RunStatus = "unavailable"
	RunStatusFailed       RunStatus = "failed"
	RunStatusForbidden    RunStatus = "forbidden"
)

// Error codes recorded on a failed run (outcome_summary.errorCode) that the
// assignmentruns coordinator also needs.
const (
	RunErrorInvalidInput       = "invalid_input"
	RunErrorTimedOut           = "timed_out"
	RunErrorSolverFailed       = "solver_failed"
	RunErrorInternalFailure    = "internal_failure"
	RunErrorFinalizationFailed = "finalization_failed"
)

// Error codes only this package records.
const (
	// runErrorSolverUnreachable marks a run that is still "running" but whose solver
	// call never connected. Prepare lets the same mutation reclaim it at once.
	runErrorSolverUnreachable = "solver_unreachable"
	runErrorStale             = "stale"
	runErrorResultIDReused    = "result_id_reused"
)

// storedStatus is a value of optimizer_runs.status.
type storedStatus string

const (
	storedRunning   storedStatus = "running"
	storedSucceeded storedStatus = "succeeded"
	storedStale     storedStatus = "stale"
	storedFailed    storedStatus = "failed"
)

// RunRequest is what the app asks for. ExpectedBaseline is "" for a first run.
// ExpectedRevision must already be truncated to the microseconds the database stores.
type RunRequest struct {
	ClientMutationID string
	ExpectedRevision time.Time
	ExpectedBaseline string
}

// RunCaller is the verified identity of the charge nurse making the request.
type RunCaller struct {
	AuthUserID string
	ProfileID  string
}

// RunResponse is the body sent to the app.
type RunResponse struct {
	Status   RunStatus `json:"status"`
	RunID    string    `json:"runId,omitempty"`
	ResultID string    `json:"resultId,omitempty"`
}

// RunSolveJob is a run that is ready to be solved.
type RunSolveJob struct {
	RunID         string
	ShiftSnapshot json.RawMessage
}

// PreparedRun is the result of preparing a run: either a job to solve, or the final
// response (a replay, a conflict, stale, or another run already in progress).
// Exactly one field is set.
type PreparedRun struct {
	Solve    *RunSolveJob
	Response *RunResponse
}

// IsUnavailable reports whether err means the database could not be reached or
// did not answer in time, as opposed to the database rejecting the request.
func IsUnavailable(err error) bool {
	var netErr net.Error
	var connectErr *pgconn.ConnectError
	return errors.Is(err, context.DeadlineExceeded) || errors.Is(err, driver.ErrBadConn) ||
		pgconn.Timeout(err) || pgconn.SafeToRetry(err) ||
		errors.As(err, &netErr) || errors.As(err, &connectErr)
}

// OptimizerRun maps one row of optimizer_runs.
type OptimizerRun struct {
	ID                                 string
	ShiftID                            string
	RequestedByProfileID               string
	ClientMutationID                   string
	ExpectedShiftRevision              time.Time
	ExpectedBaselineAssignmentResultID *string
	RequestFingerprint                 string
	InputFingerprint                   *string
	OptimizerVersion                   *string
	Status                             storedStatus
	ResultID                           *string
	OutcomeSummary                     json.RawMessage `gorm:"type:jsonb"`
	StartedAt                          time.Time
	CompletedAt                        *time.Time
	DurationMs                         *int
}

// TableName maps OptimizerRun to the existing optimizer_runs table.
func (OptimizerRun) TableName() string { return "public.optimizer_runs" }

// expectedBaseline returns the baseline result ID the run was requested with, or "".
func (r *OptimizerRun) expectedBaseline() string {
	if r.ExpectedBaselineAssignmentResultID == nil {
		return ""
	}
	return *r.ExpectedBaselineAssignmentResultID
}

// recordedResponse turns a run that is no longer running into the answer it
// recorded. Prepare and finalize both use it, so a replay answers the same way.
func recordedResponse(run *OptimizerRun) RunResponse {
	switch run.Status {
	case storedSucceeded:
		result := ""
		if run.ResultID != nil {
			result = *run.ResultID
		}
		return RunResponse{Status: RunStatusSaved, RunID: run.ID, ResultID: result}
	case storedStale:
		return RunResponse{Status: RunStatusStale, RunID: run.ID}
	case storedFailed:
		return failedResponse(run)
	}
	return RunResponse{Status: RunStatusRunning, RunID: run.ID}
}

// failedResponse picks the app status that matches the error code the run recorded.
func failedResponse(run *OptimizerRun) RunResponse {
	var summary struct {
		ErrorCode string `json:"errorCode"`
	}
	_ = json.Unmarshal(run.OutcomeSummary, &summary)
	switch summary.ErrorCode {
	case RunErrorInvalidInput:
		return RunResponse{Status: RunStatusInvalidInput, RunID: run.ID}
	case RunErrorTimedOut:
		return RunResponse{Status: RunStatusTimedOut, RunID: run.ID}
	}
	return RunResponse{Status: RunStatusFailed, RunID: run.ID}
}

// shiftOpenForRun is true while a shift can still receive an assignment: it has
// not ended and is in setup or already assigned.
func shiftOpenForRun(shift ActiveShift) bool {
	return shift.EndedAt == nil && (shift.Status == "setup" || shift.Status == "assigned")
}

// databaseNow reads the database clock, which times the lease and the run
// timestamps so API instances with different clocks agree.
func databaseNow(tx *gorm.DB) (time.Time, error) {
	var now time.Time
	// Raw: a clock read, not an application table query.
	err := tx.Raw("SELECT now()").Row().Scan(&now)
	return now, err
}

// hasErrorCode is true when the run's outcome summary carries this error code.
func (r *OptimizerRun) hasErrorCode(code string) bool {
	var summary struct {
		ErrorCode string `json:"errorCode"`
	}
	_ = json.Unmarshal(r.OutcomeSummary, &summary)
	return summary.ErrorCode == code
}

func errorSummary(code string) string {
	encoded, _ := json.Marshal(map[string]string{"errorCode": code})
	return string(encoded)
}

// finishRun ends a running run: it sets completed_at and duration_ms from the
// database time and applies the other columns in updates.
func finishRun(tx *gorm.DB, run *OptimizerRun, now time.Time, updates map[string]any) error {
	duration := now.Sub(run.StartedAt).Milliseconds()
	if duration < 0 {
		duration = 0
	}
	updates["completed_at"] = now
	updates["duration_ms"] = duration
	return tx.Model(&OptimizerRun{}).Where("id = ?", run.ID).Updates(updates).Error
}

// closeRun ends a run as stale or failed with an error code. When the solver's
// output is known, its fingerprint and version are recorded too.
func closeRun(tx *gorm.DB, run *OptimizerRun, now time.Time, status storedStatus, code string, output *solver.Output) error {
	updates := map[string]any{"status": string(status), "outcome_summary": errorSummary(code)}
	if output != nil {
		updates["input_fingerprint"] = output.InputFingerprint
		updates["optimizer_version"] = output.OptimizerVersion
	}
	return finishRun(tx, run, now, updates)
}

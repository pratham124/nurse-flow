package database

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"github.com/pratham124/nurse-flow/backend/internal/solver"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// lockRunByID locks the caller's run by ID. It returns nil when there is no such
// run, or it belongs to someone else (row security hides it).
func lockRunByID(tx *gorm.DB, profileID, runID string) (*OptimizerRun, error) {
	var rows []OptimizerRun
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND requested_by_profile_id = ?", runID, profileID).Limit(1).Find(&rows).Error
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return &rows[0], nil
}

// FinalizeAssignmentRun saves a solved run, mirroring finalize_optimizer_run. It
// runs under the caller's identity: the run is locked first, then its shift. The
// only active_shifts write is the single snapshot update, so the retained
// Realtime and notification triggers see exactly one committed change.
func (s *Store) FinalizeAssignmentRun(ctx context.Context, caller RunCaller, runID string, output solver.Output) (RunResponse, error) {
	// Any path below that ends the run without setting a status answers "failed",
	// and so does a run the caller does not own.
	response := RunResponse{Status: RunStatusFailed, RunID: runID}
	err := s.WithWriteIdentity(ctx, caller.AuthUserID, func(tx *gorm.DB) error {
		// 1. Lock the run, then its shift.
		run, err := lockRunByID(tx, caller.ProfileID, runID)
		if err != nil || run == nil {
			return err
		}
		// 2. A run that already ended replays its recorded answer.
		if run.Status != storedRunning {
			response = replayFinalize(run, output)
			return nil
		}
		now, err := databaseNow(tx)
		if err != nil {
			return err
		}
		resultID := shifts.ResultID(output.AssignmentResult)
		// Malformed output is recorded as a failure, so the run does not block new
		// runs at this revision until its lease runs out.
		if code := malformedOutput(resultID, output); code != "" {
			return closeRun(tx, run, now, storedFailed, code, nil)
		}
		shift, err := lockOwnedShift(tx, caller.ProfileID, run.ShiftID)
		if errors.Is(err, ErrShiftNotFound) {
			response.Status = RunStatusStale
			return closeRun(tx, run, now, storedStale, runErrorStale, &output)
		}
		if err != nil {
			return err
		}
		snapshot, err := shifts.Decode(shift.ShiftSnapshot)
		if err != nil {
			return err
		}
		// 3. The shift changed while the solver worked.
		expected := run.expectedBaseline()
		if !shiftOpenForRun(shift) || !shift.UpdatedAt.Equal(run.ExpectedShiftRevision) || snapshot.BaselineID() != expected {
			response.Status = RunStatusStale
			return closeRun(tx, run, now, storedStale, runErrorStale, &output)
		}
		// 4. The solver's answer does not fit the shift.
		code := shifts.OutputValidationError(shift.ShiftSnapshot, output.AssignmentResult, output.Flags, output.Objectives)
		if code == "" && expected != "" && resultID == expected {
			code = runErrorResultIDReused
		}
		if code != "" {
			return closeRun(tx, run, now, storedFailed, code, &output)
		}
		// 5. Save it.
		saving := savedAssignment{tx: tx, run: run, shift: &shift, snapshot: snapshot, output: output, resultID: resultID, now: now}
		response, err = saving.save(expected != "")
		return err
	})
	if err != nil {
		return RunResponse{}, err
	}
	return response, nil
}

// replayFinalize answers a finalize for a run that is no longer running. A
// succeeded run only counts as saved when the same result is being finalized again.
func replayFinalize(run *OptimizerRun, output solver.Output) RunResponse {
	if run.Status == storedSucceeded && !sameOutput(run, output) {
		return RunResponse{Status: RunStatusFailed, RunID: run.ID}
	}
	return recordedResponse(run)
}

// sameOutput is true when the run already saved exactly this solver output.
func sameOutput(run *OptimizerRun, output solver.Output) bool {
	return run.ResultID != nil && *run.ResultID == shifts.ResultID(output.AssignmentResult) &&
		run.InputFingerprint != nil && *run.InputFingerprint == output.InputFingerprint &&
		run.OptimizerVersion != nil && *run.OptimizerVersion == output.OptimizerVersion
}

// malformedOutput returns the code for output that cannot even be compared with
// the shift (blank result ID, fingerprint, or version), or "".
func malformedOutput(resultID string, output solver.Output) string {
	if resultID == "" {
		return "invalid_assignment_result"
	}
	if strings.TrimSpace(output.InputFingerprint) == "" || strings.TrimSpace(output.OptimizerVersion) == "" {
		return "invalid_output_shape"
	}
	return ""
}

// savedAssignment bundles what the success path of one finalize needs.
type savedAssignment struct {
	tx       *gorm.DB
	run      *OptimizerRun
	shift    *ActiveShift
	snapshot shifts.Snapshot
	output   solver.Output
	resultID string
	now      time.Time
}

// save writes the new assignment into the shift and marks the run succeeded. For a
// rerun it also supersedes every active manual move at the same moment the new
// baseline appears.
func (a savedAssignment) save(rerun bool) (RunResponse, error) {
	occupied := a.snapshot.OccupiedBedCount()
	next, err := a.snapshot.WithAssignment(a.output.AssignmentResult, a.output.Flags)
	if err != nil {
		return RunResponse{}, err
	}
	changedAt := nextShiftTime(a.shift.UpdatedAt)
	if err := a.tx.Model(a.shift).Updates(map[string]any{"shift_snapshot": string(next), "status": "assigned", "updated_at": changedAt}).Error; err != nil {
		return RunResponse{}, err
	}
	if rerun {
		err := a.tx.Table("public.manual_assignment_overrides").Where("shift_id = ? AND status = 'active'", a.shift.ID).
			Updates(map[string]any{"status": "superseded", "superseded_at": changedAt}).Error
		if err != nil {
			return RunResponse{}, err
		}
	}
	assigned := shifts.BedAssignmentCount(a.output.AssignmentResult)
	summary, err := json.Marshal(map[string]any{
		"assignedBedCount":   assigned,
		"unassignedBedCount": max(0, occupied-assigned),
		"objectiveSummary":   a.output.Objectives,
	})
	if err != nil {
		return RunResponse{}, err
	}
	err = finishRun(a.tx, a.run, a.now, map[string]any{
		"status": string(storedSucceeded), "input_fingerprint": a.output.InputFingerprint, "optimizer_version": a.output.OptimizerVersion,
		"result_id": a.resultID, "outcome_summary": string(summary),
	})
	if err != nil {
		return RunResponse{}, err
	}
	return RunResponse{Status: RunStatusSaved, RunID: a.run.ID, ResultID: a.resultID}, nil
}

// FailAssignmentRun records a failure on the caller's run while it is still
// running, mirroring fail_optimizer_run. A run that already ended is left alone.
func (s *Store) FailAssignmentRun(ctx context.Context, caller RunCaller, runID, errorCode string) error {
	code := strings.TrimSpace(errorCode)
	if code == "" {
		return nil
	}
	return s.WithWriteIdentity(ctx, caller.AuthUserID, func(tx *gorm.DB) error {
		run, err := lockRunByID(tx, caller.ProfileID, runID)
		if err != nil || run == nil || run.Status != storedRunning {
			return err
		}
		now, err := databaseNow(tx)
		if err != nil {
			return err
		}
		return closeRun(tx, run, now, storedFailed, code, nil)
	})
}

// ReleaseAssignmentRun marks the caller's run as "the solver was never reached" so
// the same mutation can be retried at once instead of waiting for the lease. The
// run stays running (the table only allows a finished run to have a completion
// time); only a note is added to its summary. A run that already ended is left alone.
func (s *Store) ReleaseAssignmentRun(ctx context.Context, caller RunCaller, runID string) error {
	return s.WithWriteIdentity(ctx, caller.AuthUserID, func(tx *gorm.DB) error {
		run, err := lockRunByID(tx, caller.ProfileID, runID)
		if err != nil || run == nil || run.Status != storedRunning {
			return err
		}
		return tx.Model(&OptimizerRun{}).Where("id = ?", run.ID).Update("outcome_summary", errorSummary(runErrorSolverUnreachable)).Error
	})
}

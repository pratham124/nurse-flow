package database

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// The unique indexes that reject a run which raced another.
var runRaceIndexes = map[string]bool{
	"optimizer_runs_idempotency":         true,
	"optimizer_runs_one_running_initial": true,
	"optimizer_runs_one_running_rerun":   true,
}

// runInsert lists exactly the columns Go may insert. id, status, and started_at
// come from database defaults, and id is read back through RETURNING.
type runInsert struct {
	ID                                 string `gorm:"->"`
	ShiftID                            string
	RequestedByProfileID               string
	ClientMutationID                   string
	ExpectedShiftRevision              time.Time
	ExpectedBaselineAssignmentResultID *string
	RequestFingerprint                 string
}

// TableName maps runInsert to the existing optimizer_runs table.
func (runInsert) TableName() string { return "public.optimizer_runs" }

// PrepareAssignmentRun decides what to do with a run request, mirroring
// prepare_optimizer_run. It returns ErrShiftNotFound for a missing or foreign
// shift. The run row is locked before the shift row everywhere (here and in
// finalize), so a retry and a finalizer cannot deadlock.
func (s *Store) PrepareAssignmentRun(ctx context.Context, caller RunCaller, shiftID string, request RunRequest) (PreparedRun, error) {
	var prepared PreparedRun
	mutationID := strings.TrimSpace(request.ClientMutationID)
	baseline := strings.TrimSpace(request.ExpectedBaseline)
	err := s.WithWriteIdentity(ctx, caller.AuthUserID, func(tx *gorm.DB) error {
		existing, err := findRun(tx, caller.ProfileID, shiftID, mutationID, true)
		if err != nil {
			return err
		}
		shift, err := lockOwnedShift(tx, caller.ProfileID, shiftID)
		if err != nil {
			return err
		}
		// Two first requests can both miss the lookup above. Once this request owns
		// the shift lock, look again without a lock (a finalizer cannot change the
		// run while waiting for this same shift lock).
		if existing == nil {
			if existing, err = findRun(tx, caller.ProfileID, shiftID, mutationID, false); err != nil {
				return err
			}
		}
		snapshot, err := shifts.Decode(shift.ShiftSnapshot)
		if err != nil {
			return err
		}
		current := snapshot.BaselineID()
		matches := shiftOpenForRun(shift) && request.ExpectedRevision.Equal(shift.UpdatedAt) && baseline == current
		fingerprint := shifts.RequestFingerprint(shiftID, request.ExpectedRevision, baseline)

		// Compare the mutation before the preconditions: a finished run changed the
		// revision, but its retry must still return the saved result.
		if existing != nil {
			prepared, err = prepareExisting(tx, existing, fingerprint, matches, shift.ShiftSnapshot)
			return err
		}
		if !matches {
			prepared = respond(RunStatusStale, "")
			return nil
		}
		prepared, err = insertRun(tx, caller.ProfileID, &shift, mutationID, current, fingerprint)
		return err
	})
	if err != nil {
		return PreparedRun{}, err
	}
	return prepared, nil
}

// findRun returns the caller's run for this mutation, or nil. With lock it takes
// the row lock the later shift lock must follow.
func findRun(tx *gorm.DB, profileID, shiftID, mutationID string, lock bool) (*OptimizerRun, error) {
	query := tx
	if lock {
		query = tx.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var rows []OptimizerRun
	err := query.Where("shift_id = ? AND requested_by_profile_id = ? AND client_mutation_id = ?", shiftID, profileID, mutationID).Limit(1).Find(&rows).Error
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return &rows[0], nil
}

// prepareExisting handles a request whose mutation already has a run.
func prepareExisting(tx *gorm.DB, run *OptimizerRun, fingerprint string, matches bool, snapshot json.RawMessage) (PreparedRun, error) {
	if run.RequestFingerprint != fingerprint {
		return respond(RunStatusConflict, run.ID), nil
	}
	if run.Status != storedRunning {
		response := recordedResponse(run)
		return PreparedRun{Response: &response}, nil
	}
	now, err := databaseNow(tx)
	if err != nil {
		return PreparedRun{}, err
	}
	// A crash or network failure can leave a run "running". Until the lease ends,
	// a retry must not solve it twice; after that the same mutation may reclaim it.
	// A run released because the solver was never reached has nothing in flight, so
	// it can be reclaimed straight away.
	if now.Sub(run.StartedAt) < runLease && !run.hasErrorCode(runErrorSolverUnreachable) {
		return respond(RunStatusRunning, run.ID), nil
	}
	if !matches {
		err := closeRun(tx, run, now, storedStale, runErrorStale, nil)
		return respond(RunStatusStale, run.ID), err
	}
	err = tx.Model(&OptimizerRun{}).Where("id = ?", run.ID).Updates(map[string]any{"started_at": now, "outcome_summary": "{}"}).Error
	if err != nil {
		return PreparedRun{}, err
	}
	return PreparedRun{Solve: &RunSolveJob{RunID: run.ID, ShiftSnapshot: snapshot}}, nil
}

func respond(status RunStatus, runID string) PreparedRun {
	return PreparedRun{Response: &RunResponse{Status: status, RunID: runID}}
}

// insertRun creates the run, unless another run at this revision is still solving.
// The unique indexes stay the final guard against a race that gets past the check.
func insertRun(tx *gorm.DB, profileID string, shift *ActiveShift, mutationID, baseline, fingerprint string) (PreparedRun, error) {
	other, err := runningRunAt(tx, shift.ID, shift.UpdatedAt, baseline)
	if err != nil {
		return PreparedRun{}, err
	}
	if other != "" {
		return respond(RunStatusRunning, other), nil
	}
	created := runInsert{
		ShiftID: shift.ID, RequestedByProfileID: profileID, ClientMutationID: mutationID, ExpectedShiftRevision: shift.UpdatedAt,
		ExpectedBaselineAssignmentResultID: nullableText(baseline), RequestFingerprint: fingerprint,
	}
	// A failed statement aborts the whole transaction, so the insert runs inside a
	// savepoint that can be undone when an index reports a race.
	if err := tx.SavePoint("insert_run").Error; err != nil {
		return PreparedRun{}, err
	}
	err = tx.Clauses(clause.Returning{Columns: []clause.Column{{Name: "id"}}}).Create(&created).Error
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && runRaceIndexes[pgErr.ConstraintName] {
		if err := tx.RollbackTo("insert_run").Error; err != nil {
			return PreparedRun{}, err
		}
		// The winner's ID is only a convenience; the answer is "running" without it.
		winner, _ := runningRunAt(tx, shift.ID, shift.UpdatedAt, baseline)
		return respond(RunStatusRunning, winner), nil
	}
	if err != nil {
		return PreparedRun{}, err
	}
	return PreparedRun{Solve: &RunSolveJob{RunID: created.ID, ShiftSnapshot: shift.ShiftSnapshot}}, nil
}

// runningRunAt returns the ID of a running run for this shift, revision, and
// baseline, or "". It takes no lock: the shift lock is already held.
func runningRunAt(tx *gorm.DB, shiftID string, revision time.Time, baseline string) (string, error) {
	query := tx.Where("shift_id = ? AND expected_shift_revision = ? AND status = ?", shiftID, revision, string(storedRunning))
	if baseline == "" {
		query = query.Where("expected_baseline_assignment_result_id IS NULL")
	} else {
		query = query.Where("expected_baseline_assignment_result_id = ?", baseline)
	}
	var rows []OptimizerRun
	if err := query.Limit(1).Find(&rows).Error; err != nil || len(rows) == 0 {
		return "", err
	}
	return rows[0].ID, nil
}

func nullableText(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

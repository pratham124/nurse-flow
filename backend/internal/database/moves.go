package database

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	// ErrShiftNotAssigned indicates that the shift has ended or is not in the assigned state.
	ErrShiftNotAssigned = errors.New("shift is not available for assignment moves")
	// ErrMoveConflict indicates that a unique index rejected a move that raced another.
	ErrMoveConflict = errors.New("bed assignment changed during the move")
)

// The unique indexes that reject a move which raced another.
const (
	activeBedIndex = "manual_assignment_overrides_one_active_bed"
	mutationIndex  = "manual_assignment_overrides_idempotency"
)

// MoveOverride is an override in the camelCase shape the app expects from a move.
// ManualOverride keeps the snake_case shape used by shift reads.
// SupersededAt is set only on a replayed move whose override a later move replaced.
type MoveOverride struct {
	ID                         string          `json:"id"`
	ShiftID                    string          `json:"shiftId"`
	BaselineAssignmentResultID string          `json:"baselineAssignmentResultId"`
	BedID                      string          `json:"bedId"`
	FromNurseID                string          `json:"fromNurseId"`
	ToNurseID                  string          `json:"toNurseId"`
	CreatedByProfileID         string          `json:"createdByProfileId"`
	CreatedAt                  time.Time       `json:"createdAt"`
	Status                     string          `json:"status"`
	ServerSequence             int64           `json:"serverSequence"`
	RelatedSwapRequestID       *string         `json:"relatedSwapRequestId"`
	WarningAcknowledgements    json.RawMessage `json:"warningAcknowledgements"`
	SupersededAt               *time.Time      `json:"supersededAt,omitempty"`
}

// MoveSaved is the response for a saved move or a replay.
type MoveSaved struct {
	Status                           string                  `json:"status"`
	Override                         MoveOverride            `json:"override"`
	ActiveAssignmentOverridesByBedID map[string]MoveOverride `json:"activeAssignmentOverridesByBedId"`
}

// MoveStale is the response when the board changed since the move was prepared.
type MoveStale struct {
	Status                            string                  `json:"status"`
	Message                           string                  `json:"message"`
	CurrentBaselineAssignmentResultID *string                 `json:"currentBaselineAssignmentResultId"`
	CurrentEffectiveNurseID           *string                 `json:"currentEffectiveNurseId"`
	ActiveAssignmentOverridesByBedID  map[string]MoveOverride `json:"activeAssignmentOverridesByBedId"`
}

// MoveOutcome holds whichever response a move produced; exactly one field is set.
type MoveOutcome struct {
	Saved *MoveSaved
	Stale *MoveStale
}

// Body returns the value to send to the app.
func (o MoveOutcome) Body() any {
	if o.Stale != nil {
		return o.Stale
	}
	return o.Saved
}

func moveOverrideOf(row ManualOverride) MoveOverride {
	return MoveOverride{
		ID: row.ID, ShiftID: row.ShiftID, BaselineAssignmentResultID: row.BaselineAssignmentResultID,
		BedID: row.BedID, FromNurseID: row.FromNurseID, ToNurseID: row.ToNurseID,
		CreatedByProfileID: row.CreatedByProfileID, CreatedAt: row.CreatedAt.UTC(), Status: row.Status,
		ServerSequence: row.ServerSequence, RelatedSwapRequestID: row.RelatedSwapRequestID,
		WarningAcknowledgements: row.WarningAcknowledgements,
	}
}

func activeProjection(shift *ActiveShift) map[string]MoveOverride {
	projection := make(map[string]MoveOverride, len(shift.ActiveAssignmentOverridesByBedID))
	for bedID, row := range shift.ActiveAssignmentOverridesByBedID {
		projection[bedID] = moveOverrideOf(row)
	}
	return projection
}

// MoveAssignment confirms a manual move of one bed. The shift row is locked
// first, so concurrent moves, requests, and shift changes run one at a time.
// A repeated client mutation ID returns the earlier override without any write.
func (s *Store) MoveAssignment(ctx context.Context, authID, profileID, shiftID string, request shifts.MoveRequest) (MoveOutcome, error) {
	var outcome MoveOutcome
	err := s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		row, err := lockOwnedShift(tx, profileID, shiftID)
		if err != nil {
			return err
		}
		if row.EndedAt != nil || row.Status != "assigned" {
			return ErrShiftNotAssigned
		}
		replayed, err := findReplayedMove(tx, shiftID, profileID, request.ClientMutationID)
		if err != nil {
			return err
		}
		overrides, err := overridesOf(tx, &row)
		if err != nil {
			return err
		}
		if replayed != nil {
			// Only a replay reports whether a later move has replaced the override.
			replayedOverride := moveOverrideOf(*replayed)
			replayedOverride.SupersededAt = replayed.SupersededAt
			outcome.Saved = &MoveSaved{
				Status:                           "saved",
				Override:                         replayedOverride,
				ActiveAssignmentOverridesByBedID: activeProjection(&row),
			}
			return nil
		}
		snapshot, err := shifts.Decode(row.ShiftSnapshot)
		if err != nil {
			return err
		}
		// One timestamp stamps every row this move writes.
		now := nextShiftTime(row.UpdatedAt)
		plan, err := snapshot.PlanMove(request, overrides, profileID, now)
		if err != nil {
			return err
		}
		if plan.Stale != nil {
			outcome.Stale = &MoveStale{
				Status: "stale", Message: plan.Stale.Message,
				CurrentBaselineAssignmentResultID: plan.Stale.CurrentBaselineID,
				CurrentEffectiveNurseID:           plan.Stale.CurrentEffectiveNurseID,
				ActiveAssignmentOverridesByBedID:  activeProjection(&row),
			}
			return nil
		}
		saved, err := writeMove(tx, &row, profileID, request, plan.Acknowledgements, now)
		if err != nil {
			return err
		}
		// The insert trigger may have completed a linked swap and changed the
		// snapshot, so reload the projection and never write the snapshot back.
		if err := loadOverrides(tx, &row); err != nil {
			return err
		}
		outcome.Saved = &MoveSaved{Status: "saved", Override: moveOverrideOf(saved), ActiveAssignmentOverridesByBedID: activeProjection(&row)}
		return nil
	})
	if err != nil {
		return MoveOutcome{}, err
	}
	return outcome, nil
}

// findReplayedMove returns the caller's earlier override with this mutation ID, or nil.
func findReplayedMove(tx *gorm.DB, shiftID, profileID, mutationID string) (*ManualOverride, error) {
	var rows []ManualOverride
	err := tx.Where("shift_id = ? AND created_by_profile_id = ? AND client_mutation_id = ?", shiftID, profileID, mutationID).Limit(1).Find(&rows).Error
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return &rows[0], nil
}

// overrideInsert lists exactly the override columns Go may insert. A separate
// type keeps GORM from sending id and server_sequence, which the database
// generates; both are read back through RETURNING. Acknowledgements are a JSON
// string so the jsonb column receives text.
type overrideInsert struct {
	ID                         string `gorm:"->"`
	ServerSequence             int64  `gorm:"->"`
	ShiftID                    string
	BaselineAssignmentResultID string
	BedID                      string
	FromNurseID                string
	ToNurseID                  string
	CreatedByProfileID         string
	CreatedAt                  time.Time
	Status                     string
	RelatedSwapRequestID       *string
	WarningAcknowledgements    string `gorm:"type:jsonb"`
	ClientMutationID           string
}

// TableName maps overrideInsert to the existing manual_assignment_overrides table.
func (overrideInsert) TableName() string { return "public.manual_assignment_overrides" }

// writeMove supersedes the bed's active override, inserts the new one, and bumps
// the shift's revision. Only active_shifts.updated_at is written: the retained
// trigger on the insert completes a linked swap by editing the snapshot itself.
func writeMove(tx *gorm.DB, shift *ActiveShift, profileID string, request shifts.MoveRequest, acknowledgements json.RawMessage, now time.Time) (ManualOverride, error) {
	err := tx.Table("public.manual_assignment_overrides").
		Where("shift_id = ? AND bed_id = ? AND status = 'active'", shift.ID, request.BedID).
		Updates(map[string]any{"status": "superseded", "superseded_at": now}).Error
	if err != nil {
		return ManualOverride{}, err
	}
	created := overrideInsert{
		ShiftID: shift.ID, BaselineAssignmentResultID: request.BaselineAssignmentResultID, BedID: request.BedID,
		FromNurseID: request.FromNurseID, ToNurseID: request.ToNurseID, CreatedByProfileID: profileID,
		CreatedAt: now, Status: "active", RelatedSwapRequestID: request.RelatedSwapRequestID,
		WarningAcknowledgements: string(acknowledgements), ClientMutationID: request.ClientMutationID,
	}
	err = tx.Clauses(clause.Returning{Columns: []clause.Column{{Name: "id"}, {Name: "server_sequence"}}}).Create(&created).Error
	// Only the two override indexes mean a racing move; other unique errors propagate.
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" &&
		(pgErr.ConstraintName == activeBedIndex || pgErr.ConstraintName == mutationIndex) {
		return ManualOverride{}, ErrMoveConflict
	}
	if err != nil {
		return ManualOverride{}, err
	}
	saved := ManualOverride{
		ID: created.ID, ShiftID: created.ShiftID, BaselineAssignmentResultID: created.BaselineAssignmentResultID,
		BedID: created.BedID, FromNurseID: created.FromNurseID, ToNurseID: created.ToNurseID,
		CreatedByProfileID: created.CreatedByProfileID, CreatedAt: created.CreatedAt, Status: created.Status,
		ServerSequence: created.ServerSequence, RelatedSwapRequestID: created.RelatedSwapRequestID,
		WarningAcknowledgements: acknowledgements,
	}
	return saved, tx.Model(shift).Update("updated_at", now).Error
}

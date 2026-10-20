package database

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"github.com/pratham124/nurse-flow/backend/internal/templates"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrShiftNotFound    = errors.New("active shift not found")
	ErrShiftStale       = errors.New("shift changed since this setup was loaded")
	ErrShiftAssigned    = errors.New("reopen the assigned shift before saving setup")
	ErrShiftAlreadyOpen = errors.New("an active charge shift already exists")
)

type ActiveShift struct {
	ID                               string                    `gorm:"type:uuid;primaryKey" json:"id"`
	ChargeProfileID                  string                    `gorm:"type:uuid" json:"charge_profile_id"`
	FloorTemplateID                  *string                   `gorm:"type:uuid" json:"floor_template_id"`
	Status                           string                    `json:"status"`
	ShiftSnapshot                    json.RawMessage           `gorm:"type:jsonb" json:"shift_snapshot"`
	CreatedAt                        time.Time                 `json:"created_at"`
	UpdatedAt                        time.Time                 `json:"updated_at"`
	EndedAt                          *time.Time                `json:"ended_at"`
	ActiveAssignmentOverridesByBedID map[string]ManualOverride `gorm:"-" json:"active_assignment_overrides_by_bed_id"`
}

func (ActiveShift) TableName() string { return "public.active_shifts" }

type ManualOverride struct {
	ID                         string          `json:"id"`
	ShiftID                    string          `json:"shift_id"`
	BaselineAssignmentResultID string          `json:"baseline_assignment_result_id"`
	BedID                      string          `json:"bed_id"`
	FromNurseID                string          `json:"from_nurse_id"`
	ToNurseID                  string          `json:"to_nurse_id"`
	CreatedByProfileID         string          `json:"created_by_profile_id"`
	CreatedAt                  time.Time       `json:"created_at"`
	Status                     string          `json:"status"`
	SupersededAt               *time.Time      `json:"superseded_at"`
	ServerSequence             int64           `json:"server_sequence"`
	RelatedSwapRequestID       *string         `json:"related_swap_request_id"`
	WarningAcknowledgements    json.RawMessage `gorm:"type:jsonb" json:"warning_acknowledgements"`
}

func (ManualOverride) TableName() string { return "public.manual_assignment_overrides" }

type PreviousShift struct {
	ID                 string          `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ChargeProfileID    string          `gorm:"type:uuid" json:"charge_profile_id"`
	FloorTemplateID    *string         `gorm:"type:uuid" json:"floor_template_id"`
	CompletedAt        time.Time       `json:"completed_at"`
	NurseSuggestions   json.RawMessage `gorm:"type:jsonb" json:"nurse_suggestions"`
	PatientSuggestions json.RawMessage `gorm:"type:jsonb" json:"patient_suggestions"`
}

func (PreviousShift) TableName() string { return "public.previous_shift_snapshots" }

func loadOverrides(tx *gorm.DB, shift *ActiveShift) error {
	shift.ActiveAssignmentOverridesByBedID = map[string]ManualOverride{}
	var rows []ManualOverride
	// Legacy installations without this optional table used an empty projection.
	// A savepoint keeps the read transaction usable after an undefined-table error.
	if err := tx.SavePoint("read_overrides").Error; err != nil {
		return err
	}
	if err := tx.Where("shift_id = ? AND status = 'active'", shift.ID).Find(&rows).Error; err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "42P01" {
			return tx.RollbackTo("read_overrides").Error
		}
		return err
	}
	for _, row := range rows {
		shift.ActiveAssignmentOverridesByBedID[row.BedID] = row
	}
	return nil
}

// The read-only identity transaction uses a repeatable snapshot, so the baseline
// and its override projection cannot come from different assignment revisions.
func (s *Store) CurrentShift(ctx context.Context, authID, profileID string) (*ActiveShift, error) {
	var current *ActiveShift
	err := s.WithIdentity(ctx, authID, func(tx *gorm.DB) error {
		var rows []ActiveShift
		if err := tx.Where("charge_profile_id = ? AND ended_at IS NULL", profileID).Order("updated_at DESC").Limit(1).Find(&rows).Error; err != nil {
			return err
		}
		if len(rows) == 0 {
			return nil
		}
		current = &rows[0]
		return loadOverrides(tx, current)
	})
	if err != nil {
		return nil, err
	}
	return current, nil
}

func (s *Store) PreviousShifts(ctx context.Context, authID, profileID string) ([]PreviousShift, error) {
	rows := []PreviousShift{}
	err := s.WithIdentity(ctx, authID, func(tx *gorm.DB) error {
		return tx.Where("charge_profile_id = ?", profileID).Order("completed_at DESC").Find(&rows).Error
	})
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *Store) StartShift(ctx context.Context, authID, profileID, templateID string) (ActiveShift, error) {
	id, err := shifts.NewID()
	if err != nil {
		return ActiveShift{}, err
	}
	var saved ActiveShift
	err = s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		// No open-shift uniqueness exists in the retained schema. This owner-scoped
		// transaction lock serializes Go starts across templates and API instances.
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", "nurseflow:charge-start:"+strings.ToLower(profileID)).Error; err != nil {
			return err
		}
		var template FloorTemplate
		err := tx.Clauses(clause.Locking{Strength: "SHARE"}).Where("id = ? AND owner_profile_id = ?", templateID, profileID).Take(&template).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTemplateNotFound
		}
		if err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&ActiveShift{}).Where("charge_profile_id = ? AND ended_at IS NULL", profileID).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return ErrShiftAlreadyOpen
		}
		var layout templates.Snapshot
		if err := json.Unmarshal(template.TemplateSnapshot, &layout); err != nil {
			return err
		}
		layout.ID, layout.Name = template.ID, template.Name
		now := time.Now().UTC().Truncate(time.Microsecond)
		raw, err := shifts.New(layout, id, now)
		if err != nil {
			return err
		}
		saved = ActiveShift{ID: id, ChargeProfileID: profileID, FloorTemplateID: &template.ID, Status: "setup", ShiftSnapshot: raw, CreatedAt: now, UpdatedAt: now, ActiveAssignmentOverridesByBedID: map[string]ManualOverride{}}
		return tx.Omit("EndedAt").Create(&saved).Error
	})
	if err != nil {
		return ActiveShift{}, err
	}
	return saved, nil
}

func lockShift(tx *gorm.DB, profileID, id string) (ActiveShift, error) {
	var row ActiveShift
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND charge_profile_id = ? AND ended_at IS NULL", id, profileID).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return row, ErrShiftNotFound
	}
	return row, err
}

// Advance even if a legacy caller's clock was ahead, or two writes share a
// microsecond. The optimizer and setup screens both use updated_at as revision.
func nextShiftTime(current time.Time) time.Time {
	now := time.Now().UTC().Truncate(time.Microsecond)
	if !now.After(current) {
		return current.Add(time.Microsecond)
	}
	return now
}

func (s *Store) SaveShiftSetup(ctx context.Context, authID, profileID, id string, expected time.Time, input shifts.Setup) (ActiveShift, error) {
	var saved ActiveShift
	err := s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		row, err := lockShift(tx, profileID, id)
		if err != nil {
			return err
		}
		if expected.IsZero() || !expected.Equal(row.UpdatedAt) {
			return ErrShiftStale
		}
		snapshot, err := shifts.Decode(row.ShiftSnapshot)
		if err != nil {
			return err
		}
		if row.Status != "setup" || snapshot.BaselineID() != "" {
			return ErrShiftAssigned
		}
		raw, err := snapshot.ApplySetup(input)
		if err != nil {
			return err
		}
		if err := tx.Model(&row).Updates(map[string]any{"shift_snapshot": string(raw), "updated_at": nextShiftTime(row.UpdatedAt)}).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", id).Take(&saved).Error; err != nil {
			return err
		}
		return loadOverrides(tx, &saved)
	})
	if err != nil {
		return ActiveShift{}, err
	}
	return saved, nil
}

type ReopenResult struct {
	Status                           string                    `json:"status"`
	Message                          string                    `json:"message,omitempty"`
	ShiftSnapshot                    json.RawMessage           `json:"shiftSnapshot,omitempty"`
	ActiveAssignmentOverridesByBedID map[string]ManualOverride `json:"activeAssignmentOverridesByBedId,omitempty"`
}

func (s *Store) ReopenShift(ctx context.Context, authID, profileID, id, expectedBaseline string) (ReopenResult, error) {
	var result ReopenResult
	err := s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		row, err := lockShift(tx, profileID, id)
		if err != nil {
			return err
		}
		snapshot, err := shifts.Decode(row.ShiftSnapshot)
		if err != nil {
			return err
		}
		baseline := snapshot.BaselineID()
		if baseline != strings.TrimSpace(expectedBaseline) {
			result = ReopenResult{Status: "stale", Message: "The assignment changed. Review the current board before editing."}
			return nil
		}
		// Match the existing RPC's no-baseline no-op, including its lack of effects.
		result = ReopenResult{Status: "saved", ShiftSnapshot: row.ShiftSnapshot, ActiveAssignmentOverridesByBedID: map[string]ManualOverride{}}
		if baseline == "" {
			return nil
		}
		now := nextShiftTime(row.UpdatedAt)
		raw, err := snapshot.Reopen()
		if err != nil {
			return err
		}
		if err := tx.Table("public.manual_assignment_overrides").Where("shift_id = ? AND status = 'active'", id).Updates(map[string]any{"status": "superseded", "superseded_at": now}).Error; err != nil {
			return err
		}
		if err := expireShiftInvites(tx, id, now); err != nil {
			return err
		}
		if err := tx.Table("public.shift_nurse_access").Where("shift_id = ? AND status IN ('pending_link', 'linked')", id).Updates(map[string]any{"status": "removed", "updated_at": now}).Error; err != nil {
			return err
		}
		if err := tx.Model(&row).Updates(map[string]any{"shift_snapshot": string(raw), "status": "setup", "updated_at": now}).Error; err != nil {
			return err
		}
		result.ShiftSnapshot = raw
		return nil
	})
	if err != nil {
		return ReopenResult{}, err
	}
	return result, nil
}

func expireShiftInvites(tx *gorm.DB, id string, now time.Time) error {
	return tx.Table("public.shift_nurse_invites").Where("shift_id = ? AND status = 'active'", id).Updates(map[string]any{"status": "expired", "updated_at": now}).Error
}

func (s *Store) EndShift(ctx context.Context, authID, profileID, id string) (ActiveShift, error) {
	var saved ActiveShift
	err := s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		// Template deletion locks the parent template before ON DELETE SET NULL
		// locks its shifts. Take the same order before inserting carry-over, whose
		// foreign key also locks that template, to avoid the opposite-order cycle.
		var reference ActiveShift
		if err := tx.Where("id = ? AND charge_profile_id = ? AND ended_at IS NULL", id, profileID).Take(&reference).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrShiftNotFound
			}
			return err
		}
		if reference.FloorTemplateID == nil {
			return ErrTemplateNotFound
		}
		var template FloorTemplate
		if err := tx.Clauses(clause.Locking{Strength: "KEY SHARE"}).Where("id = ? AND owner_profile_id = ?", *reference.FloorTemplateID, profileID).Take(&template).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTemplateNotFound
			}
			return err
		}
		row, err := lockShift(tx, profileID, id)
		if err != nil {
			return err
		}
		// Serialize carry-over replacement for legacy owners with multiple open
		// rows on one template. Never take an optimizer-run lock after this lock.
		if row.FloorTemplateID == nil || *row.FloorTemplateID != template.ID {
			return ErrTemplateNotFound
		}
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", "nurseflow:carry-over:"+strings.ToLower(profileID+":"+*row.FloorTemplateID)).Error; err != nil {
			return err
		}
		snapshot, err := shifts.Decode(row.ShiftSnapshot)
		if err != nil {
			return err
		}
		nurses, patients, err := snapshot.CarryOver()
		if err != nil {
			return err
		}
		now := nextShiftTime(row.UpdatedAt)
		if err := tx.Where("charge_profile_id = ? AND floor_template_id = ?", profileID, *row.FloorTemplateID).Delete(&PreviousShift{}).Error; err != nil {
			return err
		}
		if len(nurses) > 0 || len(patients) > 0 {
			nurseJSON, err := json.Marshal(nurses)
			if err != nil {
				return err
			}
			patientJSON, err := json.Marshal(patients)
			if err != nil {
				return err
			}
			previous := PreviousShift{ChargeProfileID: profileID, FloorTemplateID: row.FloorTemplateID, CompletedAt: now, NurseSuggestions: nurseJSON, PatientSuggestions: patientJSON}
			if err := tx.Create(&previous).Error; err != nil {
				return err
			}
		}
		if err := expireShiftInvites(tx, id, now); err != nil {
			return err
		}
		// Do not rewrite the snapshot, remove linked access, or supersede moves.
		// Retained AFTER UPDATE triggers broadcast the ended state on commit.
		if err := tx.Model(&row).Updates(map[string]any{"ended_at": now, "updated_at": now}).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", id).Take(&saved).Error; err != nil {
			return err
		}
		return loadOverrides(tx, &saved)
	})
	if err != nil {
		return ActiveShift{}, err
	}
	return saved, nil
}

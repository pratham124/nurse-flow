package database

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pratham124/nurse-flow/backend/internal/invites"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"gorm.io/gorm"
)

var (
	// ErrShiftEnded indicates that an invite was requested for an ended shift.
	ErrShiftEnded = errors.New("shift has ended")
	// ErrNurseNotOnShift indicates that the nurse is not in the stored shift snapshot.
	ErrNurseNotOnShift = errors.New("nurse is not on the shift")
	// ErrNurseUnassigned indicates that the nurse has no occupied bed.
	ErrNurseUnassigned = errors.New("nurse has no assigned patients")
	// ErrInviteExists indicates that the nurse already has an active invite.
	ErrInviteExists = errors.New("nurse already has an active invite")
)

// activeInviteIndex is the partial unique index allowing one active invite per nurse slot.
const activeInviteIndex = "shift_nurse_invites_one_active_per_nurse"

// InviteRow is an invite as shown to the charge nurse. It has no token hash.
type InviteRow struct {
	ID                 string     `json:"id"`
	ShiftID            string     `json:"shift_id"`
	NurseID            string     `json:"nurse_id"`
	CreatedByProfileID string     `json:"created_by_profile_id"`
	Status             string     `json:"status"`
	CreatedAt          time.Time  `json:"created_at"`
	ExpiresAt          time.Time  `json:"expires_at"`
	UsedAt             *time.Time `json:"used_at"`
	UsedByProfileID    *string    `json:"used_by_profile_id"`
	RevokedAt          *time.Time `json:"revoked_at"`
}

// AccessRow maps a nurse slot's link to an application profile.
type AccessRow struct {
	ID             string    `json:"id"`
	ShiftID        string    `json:"shift_id"`
	NurseID        string    `json:"nurse_id"`
	NurseName      string    `json:"nurse_name"`
	NurseProfileID *string   `json:"nurse_profile_id"`
	NurseEmail     *string   `json:"nurse_email"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// InviteList is every invite and access row for one shift.
type InviteList struct {
	Invites []InviteRow `json:"invites"`
	Access  []AccessRow `json:"access"`
}

// overridesOf reads the shift's active moves (see loadOverrides) in the form the
// shift rules use.
func overridesOf(tx *gorm.DB, shift *ActiveShift) ([]shifts.ActiveOverride, error) {
	if err := loadOverrides(tx, shift); err != nil {
		return nil, err
	}
	overrides := make([]shifts.ActiveOverride, 0, len(shift.ActiveAssignmentOverridesByBedID))
	for _, override := range shift.ActiveAssignmentOverridesByBedID {
		overrides = append(overrides, shifts.ActiveOverride{ID: override.ID, BedID: override.BedID, ToNurseID: override.ToNurseID})
	}
	return overrides, nil
}

// ListInvites returns an owned open shift's invites and nurse access, newest first.
func (s *Store) ListInvites(ctx context.Context, authID, profileID, shiftID string) (InviteList, error) {
	list := InviteList{Invites: []InviteRow{}, Access: []AccessRow{}}
	err := s.WithIdentity(ctx, authID, func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&ActiveShift{}).Where("id = ? AND charge_profile_id = ? AND ended_at IS NULL", shiftID, profileID).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return ErrShiftNotFound
		}
		if err := tx.Where("shift_id = ?", shiftID).Order("created_at DESC").Find(&list.Invites).Error; err != nil {
			return err
		}
		return tx.Table("public.shift_nurse_access").Where("shift_id = ?", shiftID).Order("updated_at DESC").Find(&list.Access).Error
	})
	if err != nil {
		return InviteList{}, err
	}
	return list, nil
}

// CreateInvite stores a new active invite for one nurse slot, or fails with
// ErrInviteExists when the nurse already has one. The caller supplies only the
// code's hash.
func (s *Store) CreateInvite(ctx context.Context, authID, profileID, shiftID, nurseID, tokenHash string) (InviteRow, error) {
	return s.issueInvite(ctx, authID, profileID, shiftID, nurseID, tokenHash, false)
}

// RegenerateInvite revokes the nurse's active invite, if any, and stores a new
// one in the same transaction.
func (s *Store) RegenerateInvite(ctx context.Context, authID, profileID, shiftID, nurseID, tokenHash string) (InviteRow, error) {
	return s.issueInvite(ctx, authID, profileID, shiftID, nurseID, tokenHash, true)
}

// issueInvite locks the shift row, which serializes every invite change for the shift.
func (s *Store) issueInvite(ctx context.Context, authID, profileID, shiftID, nurseID, tokenHash string, replaceActive bool) (InviteRow, error) {
	var created InviteRow
	err := s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		shift, err := lockOwnedShift(tx, profileID, shiftID)
		if err != nil {
			return err
		}
		if shift.EndedAt != nil {
			return ErrShiftEnded
		}
		snapshot, err := shifts.Decode(shift.ShiftSnapshot)
		if err != nil {
			return err
		}
		if _, onShift := snapshot.NurseName(nurseID); !onShift {
			return ErrNurseNotOnShift
		}
		overrides, err := overridesOf(tx, &shift)
		if err != nil {
			return err
		}
		assigned, err := snapshot.AssignedPatientCount(nurseID, overrides)
		if err != nil {
			return err
		}
		if assigned == 0 {
			return ErrNurseUnassigned
		}
		if replaceActive {
			if err := tx.Table("public.shift_nurse_invites").Where("shift_id = ? AND nurse_id = ? AND status = 'active'", shiftID, nurseID).
				Updates(map[string]any{"status": invites.InviteRevoked, "revoked_at": gorm.Expr("now()"), "updated_at": gorm.Expr("now()")}).Error; err != nil {
				return err
			}
		} else {
			var active int64
			if err := tx.Table("public.shift_nurse_invites").Where("shift_id = ? AND nurse_id = ? AND status = 'active'", shiftID, nurseID).Count(&active).Error; err != nil {
				return err
			}
			if active > 0 {
				return ErrInviteExists
			}
		}
		// Raw: the expiry must come from the database clock (a Go value could skew it), and
		// GORM's map Create does not read the generated id back.
		var createdID string
		err = tx.Raw(`
			INSERT INTO public.shift_nurse_invites
				(shift_id, nurse_id, created_by_profile_id, token_hash, status, expires_at)
			VALUES (?, ?, ?, ?, 'active', now() + interval '24 hours')
			RETURNING id
		`, shiftID, nurseID, profileID, tokenHash).Scan(&createdID).Error
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == activeInviteIndex {
			return ErrInviteExists
		}
		if err != nil {
			return err
		}
		// Load the new row through InviteRow, which reads every column but token_hash.
		return tx.Where("id = ?", createdID).Take(&created).Error
	})
	if err != nil {
		return InviteRow{}, err
	}
	return created, nil
}

// TableName maps InviteRow to the existing shift_nurse_invites table.
func (InviteRow) TableName() string { return "public.shift_nurse_invites" }

// TableName maps AccessRow to the existing shift_nurse_access table.
func (AccessRow) TableName() string { return "public.shift_nurse_access" }

// newestLinkedAccess finds the profile's newest linked access on an unended
// shift, or nil. Both joining and the joined workspace use it.
func newestLinkedAccess(tx *gorm.DB, profileID string) (*AccessRow, error) {
	var rows []AccessRow
	// Raw: a join reads more clearly as one SQL statement than as builder
	// fragments, and SELECT a.* makes it explicit that only access columns are read.
	if err := tx.Raw(`
		SELECT a.*
		FROM public.shift_nurse_access a
		JOIN public.active_shifts s ON s.id = a.shift_id
		WHERE a.nurse_profile_id = ? AND a.status = 'linked' AND s.ended_at IS NULL
		ORDER BY a.updated_at DESC
		LIMIT 1
	`, profileID).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &rows[0], nil
}

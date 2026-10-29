package database

import (
	"context"
	"errors"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/invites"
	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// InviteValidation is the answer to "would this code let me join?". Nothing about
// patients or assignments is included; only what the nurse confirms before joining.
type InviteValidation struct {
	Status    string     `json:"status"`
	Reason    string     `json:"reason,omitempty"`
	InviteID  string     `json:"invite_id,omitempty"`
	ShiftID   string     `json:"shift_id,omitempty"`
	NurseID   string     `json:"nurse_id,omitempty"`
	NurseName string     `json:"nurse_name,omitempty"`
	FloorName string     `json:"floor_name,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// InviteJoin is the outcome of accepting a code.
type InviteJoin struct {
	Status    string `json:"status"`
	Reason    string `json:"reason,omitempty"`
	AccessID  string `json:"access_id,omitempty"`
	ShiftID   string `json:"shift_id,omitempty"`
	NurseID   string `json:"nurse_id,omitempty"`
	NurseName string `json:"nurse_name,omitempty"`
	FloorName string `json:"floor_name,omitempty"`
}

func blockedValidation(reason string) InviteValidation {
	return InviteValidation{Status: invites.StatusBlocked, Reason: reason}
}

func blockedJoin(reason string) InviteJoin {
	return InviteJoin{Status: invites.StatusBlocked, Reason: reason}
}

// joinTarget is an invite whose shift and nurse slot were found and are still usable.
type joinTarget struct {
	invite    InviteRow
	nurseName string
	floorName string
}

// newestInvite finds the latest invite with the presented code's hash. The hash
// capability policy means this can never return another code's invite.
func newestInvite(tx *gorm.DB, tokenHash string, lock bool) (*InviteRow, error) {
	query := tx.Where("token_hash = ?", tokenHash).Order("created_at DESC").Limit(1)
	if lock {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var rows []InviteRow
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &rows[0], nil
}

// findJoinTarget runs the checks both validate and accept share, in the original
// order: invite status and expiry, shift ended, nurse missing, then whether the
// profile is linked to a different shift or nurse slot. A non-empty reason means
// the code cannot be used.
func findJoinTarget(tx *gorm.DB, profileID string, invite InviteRow) (joinTarget, string, error) {
	var now time.Time
	// Raw: GORM has no builder for selecting the database clock.
	if err := tx.Raw("SELECT now()").Scan(&now).Error; err != nil {
		return joinTarget{}, "", err
	}
	if reason := invites.UnusableReason(invite.Status, invite.ExpiresAt, now); reason != "" {
		return joinTarget{}, reason, nil
	}
	var found []ActiveShift
	if err := tx.Where("id = ?", invite.ShiftID).Limit(1).Find(&found).Error; err != nil {
		return joinTarget{}, "", err
	}
	if len(found) == 0 || found[0].EndedAt != nil {
		return joinTarget{}, invites.ReasonEndedShift, nil
	}
	snapshot, err := shifts.Decode(found[0].ShiftSnapshot)
	if err != nil {
		return joinTarget{}, "", err
	}
	nurseName, onShift := snapshot.NurseName(invite.NurseID)
	if !onShift {
		return joinTarget{}, invites.ReasonStaleNurse, nil
	}
	current, err := newestLinkedAccess(tx, profileID)
	if err != nil {
		return joinTarget{}, "", err
	}
	if current != nil && (current.ShiftID != invite.ShiftID || current.NurseID != invite.NurseID) {
		return joinTarget{}, invites.ReasonParticipationConflict, nil
	}
	return joinTarget{invite: invite, nurseName: nurseName, floorName: snapshot.FloorName()}, "", nil
}

// ValidateInvite checks a presented code without changing anything. tokenHash
// must come from invites.HashCode for an already format-checked code.
func (s *Store) ValidateInvite(ctx context.Context, authID, profileID, tokenHash string) (InviteValidation, error) {
	result := blockedValidation(invites.ReasonNotFound)
	err := s.WithInviteCodeRead(ctx, authID, tokenHash, func(tx *gorm.DB) error {
		invite, err := newestInvite(tx, tokenHash, false)
		if err != nil || invite == nil {
			return err
		}
		target, reason, err := findJoinTarget(tx, profileID, *invite)
		if err != nil {
			return err
		}
		if reason != "" {
			result = blockedValidation(reason)
			return nil
		}
		result = InviteValidation{
			Status: invites.StatusValid, InviteID: invite.ID, ShiftID: invite.ShiftID, NurseID: invite.NurseID,
			NurseName: target.nurseName, FloorName: target.floorName, ExpiresAt: &invite.ExpiresAt,
		}
		return nil
	})
	if err != nil {
		return InviteValidation{}, err
	}
	return result, nil
}

// AcceptInvite links the profile to the invite's nurse slot and marks the invite
// used, all in one transaction. A transaction advisory lock keyed on the joining
// profile makes that profile's joins run one at a time, so two codes for two
// shifts cannot both succeed. Locking the invite row makes simultaneous accepts
// of the same code run one at a time too.
func (s *Store) AcceptInvite(ctx context.Context, authID, profileID, tokenHash string) (InviteJoin, error) {
	result := blockedJoin(invites.ReasonNotFound)
	err := s.WithInviteCodeWrite(ctx, authID, tokenHash, func(tx *gorm.DB) error {
		// Raw: a function call, not a table query.
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", "nurseflow:invite-join:"+profileID).Error; err != nil {
			return err
		}
		// A charge nurse who is running a shift cannot also join another.
		var running int64
		if err := tx.Model(&ActiveShift{}).Where("charge_profile_id = ? AND ended_at IS NULL", profileID).Count(&running).Error; err != nil {
			return err
		}
		if running > 0 {
			result = blockedJoin(invites.ReasonParticipationConflict)
			return nil
		}
		invite, err := newestInvite(tx, tokenHash, true)
		if err != nil || invite == nil {
			return err
		}
		target, reason, err := findJoinTarget(tx, profileID, *invite)
		if err != nil {
			return err
		}
		if reason != "" {
			result = blockedJoin(reason)
			return nil
		}
		accessID, taken, err := linkNurseSlot(tx, profileID, target)
		if err != nil {
			return err
		}
		if taken {
			result = blockedJoin(invites.ReasonAlreadyUsed)
			return nil
		}
		if err := tx.Table("public.shift_nurse_invites").Where("id = ?", invite.ID).Updates(map[string]any{
			"status": invites.InviteUsed, "used_at": gorm.Expr("now()"), "used_by_profile_id": profileID, "updated_at": gorm.Expr("now()"),
		}).Error; err != nil {
			return err
		}
		result = InviteJoin{
			Status: invites.StatusJoined, AccessID: accessID, ShiftID: invite.ShiftID, NurseID: invite.NurseID,
			NurseName: target.nurseName, FloorName: target.floorName,
		}
		return nil
	})
	if err != nil {
		return InviteJoin{}, err
	}
	return result, nil
}

// linkNurseSlot reuses the profile's own linked access row, or relinks the newest
// pending or removed row, or inserts a new one. taken is true when another profile
// is already linked to the slot.
func linkNurseSlot(tx *gorm.DB, profileID string, target joinTarget) (accessID string, taken bool, err error) {
	invite := target.invite
	var linked []AccessRow
	if err := tx.Where("shift_id = ? AND nurse_id = ? AND status = 'linked'", invite.ShiftID, invite.NurseID).Order("updated_at DESC").Limit(1).Find(&linked).Error; err != nil {
		return "", false, err
	}
	if len(linked) > 0 && (linked[0].NurseProfileID == nil || *linked[0].NurseProfileID != profileID) {
		return "", true, nil
	}
	// Lock the profile's own linked row before reusing it. If a charge nurse
	// removed it meanwhile, Postgres re-checks the row after the wait and skips
	// it, so we fall through and relink, as the original function did.
	var own []AccessRow
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("shift_id = ? AND nurse_id = ? AND status = 'linked' AND nurse_profile_id = ?", invite.ShiftID, invite.NurseID, profileID).
		Order("updated_at DESC").Limit(1).Find(&own).Error; err != nil {
		return "", false, err
	}
	if len(own) > 0 {
		return own[0].ID, false, nil
	}
	var reusable []AccessRow
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("shift_id = ? AND nurse_id = ? AND status IN ('pending_link', 'removed')", invite.ShiftID, invite.NurseID).
		Order("updated_at DESC").Limit(1).Find(&reusable).Error; err != nil {
		return "", false, err
	}
	// The email is cleared on purpose: the profile, not an address, identifies the nurse.
	if len(reusable) > 0 {
		relink := tx.Table("public.shift_nurse_access").Where("id = ?", reusable[0].ID).Updates(map[string]any{
			"nurse_name": target.nurseName, "nurse_profile_id": profileID, "nurse_email": nil,
			"status": "linked", "updated_at": gorm.Expr("now()"),
		})
		// The row is locked above, so exactly one row must change; never report
		// a join for a row the database did not relink.
		if relink.Error == nil && relink.RowsAffected != 1 {
			return "", false, errAccessNotRelinked
		}
		return reusable[0].ID, false, relink.Error
	}
	created := accessInsert{ShiftID: invite.ShiftID, NurseID: invite.NurseID, NurseName: target.nurseName, NurseProfileID: profileID, Status: "linked"}
	err = tx.Clauses(clause.Returning{Columns: []clause.Column{{Name: "id"}}}).Create(&created).Error
	return created.ID, false, err
}

// errAccessNotRelinked rolls the join back if the locked access row was not updated.
var errAccessNotRelinked = errors.New("nurse access row was not relinked")

// accessInsert lists exactly the access columns Go may insert. A separate type
// keeps GORM from adding created_at, which is not granted; updated_at takes its
// database default, now(). The id is read back through RETURNING.
type accessInsert struct {
	ID             string `gorm:"->"`
	ShiftID        string
	NurseID        string
	NurseName      string
	NurseProfileID string
	NurseEmail     *string // always NULL: the profile identifies the nurse
	Status         string
}

// TableName maps accessInsert to the existing shift_nurse_access table.
func (accessInsert) TableName() string { return "public.shift_nurse_access" }

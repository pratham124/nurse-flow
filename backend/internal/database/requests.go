package database

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrNotJoined indicates that the profile has no linked access to an open shift.
var ErrNotJoined = errors.New("profile has not joined an open shift")

// saveRequestChange stores a changed snapshot. Only the snapshot and revision are
// written; the retained triggers broadcast the change and queue notifications.
func saveRequestChange(tx *gorm.DB, shift *ActiveShift, snapshot json.RawMessage, at time.Time) error {
	return tx.Model(shift).Updates(map[string]any{"shift_snapshot": string(snapshot), "updated_at": at}).Error
}

// lockJoinedShift finds the profile's newest linked access and locks that
// unended shift. ErrNotJoined means no access; ErrShiftEnded means the shift
// ended after the access was found.
func lockJoinedShift(tx *gorm.DB, profileID string) (*AccessRow, ActiveShift, error) {
	access, err := newestLinkedAccess(tx, profileID)
	if err != nil {
		return nil, ActiveShift{}, err
	}
	if access == nil {
		return nil, ActiveShift{}, ErrNotJoined
	}
	var shift ActiveShift
	err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND ended_at IS NULL", access.ShiftID).Take(&shift).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ActiveShift{}, ErrShiftEnded
	}
	return access, shift, err
}

// OpenJoinedChat opens the joined nurse's chat with charge, creating it the
// first time. created tells the caller whether anything was written.
func (s *Store) OpenJoinedChat(ctx context.Context, authID, profileID string) (chat json.RawMessage, created bool, err error) {
	err = s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		access, shift, err := lockJoinedShift(tx, profileID)
		if err != nil {
			return err
		}
		chat, created, err = ensureChat(tx, &shift, shifts.NurseSlot{ID: access.NurseID, Name: access.NurseName})
		return err
	})
	if err != nil {
		return nil, false, err
	}
	return chat, created, nil
}

// OpenShiftNurseChat opens the charge nurse's chat with one nurse on an owned,
// unended shift, creating it the first time.
func (s *Store) OpenShiftNurseChat(ctx context.Context, authID, profileID, shiftID, nurseID string) (chat json.RawMessage, created bool, err error) {
	err = s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		shift, err := lockShift(tx, profileID, shiftID)
		if err != nil {
			return err
		}
		snapshot, err := shifts.Decode(shift.ShiftSnapshot)
		if err != nil {
			return err
		}
		slot, found, err := snapshot.FindNurseSlot(nurseID)
		if err != nil {
			return err
		}
		if !found {
			return ErrNurseNotOnShift
		}
		chat, created, err = ensureChat(tx, &shift, slot)
		return err
	})
	if err != nil {
		return nil, false, err
	}
	return chat, created, nil
}

// ensureChat finds or adds the nurse's chat on a shift that is already locked.
// The shift is written only when the chat is new.
func ensureChat(tx *gorm.DB, shift *ActiveShift, slot shifts.NurseSlot) (json.RawMessage, bool, error) {
	snapshot, err := shifts.Decode(shift.ShiftSnapshot)
	if err != nil {
		return nil, false, err
	}
	now := nextShiftTime(shift.UpdatedAt)
	change, created, err := snapshot.EnsureChat(slot, now)
	if err != nil {
		return nil, false, err
	}
	if !created {
		return change.Request, false, nil
	}
	if err := saveRequestChange(tx, shift, change.Snapshot, now); err != nil {
		return nil, false, err
	}
	return change.Request, true, nil
}

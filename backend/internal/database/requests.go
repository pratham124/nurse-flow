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

// SubmitIssueRequest appends a pending issue from the profile's linked nurse slot.
func (s *Store) SubmitIssueRequest(ctx context.Context, authID, profileID, message string) (json.RawMessage, error) {
	return s.submitJoinedRequest(ctx, authID, profileID, func(snapshot shifts.Snapshot, slot shifts.NurseSlot, _ []shifts.ActiveOverride, at time.Time) (shifts.RequestChange, error) {
		return snapshot.AddIssueRequest(slot, message, at)
	})
}

// SubmitSwapRequest appends a pending swap for a bed the linked nurse holds now.
func (s *Store) SubmitSwapRequest(ctx context.Context, authID, profileID, sourceBedID, message string) (json.RawMessage, error) {
	return s.submitJoinedRequest(ctx, authID, profileID, func(snapshot shifts.Snapshot, slot shifts.NurseSlot, overrides []shifts.ActiveOverride, at time.Time) (shifts.RequestChange, error) {
		return snapshot.AddSwapRequest(slot, sourceBedID, message, overrides, at)
	})
}

// submitJoinedRequest runs one joined-nurse submission. Exactly one request is
// appended, built by the pure shift rules from the freshly locked snapshot.
func (s *Store) submitJoinedRequest(ctx context.Context, authID, profileID string, build func(shifts.Snapshot, shifts.NurseSlot, []shifts.ActiveOverride, time.Time) (shifts.RequestChange, error)) (json.RawMessage, error) {
	var request json.RawMessage
	err := s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		access, shift, err := lockJoinedShift(tx, profileID)
		if err != nil {
			return err
		}
		snapshot, err := shifts.Decode(shift.ShiftSnapshot)
		if err != nil {
			return err
		}
		overrides, err := overridesOf(tx, &shift)
		if err != nil {
			return err
		}
		now := nextShiftTime(shift.UpdatedAt)
		change, err := build(snapshot, shifts.NurseSlot{ID: access.NurseID, Name: access.NurseName}, overrides, now)
		if err != nil {
			return err
		}
		request = change.Request
		return saveRequestChange(tx, &shift, change.Snapshot, now)
	})
	if err != nil {
		return nil, err
	}
	return request, nil
}

// UpdateIssueStatus sets an issue's review status on an owned, unended shift.
// Asking for the current status succeeds without writing anything.
func (s *Store) UpdateIssueStatus(ctx context.Context, authID, profileID, shiftID, requestID, status string) (json.RawMessage, error) {
	return s.reviewRequest(ctx, authID, profileID, shiftID, func(snapshot shifts.Snapshot, at time.Time) (shifts.RequestChange, error) {
		return snapshot.SetIssueStatus(requestID, status, profileID, at)
	})
}

// ResolveSwapRequest accepts or declines a pending swap on an owned, unended shift.
func (s *Store) ResolveSwapRequest(ctx context.Context, authID, profileID, shiftID, requestID, status string) (json.RawMessage, error) {
	return s.reviewRequest(ctx, authID, profileID, shiftID, func(snapshot shifts.Snapshot, at time.Time) (shifts.RequestChange, error) {
		return snapshot.ResolveSwap(requestID, status, at)
	})
}

// reviewRequest locks the charge nurse's shift, applies one change, and saves it.
// A change without a snapshot is a no-op and is not written.
func (s *Store) reviewRequest(ctx context.Context, authID, profileID, shiftID string, apply func(shifts.Snapshot, time.Time) (shifts.RequestChange, error)) (json.RawMessage, error) {
	var request json.RawMessage
	err := s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		shift, err := lockShift(tx, profileID, shiftID)
		if err != nil {
			return err
		}
		snapshot, err := shifts.Decode(shift.ShiftSnapshot)
		if err != nil {
			return err
		}
		now := nextShiftTime(shift.UpdatedAt)
		change, err := apply(snapshot, now)
		if err != nil {
			return err
		}
		request = change.Request
		if change.Snapshot == nil {
			return nil
		}
		return saveRequestChange(tx, &shift, change.Snapshot, now)
	})
	if err != nil {
		return nil, err
	}
	return request, nil
}

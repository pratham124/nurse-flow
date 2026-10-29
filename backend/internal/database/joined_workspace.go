package database

import (
	"context"
	"encoding/json"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/shifts"
	"gorm.io/gorm"
)

// JoinedAccess is the nurse access record in the camelCase shape the app expects.
type JoinedAccess struct {
	ID             string    `json:"id"`
	ShiftID        string    `json:"shiftId"`
	NurseID        string    `json:"nurseId"`
	NurseName      string    `json:"nurseName"`
	NurseProfileID *string   `json:"nurseProfileId"`
	NurseEmail     *string   `json:"nurseEmail"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// JoinedAssignment is a joined nurse's own slice of someone else's shift.
type JoinedAssignment struct {
	Access         JoinedAccess         `json:"access"`
	ShiftID        string               `json:"shiftId"`
	FloorName      string               `json:"floorName"`
	NurseName      string               `json:"nurseName"`
	AssignedBeds   []shifts.AssignedBed `json:"assignedBeds"`
	RequestHistory []json.RawMessage    `json:"requestHistory"`
}

// JoinedWorkspace returns the profile's newest linked access on an open shift,
// with only that nurse's beds and requests, or nil when the profile has none.
// One repeatable-read transaction keeps the access, shift, and moves consistent.
func (s *Store) JoinedWorkspace(ctx context.Context, authID, profileID string) (*JoinedAssignment, error) {
	var assignment *JoinedAssignment
	err := s.WithIdentity(ctx, authID, func(tx *gorm.DB) error {
		found, err := newestLinkedAccess(tx, profileID)
		if err != nil || found == nil {
			return err
		}
		access := *found
		var shift ActiveShift
		if err := tx.Where("id = ?", access.ShiftID).Take(&shift).Error; err != nil {
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
		view, err := snapshot.JoinedView(access.NurseID, overrides)
		if err != nil {
			return err
		}
		assignment = &JoinedAssignment{
			Access: JoinedAccess{
				ID: access.ID, ShiftID: access.ShiftID, NurseID: access.NurseID, NurseName: access.NurseName,
				NurseProfileID: access.NurseProfileID, NurseEmail: access.NurseEmail, Status: access.Status,
				CreatedAt: access.CreatedAt, UpdatedAt: access.UpdatedAt,
			},
			ShiftID:        access.ShiftID,
			FloorName:      view.FloorName,
			NurseName:      access.NurseName,
			AssignedBeds:   view.AssignedBeds,
			RequestHistory: view.RequestHistory,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return assignment, nil
}

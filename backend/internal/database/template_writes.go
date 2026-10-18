package database

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/templates"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrTemplateNotFound = errors.New("floor template not found")

// SaveFloorTemplate uses an empty ID only for creation. Updates never upsert a
// missing/foreign row. Ownership comes from the authorized profile, not JSON.
// Auth/profile IDs must be verified and a nonempty template ID validated by the caller.
func (s *Store) SaveFloorTemplate(ctx context.Context, authID, profileID, id string, snapshot templates.Snapshot) (FloorTemplate, error) {
	if err := snapshot.Validate(); err != nil {
		return FloorTemplate{}, err
	}
	snapshot.Name = strings.TrimSpace(snapshot.Name)
	var saved FloorTemplate
	err := s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		if id == "" {
			// INSERT uses database defaults for the ID/created_at. The temporary
			// snapshot ID is never visible outside this uncommitted transaction.
			raw, err := json.Marshal(snapshot)
			if err != nil {
				return err
			}
			insert := floorTemplateInsert{
				OwnerProfileID:   profileID,
				Name:             snapshot.Name,
				TemplateSnapshot: raw,
			}
			if err := tx.Table("public.floor_templates").Clauses(clause.Returning{Columns: []clause.Column{{Name: "id"}}}).Create(&insert).Error; err != nil {
				return err
			}
			id = insert.ID
		}
		snapshot.ID = strings.ToLower(id)
		raw, err := json.Marshal(snapshot)
		if err != nil {
			return err
		}
		// Map updates include exactly the mutable columns. The timestamps are
		// server-generated; created_at and owner cannot be replaced by a caller.
		result := tx.Table("public.floor_templates").Where("id = ? AND owner_profile_id = ?", id, profileID).
			Updates(map[string]any{"name": snapshot.Name, "template_snapshot": string(raw), "updated_at": time.Now().UTC()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrTemplateNotFound
		}
		return tx.Where("id = ? AND owner_profile_id = ?", id, profileID).Take(&saved).Error
	})
	if err != nil {
		return FloorTemplate{}, err
	}
	return saved, nil
}

// DeleteFloorTemplate requires verified Auth/profile IDs and a validated template ID.
func (s *Store) DeleteFloorTemplate(ctx context.Context, authID, profileID, id string) error {
	return s.WithWriteIdentity(ctx, authID, func(tx *gorm.DB) error {
		result := tx.Where("id = ? AND owner_profile_id = ?", id, profileID).Delete(&FloorTemplate{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrTemplateNotFound
		}
		return nil
	})
}

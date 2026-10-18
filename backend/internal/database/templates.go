package database

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

// FloorTemplatesByProfile receives only server-verified identity and profile IDs.
// The owner filter and transaction-local RLS identity both restrict this read.
func (s *Store) FloorTemplatesByProfile(ctx context.Context, authUserID, profileID string) ([]FloorTemplate, error) {
	if !uuidPattern.MatchString(profileID) {
		return nil, errors.New("template owner must be a profile UUID")
	}
	templates := make([]FloorTemplate, 0)
	err := s.WithIdentity(ctx, authUserID, func(tx *gorm.DB) error {
		return tx.Where("owner_profile_id = ?", profileID).
			Order("updated_at DESC").Find(&templates).Error
	})
	if err != nil {
		return nil, err
	}
	return templates, nil
}

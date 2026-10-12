package database

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"
)

var ErrProfileNotFound = errors.New("application profile not found")

// ProfileByAuthUserID resolves a server-verified Auth subject to its application profile.
func (s *Store) ProfileByAuthUserID(ctx context.Context, authUserID string) (Profile, error) {
	var profile Profile
	err := s.WithIdentity(ctx, authUserID, func(tx *gorm.DB) error {
		return tx.Where("auth_user_id = ?", strings.ToLower(authUserID)).Take(&profile).Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Profile{}, ErrProfileNotFound
	}
	if err != nil {
		return Profile{}, err
	}
	return profile, nil
}

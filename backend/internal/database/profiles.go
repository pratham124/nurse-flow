package database

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrProfileNotFound indicates that the verified Auth user has no application profile.
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

// EnsureProfile loads the caller's profile, creating a charge-nurse profile on
// first sign-in. Both steps share one write transaction, so two simultaneous
// first requests leave one row and both succeed: the unique auth_user_id makes
// the second insert wait, then do nothing, and the select sees the committed row.
// An existing profile is never changed.
func (s *Store) EnsureProfile(ctx context.Context, authUserID, displayName string) (Profile, error) {
	authUserID = strings.ToLower(authUserID)
	var profile Profile
	err := s.WithWriteIdentity(ctx, authUserID, func(tx *gorm.DB) error {
		// ON CONFLICT DO NOTHING keeps concurrent first sign-ins from failing.
		created := profileInsert{AuthUserID: authUserID, DisplayName: displayName, Role: "charge_nurse"}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "auth_user_id"}},
			DoNothing: true,
		}).Create(&created).Error; err != nil {
			return err
		}
		return tx.Where("auth_user_id = ?", authUserID).Take(&profile).Error
	})
	if err != nil {
		return Profile{}, err
	}
	return profile, nil
}

// profileInsert lists exactly the profile columns Go may insert. A separate type
// keeps GORM from adding id, created_at, and updated_at, which take their
// database defaults; created_at and updated_at are not granted.
type profileInsert struct {
	AuthUserID  string
	DisplayName string
	Role        string
}

// TableName maps profileInsert to the existing profiles table.
func (profileInsert) TableName() string { return "public.profiles" }

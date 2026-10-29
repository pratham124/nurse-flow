package database

import (
	"encoding/json"
	"time"
)

// Profile maps an application profile. Go only reads it; new rows come from EnsureProfile.
type Profile struct {
	ID          string    `gorm:"column:id;type:uuid;primaryKey;->" json:"id"`
	AuthUserID  string    `gorm:"column:auth_user_id;type:uuid;->" json:"auth_user_id"`
	DisplayName string    `gorm:"column:display_name;->" json:"display_name"`
	Role        string    `gorm:"column:role;->" json:"role"`
	CreatedAt   time.Time `gorm:"column:created_at;->" json:"created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at;->" json:"updated_at"`
}

// TableName maps Profile to the existing profiles table.
func (Profile) TableName() string { return "public.profiles" }

// FloorTemplate is a read-only mapping of a saved reusable layout.
type FloorTemplate struct {
	ID               string          `gorm:"column:id;type:uuid;primaryKey;->" json:"id"`
	OwnerProfileID   string          `gorm:"column:owner_profile_id;type:uuid;->" json:"owner_profile_id"`
	Name             string          `gorm:"column:name;->" json:"name"`
	TemplateSnapshot json.RawMessage `gorm:"column:template_snapshot;type:jsonb;->" json:"template_snapshot"`
	CreatedAt        time.Time       `gorm:"column:created_at;->" json:"created_at"`
	UpdatedAt        time.Time       `gorm:"column:updated_at;->" json:"updated_at"`
}

// TableName maps FloorTemplate to the existing floor_templates table.
func (FloorTemplate) TableName() string { return "public.floor_templates" }

type floorTemplateInsert struct {
	ID               string `gorm:"type:uuid;default:gen_random_uuid()"`
	OwnerProfileID   string `gorm:"type:uuid"`
	Name             string
	TemplateSnapshot json.RawMessage `gorm:"type:jsonb"`
}

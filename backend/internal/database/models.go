package database

import (
	"encoding/json"
	"time"
)

// These read-only mappings describe existing tables; they do not create them.
type Profile struct {
	ID          string    `gorm:"column:id;type:uuid;primaryKey;->"`
	AuthUserID  string    `gorm:"column:auth_user_id;type:uuid;->"`
	DisplayName string    `gorm:"column:display_name;->"`
	Role        string    `gorm:"column:role;->"`
	CreatedAt   time.Time `gorm:"column:created_at;->"`
	UpdatedAt   time.Time `gorm:"column:updated_at;->"`
}

func (Profile) TableName() string { return "public.profiles" }

type FloorTemplate struct {
	ID               string          `gorm:"column:id;type:uuid;primaryKey;->"`
	OwnerProfileID   string          `gorm:"column:owner_profile_id;type:uuid;->"`
	Name             string          `gorm:"column:name;->"`
	TemplateSnapshot json.RawMessage `gorm:"column:template_snapshot;type:jsonb;->"`
	CreatedAt        time.Time       `gorm:"column:created_at;->"`
	UpdatedAt        time.Time       `gorm:"column:updated_at;->"`
}

func (FloorTemplate) TableName() string { return "public.floor_templates" }

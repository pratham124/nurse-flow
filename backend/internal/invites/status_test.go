package invites

import (
	"testing"
	"time"
)

func TestUnusableReason(t *testing.T) {
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	future, past := now.Add(time.Hour), now.Add(-time.Hour)
	for _, tt := range []struct {
		name, status string
		expiresAt    time.Time
		want         string
	}{
		{"active and fresh", "active", future, ""},
		{"revoked wins over expired time", "revoked", past, ReasonRevoked},
		{"used wins over expired time", "used", past, ReasonAlreadyUsed},
		{"expired status", "expired", future, ReasonExpired},
		{"active but past expiry", "active", past, ReasonExpired},
		{"expiry exactly now is expired", "active", now, ReasonExpired},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := UnusableReason(tt.status, tt.expiresAt, now); got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}

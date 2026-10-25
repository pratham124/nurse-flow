package auth

import (
	"context"
	"testing"
)

func TestProfileName(t *testing.T) {
	for _, tt := range []struct {
		name     string
		identity Identity
		want     string
	}{
		{"metadata name first", Identity{DisplayName: "  Pat Nurse ", Email: "pat@example.com"}, "Pat Nurse"},
		{"email when no name", Identity{Email: " pat@example.com "}, "pat@example.com"},
		{"blank name falls back to email", Identity{DisplayName: "   ", Email: "pat@example.com"}, "pat@example.com"},
		{"default when nothing is known", Identity{}, "NurseFlow user"},
		{"blank email falls back to default", Identity{Email: "  "}, "NurseFlow user"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.identity.ProfileName(); got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestVerifyExposesEmailAndDisplayName(t *testing.T) {
	key := testPrivateKey(t)
	verifier, _ := testVerifier(t, key)
	for _, tt := range []struct {
		name                string
		email, userMetadata any
		wantEmail, wantName string
	}{
		{"both present", "pat@example.com", map[string]any{"display_name": "Pat Nurse"}, "pat@example.com", "Pat Nurse"},
		{"neither present", nil, nil, "", ""},
		// Odd claim shapes must not make a valid token unusable.
		{"metadata is not an object", "pat@example.com", "text", "pat@example.com", ""},
		{"display name is not text", 42, map[string]any{"display_name": 7}, "", ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			claims := fixtureClaims()
			claims.Email, claims.UserMetadata = tt.email, tt.userMetadata
			identity, err := verifier.Verify(context.Background(), signedToken(t, key, "first", claims))
			if err != nil {
				t.Fatal(err)
			}
			if identity.AuthUserID != fixtureUserID || identity.Email != tt.wantEmail || identity.DisplayName != tt.wantName {
				t.Fatalf("identity = %+v", identity)
			}
		})
	}
}

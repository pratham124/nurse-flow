// Package auth verifies Supabase access tokens before their identity is trusted.
package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/MicahParks/jwkset"
	"github.com/golang-jwt/jwt/v5"
	"github.com/pratham124/nurse-flow/backend/internal/identifiers"
)

// DevelopmentIssuer is the trusted token issuer for the isolated development project.
const DevelopmentIssuer = "https://nmitctyxtjmlakcsmnuj.supabase.co/auth/v1"

var (
	// ErrUnauthenticated indicates a missing or invalid access token.
	ErrUnauthenticated = errors.New("access token is missing or invalid")
	// ErrUnavailable indicates that trusted signing keys are temporarily unavailable.
	ErrUnavailable = errors.New("token verification is temporarily unavailable")
)

// clockSkewLeeway tolerates small clock differences when checking iat, nbf, and exp.
const clockSkewLeeway = 30 * time.Second

// Identity contains the verified Auth subject and the two read-only claims used
// to name a new profile. It is not a NurseFlow profile or role.
type Identity struct {
	AuthUserID  string
	Email       string
	DisplayName string // user_metadata.display_name; chosen by the user, never used for authorization
}

type accessClaims struct {
	jwt.RegisteredClaims
	Role string `json:"role"`
	// Read leniently (any JSON type) so an unusual value cannot reject a valid token.
	Email        any `json:"email,omitempty"`
	UserMetadata any `json:"user_metadata,omitempty"`
}

// Verifier uses library-managed public keys and validates our access-token rules.
type Verifier struct {
	issuer string
	now    func() time.Time
	keys   jwkset.Storage
}

// NewDevelopment starts a verifier restricted to the development project's issuer.
func NewDevelopment(ctx context.Context) (*Verifier, error) {
	return newVerifier(ctx, DevelopmentIssuer+"/.well-known/jwks.json", 5*time.Minute, 30*time.Second)
}

// Verify checks the token signature and required claims before returning its identity.
func (v *Verifier) Verify(ctx context.Context, rawToken string) (Identity, error) {
	if rawToken == "" || len(rawToken) > 8192 {
		return Identity{}, ErrUnauthenticated
	}
	var claims accessClaims
	token, err := jwt.ParseWithClaims(rawToken, &claims, func(token *jwt.Token) (any, error) {
		keyID, ok := token.Header["kid"].(string)
		if !ok || keyID == "" {
			return nil, ErrUnauthenticated
		}
		return v.publicKey(ctx, keyID)
	}, jwt.WithValidMethods([]string{"ES256"}),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience("authenticated"),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		// Supabase's clock can run a few seconds ahead of this host, which made a
		// token used right after signup look issued in the future.
		jwt.WithLeeway(clockSkewLeeway),
		jwt.WithTimeFunc(v.now),
	)
	if err != nil {
		if errors.Is(err, ErrUnavailable) {
			return Identity{}, ErrUnavailable
		}
		return Identity{}, ErrUnauthenticated
	}
	if !token.Valid || claims.Role != "authenticated" || !identifiers.ValidUUID(claims.Subject) {
		return Identity{}, ErrUnauthenticated
	}
	return claims.identity(), nil
}

func (c accessClaims) identity() Identity {
	identity := Identity{AuthUserID: strings.ToLower(c.Subject)}
	identity.Email, _ = c.Email.(string)
	if metadata, ok := c.UserMetadata.(map[string]any); ok {
		identity.DisplayName, _ = metadata["display_name"].(string)
	}
	return identity
}

// ProfileName chooses the display name for a new profile: the user's chosen name,
// else their email, else a generic label.
func (i Identity) ProfileName() string {
	if name := strings.TrimSpace(i.DisplayName); name != "" {
		return name
	}
	if email := strings.TrimSpace(i.Email); email != "" {
		return email
	}
	return "NurseFlow user"
}

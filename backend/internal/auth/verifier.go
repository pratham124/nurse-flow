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

// Identity contains only the verified Auth subject, not a NurseFlow profile or role.
type Identity struct {
	AuthUserID string
}

type accessClaims struct {
	jwt.RegisteredClaims
	Role string `json:"role"`
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
		if !ok || keyID == "" || len(keyID) > 256 {
			return nil, ErrUnauthenticated
		}
		return v.publicKey(ctx, keyID)
	}, jwt.WithValidMethods([]string{"ES256"}),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience("authenticated"),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
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
	return Identity{AuthUserID: strings.ToLower(claims.Subject)}, nil
}

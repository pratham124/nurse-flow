package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const fixtureUserID = "4ea34fc9-d17b-411e-83a0-8a82cf9b8977"

var fixtureTime = time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)

// Raw JSON fixtures let tests supply malformed keys independently of the decoder.
type publicJWK struct {
	KeyID     string `json:"kid"`
	KeyType   string `json:"kty"`
	Algorithm string `json:"alg"`
	Use       string `json:"use"`
	Curve     string `json:"crv"`
	X         string `json:"x"`
	Y         string `json:"y"`
}

func testPrivateKey(t *testing.T) *ecdsa.PrivateKey {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func fixtureClaims() accessClaims {
	return accessClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer: DevelopmentIssuer, Subject: fixtureUserID,
			Audience:  jwt.ClaimStrings{"authenticated"},
			ExpiresAt: jwt.NewNumericDate(fixtureTime.Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(fixtureTime.Add(-time.Minute)),
		},
		Role: "authenticated",
	}
}

func signedToken(t *testing.T, key *ecdsa.PrivateKey, keyID string, claims accessClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	if keyID != "" {
		token.Header["kid"] = keyID
	}
	value, err := token.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return value
}

func jwkFor(key *ecdsa.PrivateKey, id string) publicJWK {
	coordinateBytes := (key.Curve.Params().BitSize + 7) / 8
	return publicJWK{
		KeyID: id, KeyType: "EC", Algorithm: "ES256", Use: "sig", Curve: "P-256",
		X: base64.RawURLEncoding.EncodeToString(key.X.FillBytes(make([]byte, coordinateBytes))),
		Y: base64.RawURLEncoding.EncodeToString(key.Y.FillBytes(make([]byte, coordinateBytes))),
	}
}

func TestRejectInvalidPublicKeys(t *testing.T) {
	key := testPrivateKey(t)
	token := signedToken(t, key, "first", fixtureClaims())
	for name, change := range map[string]func(*publicJWK){
		"missing coordinate": func(k *publicJWK) { k.X = "" },
		"point outside curve": func(k *publicJWK) {
			k.X = base64.RawURLEncoding.EncodeToString(make([]byte, 32))
			k.Y = k.X
		},
		"wrong use":      func(k *publicJWK) { k.Use = "enc" },
		"missing key ID": func(k *publicJWK) { k.KeyID = "" },
	} {
		t.Run(name, func(t *testing.T) {
			invalid := jwkFor(key, "first")
			change(&invalid)
			verifier, _ := testVerifierWithSetup(t, key, func(s *keyServer) { s.setKeys(t, invalid) }, time.Hour)
			if _, err := verifier.Verify(context.Background(), token); !errors.Is(err, ErrUnavailable) {
				t.Fatalf("error = %v, want unavailable", err)
			}
		})
	}
	t.Run("duplicate key ID", func(t *testing.T) {
		verifier, _ := testVerifierWithSetup(t, key, func(s *keyServer) {
			s.setKeys(t, jwkFor(key, "first"), jwkFor(key, "first"))
		}, time.Hour)
		if _, err := verifier.Verify(context.Background(), token); !errors.Is(err, ErrUnavailable) {
			t.Fatalf("error = %v, want unavailable", err)
		}
	})
	otherCurve, err := ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	other := jwkFor(otherCurve, "other")
	other.Curve = "P-384"
	t.Run("wrong curve for ES256", func(t *testing.T) {
		verifier, _ := testVerifierWithSetup(t, key, func(s *keyServer) { s.setKeys(t, other) }, time.Hour)
		if _, err := verifier.Verify(context.Background(), token); !errors.Is(err, ErrUnavailable) {
			t.Fatalf("error = %v, want unavailable", err)
		}
	})
	t.Run("other algorithms coexist", func(t *testing.T) {
		other.Algorithm = "ES384"
		verifier, _ := testVerifierWithSetup(t, key, func(s *keyServer) {
			s.setKeys(t, jwkFor(key, "first"), other)
		}, time.Hour)
		if _, err := verifier.Verify(context.Background(), token); err != nil {
			t.Fatal(err)
		}
	})
}

type keyServer struct {
	body   atomic.Value
	status atomic.Int32
	hits   atomic.Int32
	delay  atomic.Int64
}

func (s *keyServer) setKeys(t *testing.T, keys ...publicJWK) {
	t.Helper()
	body, err := json.Marshal(struct {
		Keys []publicJWK `json:"keys"`
	}{Keys: keys})
	if err != nil {
		t.Fatal(err)
	}
	s.body.Store(string(body))
}

func testVerifier(t *testing.T, key *ecdsa.PrivateKey) (*Verifier, *keyServer) {
	return testVerifierWithSetup(t, key, nil, time.Hour)
}

func testVerifierWithSetup(t *testing.T, key *ecdsa.PrivateKey, setup func(*keyServer), refreshInterval time.Duration, refreshPauses ...time.Duration) (*Verifier, *keyServer) {
	t.Helper()
	state := &keyServer{}
	state.status.Store(http.StatusOK)
	state.setKeys(t, jwkFor(key, "first"))
	if setup != nil {
		setup(state)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		state.hits.Add(1)
		if delay := time.Duration(state.delay.Load()); delay > 0 {
			time.Sleep(delay)
		}
		w.WriteHeader(int(state.status.Load()))
		_, _ = w.Write([]byte(state.body.Load().(string)))
	}))
	t.Cleanup(server.Close)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	refreshPause := 30 * time.Second
	if len(refreshPauses) > 0 {
		refreshPause = refreshPauses[0]
	}
	verifier, err := newVerifier(ctx, server.URL, refreshInterval, refreshPause)
	if err != nil {
		t.Fatal(err)
	}
	verifier.now = func() time.Time { return fixtureTime }
	return verifier, state
}

func TestVerifyToken(t *testing.T) {
	key := testPrivateKey(t)
	verifier, _ := testVerifier(t, key)
	claims := fixtureClaims()
	claims.Subject = strings.ToUpper(fixtureUserID)
	identity, err := verifier.Verify(context.Background(), signedToken(t, key, "first", claims))
	if err != nil || identity.AuthUserID != fixtureUserID {
		t.Fatalf("identity = %v, error = %v", identity, err)
	}
}

func TestRejectToken(t *testing.T) {
	key := testPrivateKey(t)
	verifier, _ := testVerifier(t, key)
	tests := []struct {
		name   string
		change func(*accessClaims)
	}{
		{"expired", func(c *accessClaims) { c.ExpiresAt = jwt.NewNumericDate(fixtureTime.Add(-time.Second)) }},
		{"missing expiration", func(c *accessClaims) { c.ExpiresAt = nil }},
		{"wrong issuer", func(c *accessClaims) { c.Issuer = "https://another-project.supabase.co/auth/v1" }},
		{"missing issuer", func(c *accessClaims) { c.Issuer = "" }},
		{"wrong audience", func(c *accessClaims) { c.Audience = jwt.ClaimStrings{"another-api"} }},
		{"missing audience", func(c *accessClaims) { c.Audience = nil }},
		{"not yet valid", func(c *accessClaims) { c.NotBefore = jwt.NewNumericDate(fixtureTime.Add(time.Minute)) }},
		{"future issued at", func(c *accessClaims) { c.IssuedAt = jwt.NewNumericDate(fixtureTime.Add(time.Minute)) }},
		{"missing subject", func(c *accessClaims) { c.Subject = "" }},
		{"invalid subject", func(c *accessClaims) { c.Subject = "not-a-user-id" }},
		{"anonymous API key", func(c *accessClaims) { c.Role = "anon" }},
		{"service role", func(c *accessClaims) { c.Role = "service_role" }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			claims := fixtureClaims()
			test.change(&claims)
			_, err := verifier.Verify(context.Background(), signedToken(t, key, "first", claims))
			if !errors.Is(err, ErrUnauthenticated) {
				t.Fatalf("error = %v, want unauthenticated", err)
			}
		})
	}
	badTokens := map[string]string{
		"missing": "", "malformed": "not-a-jwt", "oversized": strings.Repeat("x", 8193),
		"wrong signature": signedToken(t, testPrivateKey(t), "first", fixtureClaims()),
		"missing key ID":  signedToken(t, key, "", fixtureClaims()),
		"unknown key ID":  signedToken(t, key, "unknown", fixtureClaims()),
	}
	for _, method := range []jwt.SigningMethod{jwt.SigningMethodHS256, jwt.SigningMethodNone} {
		token := jwt.NewWithClaims(method, fixtureClaims())
		token.Header["kid"] = "first"
		var signingKey any = []byte("synthetic-test-secret")
		if method == jwt.SigningMethodNone {
			signingKey = jwt.UnsafeAllowNoneSignatureType
		}
		value, err := token.SignedString(signingKey)
		if err != nil {
			t.Fatal(err)
		}
		badTokens[method.Alg()] = value
	}
	for name, rawToken := range badTokens {
		t.Run(name, func(t *testing.T) {
			if _, err := verifier.Verify(context.Background(), rawToken); !errors.Is(err, ErrUnauthenticated) {
				t.Fatalf("error = %v, want unauthenticated", err)
			}
		})
	}
}

func waitForVerification(t *testing.T, verifier *Verifier, token string, want error) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for {
		_, err := verifier.Verify(context.Background(), token)
		if errors.Is(err, want) {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("error = %v, want %v", err, want)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestKeyRefreshAndRevocation(t *testing.T) {
	first, second := testPrivateKey(t), testPrivateKey(t)
	verifier, state := testVerifierWithSetup(t, first, nil, 20*time.Millisecond)
	firstToken := signedToken(t, first, "first", fixtureClaims())
	secondToken := signedToken(t, second, "second", fixtureClaims())
	if _, err := verifier.Verify(context.Background(), firstToken); err != nil {
		t.Fatal(err)
	}
	state.setKeys(t, jwkFor(first, "first"), jwkFor(second, "second"))
	waitForVerification(t, verifier, secondToken, nil)
	state.setKeys(t, jwkFor(second, "second"))
	waitForVerification(t, verifier, firstToken, ErrUnauthenticated)
	if _, err := verifier.Verify(context.Background(), secondToken); err != nil {
		t.Fatal(err)
	}
}

func TestUnknownKeysDoNotCauseRepeatedFetches(t *testing.T) {
	key := testPrivateKey(t)
	verifier, state := testVerifier(t, key)
	token := signedToken(t, key, "unknown", fixtureClaims())
	for range 10 {
		if _, err := verifier.Verify(context.Background(), token); !errors.Is(err, ErrUnauthenticated) {
			t.Fatalf("error = %v, want unauthenticated", err)
		}
	}
	if state.hits.Load() != 1 {
		t.Fatal("unknown key IDs caused repeated fetches")
	}
}

func TestUnknownKeyRefreshDiscoversRotatedKey(t *testing.T) {
	first, second := testPrivateKey(t), testPrivateKey(t)
	verifier, state := testVerifierWithSetup(t, first, nil, time.Hour, 10*time.Millisecond)
	state.setKeys(t, jwkFor(first, "first"), jwkFor(second, "second"))
	state.delay.Store(int64(20 * time.Millisecond))
	waitForVerification(t, verifier, signedToken(t, second, "second", fixtureClaims()), nil)
	if state.hits.Load() != 2 {
		t.Fatalf("key requests = %d, want initial fetch and one refresh", state.hits.Load())
	}
}

func TestRefreshStopsWithContext(t *testing.T) {
	key := testPrivateKey(t)
	state := &keyServer{}
	state.setKeys(t, jwkFor(key, "first"))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		state.hits.Add(1)
		_, _ = w.Write([]byte(state.body.Load().(string)))
	}))
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if _, err := newVerifier(ctx, server.URL, 20*time.Millisecond, 30*time.Second); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(3 * time.Second)
	for state.hits.Load() < 2 {
		if time.Now().After(deadline) {
			t.Fatal("background refresh did not run")
		}
		time.Sleep(5 * time.Millisecond)
	}
	cancel()
	time.Sleep(40 * time.Millisecond) // Allow an in-flight request to finish.
	hits := state.hits.Load()
	time.Sleep(60 * time.Millisecond)
	if state.hits.Load() != hits {
		t.Fatal("background refresh continued after cancellation")
	}
}
func TestConcurrentVerificationSharesKeyFetch(t *testing.T) {
	key := testPrivateKey(t)
	verifier, state := testVerifier(t, key)
	token := signedToken(t, key, "first", fixtureClaims())
	var workers sync.WaitGroup
	errorsFound := make(chan error, 10)
	for range 10 {
		workers.Add(1)
		go func() {
			defer workers.Done()
			_, err := verifier.Verify(context.Background(), token)
			errorsFound <- err
		}()
	}
	workers.Wait()
	close(errorsFound)
	for err := range errorsFound {
		if err != nil {
			t.Fatal(err)
		}
	}
	if state.hits.Load() != 1 {
		t.Fatal("concurrent requests did not share the cached key fetch")
	}
}

func TestKeySourceFailures(t *testing.T) {
	key := testPrivateKey(t)
	token := signedToken(t, key, "first", fixtureClaims())
	for _, body := range []string{"not JSON", strings.Repeat("x", 65537),
		`{"keys":[{"kid":"first","alg":"ES256","kty":"EC","crv":"P-256","x":"bad","y":"bad"}]}`} {
		verifier, _ := testVerifierWithSetup(t, key, func(s *keyServer) { s.body.Store(body) }, time.Hour)
		if _, err := verifier.Verify(context.Background(), token); !errors.Is(err, ErrUnavailable) {
			t.Fatalf("malformed key source: error = %v", err)
		}
	}
	verifier, state := testVerifierWithSetup(t, key, nil, 20*time.Millisecond)
	if _, err := verifier.Verify(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	state.status.Store(http.StatusServiceUnavailable)
	waitForVerification(t, verifier, token, ErrUnavailable)
	state.status.Store(http.StatusOK)
	waitForVerification(t, verifier, token, nil)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := verifier.Verify(ctx, token); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("cancelled request: %v", err)
	}
}

func TestRedirectIsNotFollowed(t *testing.T) {
	key := testPrivateKey(t)
	var hits atomic.Int32
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits.Add(1) }))
	defer destination.Close()
	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, destination.URL, http.StatusFound)
	}))
	defer redirect.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	verifier, err := newVerifier(ctx, redirect.URL, time.Hour, 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := verifier.Verify(context.Background(), signedToken(t, key, "first", fixtureClaims())); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("redirect returned %v", err)
	}
	if hits.Load() != 0 {
		t.Fatal("followed redirect to another key source")
	}
}

func TestCertificateURLIsNotFetched(t *testing.T) {
	key := testPrivateKey(t)
	var hits atomic.Int32
	destination := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits.Add(1) }))
	defer destination.Close()
	verifier, _ := testVerifierWithSetup(t, key, func(s *keyServer) {
		var document map[string]any
		if err := json.Unmarshal([]byte(s.body.Load().(string)), &document); err != nil {
			t.Fatal(err)
		}
		document["keys"].([]any)[0].(map[string]any)["x5u"] = destination.URL
		body, err := json.Marshal(document)
		if err != nil {
			t.Fatal(err)
		}
		s.body.Store(string(body))
	}, time.Hour)
	if _, err := verifier.Verify(context.Background(), signedToken(t, key, "first", fixtureClaims())); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("certificate URL: %v", err)
	}
	if hits.Load() != 0 {
		t.Fatal("fetched an additional key source")
	}
}

func TestDevelopmentPublicKeys(t *testing.T) {
	if testing.Short() || os.Getenv("NURSEFLOW_AUTH_LIVE_CHECK") != "1" {
		t.Skip("set NURSEFLOW_AUTH_LIVE_CHECK=1 for the public development discovery check")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	verifier, err := NewDevelopment(ctx)
	if err != nil {
		t.Fatal(err)
	}
	keys, err := verifier.keys.KeyReadAll(ctx)
	if err != nil || len(keys) == 0 {
		t.Fatalf("development public-key discovery failed: %v", err)
	}
}

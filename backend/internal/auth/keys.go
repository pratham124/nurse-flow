package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/x509"
	"net/http"
	"net/url"
	"time"

	"github.com/MicahParks/jwkset"
	"golang.org/x/time/rate"
)

func newVerifier(ctx context.Context, endpoint string, refreshInterval, refreshPause time.Duration) (*Verifier, error) {
	store := &signingKeyStore{Storage: jwkset.NewMemoryStorage()}
	remote, err := jwkset.NewStorageFromHTTP(endpoint, jwkset.HTTPClientStorageOptions{
		Ctx: ctx,
		Client: &http.Client{
			Timeout:   5 * time.Second,
			Transport: boundedKeyTransport{},
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		HTTPTimeout:               5 * time.Second,
		RefreshInterval:           refreshInterval,
		Storage:                   store,
		NoErrorReturnFirstHTTPReq: true, // The public health route can run during an Auth outage.
		RefreshErrorHandler: func(ctx context.Context, err error) {
			// Stop trusting cached keys after a failed refresh; the next refresh can recover.
			_ = store.KeyReplaceAll(ctx, nil)
		},
		ValidateOptions: jwkset.JWKValidateOptions{
			GetX5U: func(*url.URL) ([]*x509.Certificate, error) {
				return nil, ErrUnavailable // Keys cannot introduce another network source.
			},
		},
	})
	if err != nil {
		return nil, ErrUnavailable
	}
	limiter := rate.NewLimiter(rate.Every(refreshPause), 1)
	limiter.Allow() // The initial fetch counts toward the refresh limit.
	keys, err := jwkset.NewHTTPClient(jwkset.HTTPClientOptions{
		HTTPURLs:          map[string]jwkset.Storage{endpoint: remote},
		RefreshUnknownKID: limiter,
		RateLimitWaitMax:  5 * time.Second, // Also bounds an unknown-key refresh request.
	})
	if err != nil {
		return nil, ErrUnavailable
	}
	return &Verifier{issuer: DevelopmentIssuer, now: time.Now, keys: keys}, nil
}

func (v *Verifier) publicKey(ctx context.Context, keyID string) (*ecdsa.PublicKey, error) {
	if ctx.Err() != nil || v.keys == nil {
		return nil, ErrUnavailable
	}
	key, err := v.keys.KeyRead(ctx, keyID)
	if err != nil {
		cached, readErr := v.keys.KeyReadAll(ctx)
		if ctx.Err() != nil || readErr != nil || len(cached) == 0 {
			return nil, ErrUnavailable
		}
		return nil, ErrUnauthenticated
	}
	return key.Key().(*ecdsa.PublicKey), nil // signingKeyStore accepts only this type.
}

// signingKeyStore adds our ES256 policy to the library's thread-safe storage.
// Fetching, refresh scheduling, decoding, and synchronization belong to jwkset.
type signingKeyStore struct {
	jwkset.Storage
}

func (s *signingKeyStore) KeyReplaceAll(ctx context.Context, keys []jwkset.JWK) error {
	accepted := make([]jwkset.JWK, 0, len(keys))
	seen := make(map[string]bool)
	for _, key := range keys {
		metadata := key.Marshal()
		if metadata.ALG != jwkset.AlgES256 {
			continue
		}
		publicKey, ok := key.Key().(*ecdsa.PublicKey)
		if !ok || publicKey.Curve != elliptic.P256() || metadata.KID == "" ||
			len(metadata.KID) > 256 || seen[metadata.KID] || (metadata.USE != "" && metadata.USE != jwkset.UseSig) {
			return ErrUnavailable
		}
		seen[metadata.KID] = true
		accepted = append(accepted, key)
	}
	return s.Storage.KeyReplaceAll(ctx, accepted)
}

// boundedKeyTransport limits downloads while the library performs the HTTP request.
type boundedKeyTransport struct{}

func (boundedKeyTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	response, err := http.DefaultTransport.RoundTrip(request)
	if err != nil {
		return nil, err
	}
	const maxBytes = 64 * 1024
	if response.ContentLength > maxBytes {
		response.Body.Close()
		return nil, ErrUnavailable
	}
	response.Body = http.MaxBytesReader(nil, response.Body, maxBytes)
	return response, nil
}

package database_test

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpapi"
	"github.com/pratham124/nurse-flow/backend/internal/templates"
)

type demoKeyTransport func(*http.Request) (*http.Response, error)

func (f demoKeyTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// Exercises the actual TS Axios/Zod repository and Zustand store through local
// HTTP, real JWT verification and the limited Go role on restored Postgres.
// Tokens/sign-in and Supabase managed delivery are synthetic, not live sessions.
func TestShiftLifecycleHTTPDemo(t *testing.T) {
	store := database.OpenLifecycleDemoStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	alpha, err := store.ProfileByAuthUserID(ctx, os.Getenv("NURSEFLOW_TEST_ALPHA_ID"))
	if err != nil {
		t.Fatal(err)
	}
	beta, err := store.ProfileByAuthUserID(ctx, os.Getenv("NURSEFLOW_TEST_BETA_ID"))
	if err != nil {
		t.Fatal(err)
	}
	regular, err := store.ProfileByAuthUserID(ctx, os.Getenv("NURSEFLOW_TEST_REGULAR_ID"))
	if err != nil {
		t.Fatal(err)
	}
	var layout templates.Snapshot
	if err := json.Unmarshal([]byte(`{"id":"local","name":"Lifecycle HTTP Demo","doctorSides":[{"id":"a","name":"A"},{"id":"b","name":"B"}],"rooms":[{"id":"room","doctorSideId":"a","label":"101","bedCount":1}],"beds":[{"id":"bed","roomId":"room","label":"101-1","bedNumber":1}]}`), &layout); err != nil {
		t.Fatal(err)
	}
	template, err := store.SaveFloorTemplate(ctx, alpha.AuthUserID, alpha.ID, "", layout)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		adminURL, _ := url.Parse(os.Getenv("NURSEFLOW_TEST_DATABASE_URL"))
		adminURL.User = url.User("postgres")
		admin, err := sql.Open("pgx", adminURL.String())
		if err != nil {
			t.Error(err)
			return
		}
		defer admin.Close()
		if _, err := admin.Exec("DELETE FROM public.active_shifts WHERE floor_template_id=$1", template.ID); err != nil {
			t.Error(err)
		}
		if err := store.DeleteFloorTemplate(context.Background(), alpha.AuthUserID, alpha.ID, template.ID); err != nil {
			t.Error(err)
		}
	})
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	jwks, _ := json.Marshal(map[string]any{"keys": []map[string]string{{"kid": "lifecycle-demo", "kty": "EC", "alg": "ES256", "use": "sig", "crv": "P-256", "x": base64.RawURLEncoding.EncodeToString(key.X.FillBytes(make([]byte, 32))), "y": base64.RawURLEncoding.EncodeToString(key.Y.FillBytes(make([]byte, 32)))}}})
	previous := http.DefaultTransport
	http.DefaultTransport = demoKeyTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != auth.DevelopmentIssuer+"/.well-known/jwks.json" {
			return nil, fmt.Errorf("unexpected discovery URL")
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(string(jwks)))}, nil
	})
	defer func() { cancel(); http.DefaultTransport = previous }()
	verifier, err := auth.NewDevelopment(ctx)
	if err != nil {
		t.Fatal(err)
	}
	sign := func(subject string) string {
		token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{"iss": auth.DevelopmentIssuer, "aud": "authenticated", "sub": subject, "role": "authenticated", "exp": time.Now().Add(time.Hour).Unix()})
		token.Header["kid"] = "lifecycle-demo"
		value, err := token.SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	server := httptest.NewServer(httpapi.WithCORS(httpapi.NewHandler(verifier, store, store, store), []string{"http://localhost:8081"}))
	defer server.Close()
	root, err := filepath.Abs("../../..")
	if err != nil {
		t.Fatal(err)
	}
	profileJSON, _ := json.Marshal(map[string]any{"id": alpha.ID, "authUserId": alpha.AuthUserID, "role": alpha.Role, "displayName": alpha.DisplayName, "createdAt": alpha.CreatedAt, "updatedAt": alpha.UpdatedAt})
	run := func(mode string) {
		t.Helper()
		command := exec.CommandContext(ctx, "node", "--import", "tsx", "tests/shiftLifecycle.integration.mjs", mode)
		command.Dir = root
		command.Env = append(os.Environ(), "EXPO_PUBLIC_GO_API_URL="+server.URL, "NURSEFLOW_DEMO_PROFILE="+string(profileJSON), "NURSEFLOW_DEMO_TEMPLATE_ID="+template.ID, "NURSEFLOW_DEMO_ALPHA_TOKEN="+sign(alpha.AuthUserID), "NURSEFLOW_DEMO_BETA_TOKEN="+sign(beta.AuthUserID), "NURSEFLOW_DEMO_BETA_PROFILE_ID="+beta.ID, "NURSEFLOW_DEMO_REGULAR_TOKEN="+sign(regular.AuthUserID))
		output, err := command.CombinedOutput()
		if err != nil {
			t.Fatalf("client demo %s failed: %v\n%s", mode, err, output)
		}
		t.Log(strings.TrimSpace(string(output)))
	}
	run("workflow")
	server.Close()
	run("outage")
}

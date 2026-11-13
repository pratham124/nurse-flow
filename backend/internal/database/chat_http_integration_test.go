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
	"github.com/google/uuid"
	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpapi"
	"github.com/pratham124/nurse-flow/backend/internal/invites"
	"github.com/pratham124/nurse-flow/backend/internal/supabaseproject"
	"github.com/pratham124/nurse-flow/backend/internal/templates"
)

// Runs the real "chat with charge" flow end to end: the app's TS repository code
// talks to the real Go handler (real JWT checks, limited Postgres role). Tokens
// are synthetic and the database is the isolated local one, as in the lifecycle demo.
func TestChatHTTPDemo(t *testing.T) {
	store := database.OpenLifecycleDemoStore(t)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	profileFor := func(env string) database.Profile {
		profile, err := store.ProfileByAuthUserID(ctx, os.Getenv(env))
		if err != nil {
			t.Fatal(err)
		}
		return profile
	}
	alpha, beta := profileFor("NURSEFLOW_TEST_ALPHA_ID"), profileFor("NURSEFLOW_TEST_BETA_ID")

	// The admin connection stages rows the limited role must never create.
	adminURL, err := url.Parse(os.Getenv("NURSEFLOW_TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	adminURL.User = url.User("postgres")
	admin, err := sql.Open("pgx", adminURL.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close() })

	// The joined nurse is a fresh profile: the shared "regular" fixture has a role
	// that cannot join shifts, so (like the access tests) we create a new account.
	nurseAuthID := uuid.NewString()
	if _, err := admin.Exec("INSERT INTO auth.users(id) VALUES ($1)", nurseAuthID); err != nil {
		t.Fatal(err)
	}
	regular, err := store.EnsureProfile(ctx, nurseAuthID, "Chat Demo Nurse")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		for _, q := range []string{"DELETE FROM public.active_shifts WHERE charge_profile_id=$1", "DELETE FROM public.profiles WHERE id=$1"} {
			if _, err := admin.Exec(q, regular.ID); err != nil {
				t.Error(err)
			}
		}
		if _, err := admin.Exec("DELETE FROM auth.users WHERE id=$1", nurseAuthID); err != nil {
			t.Error(err)
		}
	})

	// Floor template and an active shift owned by alpha.
	var layout templates.Snapshot
	if err := json.Unmarshal([]byte(`{"id":"local","name":"Chat HTTP Demo","doctorSides":[{"id":"a","name":"A"},{"id":"b","name":"B"}],"rooms":[{"id":"room","doctorSideId":"a","label":"101","bedCount":1}],"beds":[{"id":"bed","roomId":"room","label":"101-1","bedNumber":1}]}`), &layout); err != nil {
		t.Fatal(err)
	}
	template, err := store.SaveFloorTemplate(ctx, alpha.AuthUserID, alpha.ID, "", layout)
	if err != nil {
		t.Fatal(err)
	}
	// Registered first so it runs last: the shift (and its chat rows) go before the template.
	t.Cleanup(func() {
		if err := store.DeleteFloorTemplate(context.Background(), alpha.AuthUserID, alpha.ID, template.ID); err != nil {
			t.Error(err)
		}
	})
	t.Cleanup(func() {
		if _, err := admin.Exec("DELETE FROM public.active_shifts WHERE floor_template_id=$1", template.ID); err != nil {
			t.Error(err)
		}
	})
	shift, err := store.StartShift(ctx, alpha.AuthUserID, alpha.ID, template.ID)
	if err != nil {
		t.Fatal(err)
	}
	// Two nurses; the regular profile links to the first, the second stays unlinked.
	nurses := `[{"id":"nurse-one","name":"Nina Linked","licenseType":"RN","experienceLevel":"mid","maxPatientLoad":5},{"id":"nurse-two","name":"Omar Unlinked","licenseType":"RN","experienceLevel":"mid","maxPatientLoad":5}]`
	// nurse-one gets the only (occupied) bed: the invite flow needs a nurse with patients.
	if _, err := admin.Exec(`UPDATE public.active_shifts SET status='assigned',
		shift_snapshot=shift_snapshot||jsonb_build_object('status','assigned','admittingDoctorSideId','a','nurses',$2::jsonb,
		'bedStates',(SELECT jsonb_agg(s||'{"patient":{"initials":"AB"},"acuity":"yellow"}'::jsonb) FROM jsonb_array_elements(shift_snapshot->'bedStates') s),
		'assignmentResult',jsonb_build_object('id','baseline','generatedTeams','[]'::jsonb,'roomCoverage','[]'::jsonb,
			'bedAssignments',jsonb_build_array(jsonb_build_object('id','assign','bedId',shift_snapshot->'bedStates'->0->>'bedId','nurseId','nurse-one')))),
		updated_at=updated_at+interval '1 microsecond' WHERE id=$1`, shift.ID, nurses); err != nil {
		t.Fatal(err)
	}
	// Link the regular profile to nurse-one through the real invite flow.
	code, err := invites.GenerateCode()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.CreateInvite(ctx, alpha.AuthUserID, alpha.ID, shift.ID, "nurse-one", invites.HashCode(code)); err != nil {
		t.Fatal(err)
	}
	if joined, err := store.AcceptInvite(ctx, regular.AuthUserID, regular.ID, invites.HashCode(code)); err != nil || joined.Status != "joined" {
		t.Fatalf("join: %+v, %v", joined, err)
	}

	// Real JWT verification with a local ES256 key served through a stubbed JWKS transport.
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	jwks, _ := json.Marshal(map[string]any{"keys": []map[string]string{{"kid": "chat-demo", "kty": "EC", "alg": "ES256", "use": "sig", "crv": "P-256", "x": base64.RawURLEncoding.EncodeToString(key.X.FillBytes(make([]byte, 32))), "y": base64.RawURLEncoding.EncodeToString(key.Y.FillBytes(make([]byte, 32)))}}})
	previous := http.DefaultTransport
	http.DefaultTransport = demoKeyTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != auth.Issuer(supabaseproject.Development)+"/.well-known/jwks.json" {
			return nil, fmt.Errorf("unexpected discovery URL")
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(string(jwks)))}, nil
	})
	defer func() { cancel(); http.DefaultTransport = previous }()
	verifier, err := auth.New(ctx, supabaseproject.Development)
	if err != nil {
		t.Fatal(err)
	}
	sign := func(subject string) string {
		token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{"iss": auth.Issuer(supabaseproject.Development), "aud": "authenticated", "sub": subject, "role": "authenticated", "exp": time.Now().Add(time.Hour).Unix()})
		token.Header["kid"] = "chat-demo"
		value, err := token.SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	server := httptest.NewServer(httpapi.WithCORS(httpapi.NewHandler(verifier, store, store, store, store, store, store, store, store, nil), []string{"http://localhost:8081"}))
	defer server.Close()
	root, err := filepath.Abs("../../..")
	if err != nil {
		t.Fatal(err)
	}
	profileJSON := func(p database.Profile) string {
		encoded, _ := json.Marshal(map[string]any{"id": p.ID, "authUserId": p.AuthUserID, "role": p.Role, "displayName": p.DisplayName, "createdAt": p.CreatedAt, "updatedAt": p.UpdatedAt})
		return string(encoded)
	}
	command := exec.CommandContext(ctx, "node", "--import", "tsx", "tests/chat.integration.mjs")
	command.Dir = root
	command.Env = append(os.Environ(),
		"EXPO_PUBLIC_GO_API_URL="+server.URL,
		"NURSEFLOW_CHAT_SHIFT_ID="+shift.ID,
		"NURSEFLOW_CHAT_LINKED_NURSE_ID=nurse-one",
		"NURSEFLOW_CHAT_OTHER_NURSE_ID=nurse-two",
		"NURSEFLOW_CHAT_ALPHA_PROFILE="+profileJSON(alpha),
		"NURSEFLOW_CHAT_ALPHA_TOKEN="+sign(alpha.AuthUserID),
		"NURSEFLOW_CHAT_REGULAR_PROFILE="+profileJSON(regular),
		"NURSEFLOW_CHAT_REGULAR_TOKEN="+sign(regular.AuthUserID),
		"NURSEFLOW_CHAT_BETA_TOKEN="+sign(beta.AuthUserID))
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("chat client demo failed: %v\n%s", err, output)
	}
	t.Log(strings.TrimSpace(string(output)))
}

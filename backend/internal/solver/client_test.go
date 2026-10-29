package solver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const okBody = `{"assignmentResult":{"id":"res-1"},"flags":[],"objectives":{"unassignedCount":0},"inputFingerprint":"fp","optimizerVersion":"v1"}`

func clientFor(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	client, err := New(server.URL+"/", "secret-token")
	if err != nil {
		t.Fatal(err)
	}
	return client
}

func TestSolveSendsTokenAndSnapshot(t *testing.T) {
	var gotAuth, gotPath, gotType string
	var gotBody solveRequest
	client := clientFor(t, func(w http.ResponseWriter, r *http.Request) {
		gotAuth, gotPath, gotType = r.Header.Get("Authorization"), r.URL.Path, r.Header.Get("Content-Type")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(okBody))
	})
	result := client.Solve(context.Background(), "run-1", json.RawMessage(`{"nurses":[]}`))
	if result.Kind != KindSolved || result.Output.InputFingerprint != "fp" || result.Output.OptimizerVersion != "v1" {
		t.Fatalf("unexpected result %+v", result)
	}
	if string(result.Output.AssignmentResult) != `{"id":"res-1"}` || string(result.Output.Flags) != `[]` {
		t.Fatalf("output pieces not kept as sent: %+v", result.Output)
	}
	if gotAuth != "Bearer secret-token" || gotPath != "/v1/solve" || gotType != "application/json" {
		t.Fatalf("request headers or path wrong: %q %q %q", gotAuth, gotPath, gotType)
	}
	if gotBody.RunID != "run-1" || string(gotBody.ShiftSnapshot) != `{"nurses":[]}` {
		t.Fatalf("request body wrong: %+v", gotBody)
	}
}

func TestSolveMapsSolverAnswers(t *testing.T) {
	tests := []struct {
		name   string
		status int
		body   string
		want   Kind
	}{
		{"invalid input", 422, `{"status":"invalid_input"}`, KindInvalidInput},
		{"solver timeout", 504, `{"status":"timed_out"}`, KindTimedOut},
		{"solver failure", 500, `{"status":"failed"}`, KindFailed},
		{"wrong token", 401, `{"status":"unauthorized"}`, KindUnauthorized},
		{"unreadable body", 200, `not json`, KindUnreadable},
		{"success without result", 200, `{"flags":[]}`, KindUnreadable},
		{"bare gateway timeout", 504, `<html>gateway</html>`, KindUnavailable},
		{"bad gateway", 502, ``, KindUnavailable},
		{"service unavailable", 503, ``, KindUnavailable},
		{"unexpected status", 404, `{}`, KindUnreadable},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			client := clientFor(t, func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(test.status)
				_, _ = w.Write([]byte(test.body))
			})
			if got := client.Solve(context.Background(), "run", json.RawMessage(`{}`)).Kind; got != test.want {
				t.Fatalf("got %s, want %s", got, test.want)
			}
		})
	}
}

func TestSolveUnreachableSolver(t *testing.T) {
	server := httptest.NewServer(http.NotFoundHandler())
	address := server.URL
	server.Close()
	client, err := New(address, "token")
	if err != nil {
		t.Fatal(err)
	}
	if got := client.Solve(context.Background(), "run", json.RawMessage(`{}`)).Kind; got != KindUnreachable {
		t.Fatalf("got %s, want unreachable", got)
	}
}

func TestSolveConnectionDroppedAfterSendingIsUnavailable(t *testing.T) {
	client := clientFor(t, func(w http.ResponseWriter, r *http.Request) {
		connection, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			t.Error(err)
			return
		}
		_ = connection.Close()
	})
	if got := client.Solve(context.Background(), "run", json.RawMessage(`{}`)).Kind; got != KindUnavailable {
		t.Fatalf("got %s, want unavailable", got)
	}
}

func TestSolveOwnDeadlineIsATimeout(t *testing.T) {
	release := make(chan struct{})
	client := clientFor(t, func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	})
	t.Cleanup(func() { close(release) })
	client.Timeout = 50 * time.Millisecond
	if got := client.Solve(context.Background(), "run", json.RawMessage(`{}`)).Kind; got != KindTimedOut {
		t.Fatalf("got %s, want timed_out", got)
	}
}

func TestSolveBoundsTheResponse(t *testing.T) {
	client := clientFor(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"flags":"` + strings.Repeat("a", maxResponseBytes) + `"}`))
	})
	if got := client.Solve(context.Background(), "run", json.RawMessage(`{}`)).Kind; got != KindUnreadable {
		t.Fatalf("got %s, want unreadable", got)
	}
}

func TestSolveDoesNotFollowRedirects(t *testing.T) {
	elsewhere := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("the redirect target must never be called")
	}))
	defer elsewhere.Close()
	client := clientFor(t, func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, elsewhere.URL, http.StatusTemporaryRedirect)
	})
	if got := client.Solve(context.Background(), "run", json.RawMessage(`{}`)).Kind; got != KindUnreadable {
		t.Fatalf("got %s, want unreadable", got)
	}
}

func TestNewRejectsBadConfiguration(t *testing.T) {
	for _, address := range []string{"", "not a url", "ftp://host", "http://"} {
		if _, err := New(address, "token"); err == nil {
			t.Errorf("New(%q) accepted a bad address", address)
		}
	}
	if _, err := New("http://127.0.0.1:8090", "  "); err == nil {
		t.Error("New accepted a blank token")
	}
}

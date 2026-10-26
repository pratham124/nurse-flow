// Package solver calls the stateless Python optimizer. It sends a shift snapshot
// and returns what the solver answered; it never touches the database.
package solver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// CallTimeout is how long Go waits for one solve. It is longer than the solver's
// own 120 s budget, so the solver normally reports its own timeout first.
const CallTimeout = 125 * time.Second

const (
	// maxResponseBytes bounds what Go reads back from the solver.
	maxResponseBytes = 4 << 20
	solvePath        = "/v1/solve"
)

// Kind says how a solve call ended.
type Kind string

// The ways a solve call can end. Each maps to one recorded run outcome.
const (
	// KindSolved means the solver returned an assignment (Result.Output is set).
	KindSolved Kind = "solved"
	// KindInvalidInput means the solver rejected the shift setup (HTTP 422).
	KindInvalidInput Kind = "invalid_input"
	// KindTimedOut means the solver reported a timeout, or Go's deadline ran out.
	KindTimedOut Kind = "timed_out"
	// KindFailed means the solver reported its own failure (HTTP 500).
	KindFailed Kind = "failed"
	// KindUnauthorized means the solver refused the bearer token (HTTP 401).
	KindUnauthorized Kind = "unauthorized"
	// KindUnreadable means the solver answered with something Go cannot use.
	KindUnreadable Kind = "unreadable"
	// KindUnavailable means no usable answer arrived, but the request may have
	// reached the solver (a reset after sending, a gateway error). Nothing is
	// recorded, because the solver might still be working.
	KindUnavailable Kind = "unavailable"
	// KindUnreachable means the request provably never reached the solver: the
	// connection could not even be opened. Nothing was started, so the run can be
	// handed back for an immediate retry.
	KindUnreachable Kind = "unreachable"
)

// Output is a successful solve, in the shape the solver sends it.
type Output struct {
	AssignmentResult json.RawMessage `json:"assignmentResult"`
	Flags            json.RawMessage `json:"flags"`
	Objectives       json.RawMessage `json:"objectives"`
	InputFingerprint string          `json:"inputFingerprint"`
	OptimizerVersion string          `json:"optimizerVersion"`
}

// Result is the typed outcome of one call. Output is set only for KindSolved.
type Result struct {
	Kind   Kind
	Output Output
}

// Client calls one solver service.
type Client struct {
	// Timeout is the deadline for one call; New sets CallTimeout.
	Timeout time.Duration
	url     string
	token   string
	http    *http.Client
}

// New checks the solver address and keeps the shared secret for later calls.
func New(baseURL, token string) (*Client, error) {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return nil, errors.New("solver URL must be an http or https address")
	}
	if strings.TrimSpace(token) == "" {
		return nil, errors.New("solver token must not be blank")
	}
	return &Client{
		Timeout: CallTimeout,
		url:     strings.TrimRight(parsed.String(), "/") + solvePath,
		token:   token,
		http: &http.Client{
			// A redirect would resend the bearer token to another address.
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
	}, nil
}

type solveRequest struct {
	RunID         string          `json:"runId"`
	ShiftSnapshot json.RawMessage `json:"shiftSnapshot"`
}

// Solve asks the solver for an assignment. runId only lets the solver's private
// logs be matched to a run. Neither the token nor the snapshot is ever logged.
func (c *Client) Solve(ctx context.Context, runID string, shiftSnapshot json.RawMessage) Result {
	body, err := json.Marshal(solveRequest{RunID: runID, ShiftSnapshot: shiftSnapshot})
	if err != nil {
		return Result{Kind: KindUnreadable}
	}
	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
	if err != nil {
		return Result{Kind: KindUnavailable}
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+c.token)

	response, err := c.http.Do(request)
	if err != nil {
		// Go's own deadline means the solver was reached but never answered in time.
		if errors.Is(err, context.DeadlineExceeded) {
			return Result{Kind: KindTimedOut}
		}
		if neverReachedSolver(err) {
			return Result{Kind: KindUnreachable}
		}
		return Result{Kind: KindUnavailable}
	}
	defer response.Body.Close()
	return c.interpret(ctx, response)
}

// neverReachedSolver is true when the connection could not be opened (refused,
// unknown host), so the solver cannot have seen the request. A failure after the
// connection was open is not included: the solver may have started the solve.
func neverReachedSolver(err error) bool {
	var dnsError *net.DNSError
	var opError *net.OpError
	return errors.As(err, &dnsError) || (errors.As(err, &opError) && opError.Op == "dial")
}

// interpret maps the solver's HTTP answer to a Kind.
func (c *Client) interpret(ctx context.Context, response *http.Response) Result {
	content, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return Result{Kind: KindTimedOut}
		}
		return Result{Kind: KindUnavailable}
	}
	if len(content) > maxResponseBytes {
		return Result{Kind: KindUnreadable}
	}
	switch response.StatusCode {
	case http.StatusOK:
		return decodeOutput(content)
	case http.StatusUnprocessableEntity:
		return Result{Kind: KindInvalidInput}
	case http.StatusInternalServerError:
		return Result{Kind: KindFailed}
	case http.StatusUnauthorized:
		return Result{Kind: KindUnauthorized}
	case http.StatusGatewayTimeout:
		// Only the solver's own typed answer is a recorded timeout; a bare gateway
		// 504 may mean the solve is still running, so the run is left running.
		if reportedStatus(content) == "timed_out" {
			return Result{Kind: KindTimedOut}
		}
		return Result{Kind: KindUnavailable}
	case http.StatusBadGateway, http.StatusServiceUnavailable:
		return Result{Kind: KindUnavailable}
	}
	return Result{Kind: KindUnreadable}
}

func reportedStatus(content []byte) string {
	var body struct {
		Status string `json:"status"`
	}
	if json.Unmarshal(content, &body) != nil {
		return ""
	}
	return body.Status
}

// decodeOutput reads a 200 body. A body that is not the expected object, or that
// lacks any part of the result, is unreadable.
func decodeOutput(content []byte) Result {
	var output Output
	if err := json.Unmarshal(content, &output); err != nil {
		return Result{Kind: KindUnreadable}
	}
	if len(output.AssignmentResult) == 0 || len(output.Flags) == 0 || len(output.Objectives) == 0 {
		return Result{Kind: KindUnreadable}
	}
	return Result{Kind: KindSolved, Output: output}
}

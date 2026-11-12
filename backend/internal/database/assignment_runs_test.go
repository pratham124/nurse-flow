package database

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"reflect"
	"testing"

	"github.com/pratham124/nurse-flow/backend/internal/solver"
)

// sameResponse compares two responses; RunResponse holds a slice, so == is not allowed.
func sameResponse(a, b RunResponse) bool {
	return reflect.DeepEqual(a, b)
}

var fortyRooms = 40

func TestIsUnavailable(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"deadline", fmt.Errorf("finalize: %w", context.DeadlineExceeded), true},
		{"network error", &net.OpError{Op: "dial", Err: errors.New("refused")}, true},
		{"bad connection", driver.ErrBadConn, true},
		{"rejected statement", errors.New("duplicate key"), false},
		{"canceled", context.Canceled, false},
		{"nil", nil, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := IsUnavailable(test.err); got != test.want {
				t.Fatalf("IsUnavailable(%v) = %v, want %v", test.err, got, test.want)
			}
		})
	}
}

func TestRecordedResponse(t *testing.T) {
	result := "res-1"
	tests := []struct {
		name string
		run  OptimizerRun
		want RunResponse
	}{
		{"succeeded", OptimizerRun{ID: "r", Status: storedSucceeded, ResultID: &result}, RunResponse{Status: RunStatusSaved, RunID: "r", ResultID: "res-1"}},
		{"stale", OptimizerRun{ID: "r", Status: storedStale}, RunResponse{Status: RunStatusStale, RunID: "r"}},
		{"failed invalid input", OptimizerRun{ID: "r", Status: storedFailed, OutcomeSummary: json.RawMessage(`{"errorCode":"invalid_input"}`)}, RunResponse{Status: RunStatusInvalidInput, RunID: "r"}},
		{"failed timed out", OptimizerRun{ID: "r", Status: storedFailed, OutcomeSummary: json.RawMessage(`{"errorCode":"timed_out"}`)}, RunResponse{Status: RunStatusTimedOut, RunID: "r"}},
		{"failed other code", OptimizerRun{ID: "r", Status: storedFailed, OutcomeSummary: json.RawMessage(`{"errorCode":"finalization_failed"}`)}, RunResponse{Status: RunStatusFailed, RunID: "r"}},
		{"failed without summary", OptimizerRun{ID: "r", Status: storedFailed}, RunResponse{Status: RunStatusFailed, RunID: "r"}},
		{"running", OptimizerRun{ID: "r", Status: storedRunning}, RunResponse{Status: RunStatusRunning, RunID: "r"}},
		{"invalid input reads its reasons back", OptimizerRun{ID: "r", Status: storedFailed, OutcomeSummary: json.RawMessage(invalidInputSummary([]solver.InputReason{{Code: "unsupported_room_count", Limit: &fortyRooms}, {Code: "missing_acuity"}}))}, RunResponse{Status: RunStatusInvalidInput, RunID: "r", Reasons: []solver.InputReason{{Code: "unsupported_room_count", Limit: &fortyRooms}, {Code: "missing_acuity"}}}},
		{"invalid input without reasons", OptimizerRun{ID: "r", Status: storedFailed, OutcomeSummary: json.RawMessage(`{"errorCode":"invalid_input"}`)}, RunResponse{Status: RunStatusInvalidInput, RunID: "r"}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := recordedResponse(&test.run); !sameResponse(got, test.want) {
				t.Fatalf("got %+v, want %+v", got, test.want)
			}
		})
	}
}

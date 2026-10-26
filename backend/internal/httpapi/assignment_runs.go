package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/pratham124/nurse-flow/backend/internal/assignmentruns"
	"github.com/pratham124/nurse-flow/backend/internal/auth"
	"github.com/pratham124/nurse-flow/backend/internal/database"
	"github.com/pratham124/nurse-flow/backend/internal/httpresponse"
)

const (
	// maxRunRequestBodyBytes keeps the three-field run request small.
	maxRunRequestBodyBytes = 16 << 10
	// runWriteDeadline lets a response go out after a run that is allowed to take
	// up to 135 s. The server-wide write timeout is only 10 s.
	runWriteDeadline = 140 * time.Second
)

// AssignmentRunner runs one optimizer run for a charge nurse and returns the
// response to send. The context it receives must already be detached from the
// HTTP request and carry a deadline.
type AssignmentRunner interface {
	Run(ctx context.Context, caller database.RunCaller, shiftID string, request database.RunRequest) database.RunResponse
}

func registerAssignmentRunRoutes(mux *http.ServeMux, verifier *auth.Verifier, profiles auth.ProfileReader, runner AssignmentRunner) {
	protect := func(handler http.Handler) http.Handler {
		return verifier.RequireIdentity(auth.RequireChargeNurse(profiles, handler))
	}
	mux.Handle("POST /active-shifts/{id}/assignment-runs", protect(requireUUID(assignmentRunHandler(runner))))
}

// runRequestBody uses pointers so a missing or null field can be told from a blank one.
type runRequestBody struct {
	ClientMutationID      *string    `json:"clientMutationId"`
	ExpectedShiftRevision *time.Time `json:"expectedShiftRevision"`
	ExpectedBaseline      *string    `json:"expectedBaselineAssignmentResultId"`
}

func assignmentRunHandler(runner AssignmentRunner) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request, ok := decodeRunRequest(w, r)
		if !ok {
			return
		}
		profile, _ := auth.ProfileFromContext(r.Context())
		// A run can legitimately take over two minutes, so this route gets its own
		// write deadline. A recorder or wrapper without support just keeps the default.
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(runWriteDeadline))
		// Finish or fail the run even if the phone disconnects: an abandoned solve
		// would leave the run "running" until its lease runs out.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), assignmentruns.RunDeadline)
		defer cancel()
		caller := database.RunCaller{AuthUserID: profile.AuthUserID, ProfileID: profile.ID}
		response := runner.Run(ctx, caller, r.PathValue("id"), request)
		httpresponse.WriteJSON(w, runStatusCode(response.Status), response)
	})
}

// decodeRunRequest reads and validates the body. Failures use the optimizer's own
// {"status":"invalid_input"} shape, which the app's run parser expects, instead of
// the usual error envelope.
func decodeRunRequest(w http.ResponseWriter, r *http.Request) (database.RunRequest, bool) {
	var body runRequestBody
	if err := decodeJSONRequestLimit(w, r, &body, maxRunRequestBodyBytes); err != nil {
		status := http.StatusUnprocessableEntity
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			status = http.StatusRequestEntityTooLarge
		}
		writeRunInvalid(w, status)
		return database.RunRequest{}, false
	}
	mutationID := ""
	if body.ClientMutationID != nil {
		mutationID = strings.TrimSpace(*body.ClientMutationID)
	}
	baseline := ""
	baselineValid := true
	if body.ExpectedBaseline != nil {
		baseline = strings.TrimSpace(*body.ExpectedBaseline)
		baselineValid = baseline != ""
	}
	if mutationID == "" || body.ExpectedShiftRevision == nil || body.ExpectedShiftRevision.IsZero() || !baselineValid {
		writeRunInvalid(w, http.StatusUnprocessableEntity)
		return database.RunRequest{}, false
	}
	// The database keeps microseconds, so extra digits in the app's timestamp would
	// never equal updated_at. Cut them once here, before the compare and the fingerprint.
	revision := body.ExpectedShiftRevision.Truncate(time.Microsecond)
	return database.RunRequest{ClientMutationID: mutationID, ExpectedRevision: revision, ExpectedBaseline: baseline}, true
}

// runStatusCode returns the HTTP status that goes with a run status.
func runStatusCode(status database.RunStatus) int {
	switch status {
	case database.RunStatusSaved:
		return http.StatusOK
	case database.RunStatusRunning:
		return http.StatusAccepted
	case database.RunStatusStale, database.RunStatusConflict:
		return http.StatusConflict
	case database.RunStatusInvalidInput:
		return http.StatusUnprocessableEntity
	case database.RunStatusTimedOut:
		return http.StatusGatewayTimeout
	case database.RunStatusUnavailable:
		return http.StatusServiceUnavailable
	case database.RunStatusForbidden:
		return http.StatusForbidden
	}
	return http.StatusInternalServerError
}

func writeRunInvalid(w http.ResponseWriter, status int) {
	httpresponse.WriteJSON(w, status, database.RunResponse{Status: database.RunStatusInvalidInput})
}

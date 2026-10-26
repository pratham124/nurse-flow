package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pratham124/nurse-flow/backend/internal/solver"
	"gorm.io/gorm"
)

// These tests reuse moveSnapshot: three nurses (n3 is an LPN), two rooms, and three
// occupied beds, with a generated assignment "res1". A first run removes res1 and
// puts the shift back into setup.

const runObjectivesJSON = `{"unassignedCount":0,"maxNurseAcuityLoad":3,"maxNursePatientCount":2,"redBedOwnerRankSum":1,
  "sideGuidanceTotalExcess":0,"sideGuidanceNurseCount":0,"teamWeightedAcuityGap":0,"teamPatientCountGap":0,
  "teamRnCountGap":0,"teamExperienceDistributionGap":0,"teamCapacityGap":0}`

// outputFor builds a solver answer that is valid for moveSnapshot.
func outputFor(resultID string) solver.Output {
	result := strings.NewReplacer("RES", resultID).Replace(`{"id":"RES",
  "generatedTeams":[{"id":"RES-t1","label":"Team 1","nurseIds":["n1","n2"]},{"id":"RES-t2","label":"Team 2","nurseIds":["n3"]}],
  "roomCoverage":[{"id":"RES-c1","roomId":"r1","nurseIds":["n1","n2","n3"]},{"id":"RES-c2","roomId":"r2","nurseIds":["n1","n2","n3"]}],
  "bedAssignments":[{"id":"RES-a1","bedId":"b1","nurseId":"n1"},{"id":"RES-a2","bedId":"b2","nurseId":"n2"},{"id":"RES-a3","bedId":"b3","nurseId":"n2"}]}`)
	return solver.Output{
		AssignmentResult: json.RawMessage(result),
		Flags:            json.RawMessage(`[{"id":"` + resultID + `-f1","type":"x","severity":"warning","message":"m"}]`),
		Objectives:       json.RawMessage(runObjectivesJSON),
		InputFingerprint: "fp-" + resultID,
		OptimizerVersion: "v1",
	}
}

func (w world) caller() RunCaller {
	return RunCaller{AuthUserID: w.charge.AuthUserID, ProfileID: w.charge.ID}
}

// firstRun turns the world's shift into one that has never been assigned.
func (w world) firstRun(t *testing.T) {
	t.Helper()
	w.f.exec(t, `UPDATE public.active_shifts SET status = 'setup',
		shift_snapshot = (shift_snapshot - 'assignmentResult') || '{"status":"setup"}'::jsonb WHERE id = $1`, w.shift)
}

func (w world) revision(t *testing.T) time.Time {
	t.Helper()
	var revision time.Time
	if err := w.f.admin.QueryRow("SELECT updated_at FROM public.active_shifts WHERE id = $1", w.shift).Scan(&revision); err != nil {
		t.Fatal(err)
	}
	return revision
}

func (w world) prepare(mutation string, revision time.Time, baseline string) (PreparedRun, error) {
	return w.f.store.PrepareAssignmentRun(contextForTest(), w.caller(), w.shift, RunRequest{
		ClientMutationID: mutation, ExpectedRevision: revision, ExpectedBaseline: baseline,
	})
}

// mustSolve prepares a run and requires a job to solve.
func (w world) mustSolve(t *testing.T, mutation string, revision time.Time, baseline string) *RunSolveJob {
	t.Helper()
	prepared, err := w.prepare(mutation, revision, baseline)
	if err != nil || prepared.Solve == nil || prepared.Solve.RunID == "" {
		t.Fatalf("expected a run to solve: %+v, %v", prepared, err)
	}
	return prepared.Solve
}

func (w world) finalize(runID string, output solver.Output) (RunResponse, error) {
	return w.f.store.FinalizeAssignmentRun(contextForTest(), w.caller(), runID, output)
}

func (w world) runCount(t *testing.T) int {
	t.Helper()
	return w.f.count(t, "SELECT count(*) FROM public.optimizer_runs WHERE shift_id = $1", w.shift)
}

type runRow struct {
	status, resultID, fingerprint, version, summary string
	completed                                       bool
	duration                                        sql.NullInt64
	started                                         time.Time
}

func (w world) runRow(t *testing.T, runID string) runRow {
	t.Helper()
	var row runRow
	err := w.f.admin.QueryRow(`SELECT status, COALESCE(result_id, ''), COALESCE(input_fingerprint, ''), COALESCE(optimizer_version, ''),
		outcome_summary::text, completed_at IS NOT NULL, duration_ms, started_at FROM public.optimizer_runs WHERE id = $1`, runID).
		Scan(&row.status, &row.resultID, &row.fingerprint, &row.version, &row.summary, &row.completed, &row.duration, &row.started)
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func (w world) errorCode(t *testing.T, runID string) string {
	t.Helper()
	var summary struct {
		ErrorCode string `json:"errorCode"`
	}
	_ = json.Unmarshal([]byte(w.runRow(t, runID).summary), &summary)
	return summary.ErrorCode
}

// shiftState is what a run must leave untouched unless it saves.
func (w world) shiftState(t *testing.T) string {
	t.Helper()
	return w.f.text(t, "SELECT status || '|' || updated_at::text || '|' || shift_snapshot::text FROM public.active_shifts WHERE id = $1", w.shift)
}

func TestAssignmentRunFirstRunIntegration(t *testing.T) {
	f := openAccessFixture(t)
	w := newWorld(t, f, "[]")
	w.firstRun(t)
	revision := w.revision(t)
	before := f.sideEffects(t, w.shift)

	job := w.mustSolve(t, "m1", revision, "")
	if !strings.Contains(string(job.ShiftSnapshot), `"futureField"`) {
		t.Fatal("the solver must receive the stored snapshot")
	}
	if row := w.runRow(t, job.RunID); row.status != "running" || row.completed {
		t.Fatalf("a prepared run must be running: %+v", row)
	}

	response, err := w.finalize(job.RunID, outputFor("res2"))
	if err != nil || response != (RunResponse{Status: RunStatusSaved, RunID: job.RunID, ResultID: "res2"}) {
		t.Fatalf("%+v %v", response, err)
	}

	var snapshot map[string]json.RawMessage
	if err := json.Unmarshal([]byte(f.text(t, "SELECT shift_snapshot::text FROM public.active_shifts WHERE id = $1", w.shift)), &snapshot); err != nil {
		t.Fatal(err)
	}
	if string(snapshot["status"]) != `"assigned"` || !strings.Contains(string(snapshot["assignmentResult"]), `"id": "res2"`) ||
		!strings.Contains(string(snapshot["flags"]), "res2-f1") || !strings.Contains(string(snapshot["futureField"]), "keep") {
		t.Fatalf("snapshot not saved as expected: %v", snapshot)
	}
	if f.text(t, "SELECT status FROM public.active_shifts WHERE id = $1", w.shift) != "assigned" || !w.revision(t).After(revision) {
		t.Fatal("the row status and revision must advance")
	}
	row := w.runRow(t, job.RunID)
	if row.status != "succeeded" || row.resultID != "res2" || row.fingerprint != "fp-res2" || row.version != "v1" || !row.completed || !row.duration.Valid || row.duration.Int64 < 0 {
		t.Fatalf("%+v", row)
	}
	var raw struct {
		AssignedBedCount   int            `json:"assignedBedCount"`
		UnassignedBedCount int            `json:"unassignedBedCount"`
		ObjectiveSummary   map[string]any `json:"objectiveSummary"`
	}
	if err := json.Unmarshal([]byte(row.summary), &raw); err != nil || raw.AssignedBedCount != 3 || raw.UnassignedBedCount != 0 || len(raw.ObjectiveSummary) != 11 {
		t.Fatalf("outcome summary %s: %v", row.summary, err)
	}

	// The retained Realtime and notification triggers must see the same effects as
	// the original SQL functions: one committed active_shifts change.
	goEffects := f.sideEffects(t, w.shift).minus(before)
	sqlWorld := newWorld(t, f, "[]")
	sqlWorld.firstRun(t)
	sqlRevision := sqlWorld.revision(t)
	sqlBefore := f.sideEffects(t, sqlWorld.shift)
	prepared := f.rpcCommit(t, sqlWorld.charge.AuthUserID, "SELECT public.prepare_optimizer_run($1::uuid, 'sql1', $2::timestamptz, NULL)::text", sqlWorld.shift, sqlRevision)
	var sqlPrepared struct{ RunID string }
	_ = json.Unmarshal([]byte(prepared), &sqlPrepared)
	if sqlPrepared.RunID == "" {
		t.Fatalf("the SQL prepare did not return a run: %s", prepared)
	}
	sqlOutput := outputFor("res2")
	f.serviceCommit(t, "SELECT public.finalize_optimizer_run($1::uuid, 'fp', 'v1', $2::jsonb, $3::jsonb, $4::jsonb)::text",
		sqlPrepared.RunID, string(sqlOutput.AssignmentResult), string(sqlOutput.Flags), string(sqlOutput.Objectives))
	sqlEffects := f.sideEffects(t, sqlWorld.shift).minus(sqlBefore)
	if goEffects != sqlEffects || goEffects.realtime == 0 {
		t.Fatalf("side effects differ: go=%+v sql=%+v", goEffects, sqlEffects)
	}
}

// serviceCommit runs a retained function as the optimizer service and commits.
func (f *accessFixture) serviceCommit(t *testing.T, query string, args ...any) string {
	t.Helper()
	tx, err := f.admin.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err := tx.Exec("SELECT set_config('request.jwt.claim.role', 'service_role', true)"); err != nil {
		t.Fatal(err)
	}
	var value sql.NullString
	if err := tx.QueryRow(query, args...).Scan(&value); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	return value.String
}

func TestAssignmentRunRerunIntegration(t *testing.T) {
	f := openAccessFixture(t)

	t.Run("supersedes active moves in the same change", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		if _, err := w.move("b2", "n1", "n2", "mv1", `[]`, nil); err != nil {
			t.Fatal(err)
		}
		if w.activeOverrides(t) != 1 {
			t.Fatal("setup: expected one active move")
		}
		job := w.mustSolve(t, "rerun1", w.revision(t), "res1")
		response, err := w.finalize(job.RunID, outputFor("res2"))
		if err != nil || response.Status != RunStatusSaved || response.ResultID != "res2" {
			t.Fatalf("%+v %v", response, err)
		}
		if w.activeOverrides(t) != 0 {
			t.Fatal("the rerun must supersede active moves")
		}
		if f.count(t, `SELECT count(*) FROM public.manual_assignment_overrides o JOIN public.active_shifts s ON s.id = o.shift_id
			WHERE s.id = $1 AND o.status = 'superseded' AND o.superseded_at = s.updated_at`, w.shift) != 1 {
			t.Fatal("moves must be superseded at the new revision time")
		}
		if !strings.Contains(f.text(t, "SELECT shift_snapshot::text FROM public.active_shifts WHERE id = $1", w.shift), `"id": "res2"`) {
			t.Fatal("new baseline not stored")
		}
	})

	t.Run("a reused result id fails and changes nothing", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		if _, err := w.move("b2", "n1", "n2", "mv1", `[]`, nil); err != nil {
			t.Fatal(err)
		}
		job := w.mustSolve(t, "rerun1", w.revision(t), "res1")
		state := w.shiftState(t)
		response, err := w.finalize(job.RunID, outputFor("res1"))
		if err != nil || response.Status != RunStatusFailed {
			t.Fatalf("%+v %v", response, err)
		}
		if w.errorCode(t, job.RunID) != "result_id_reused" || w.runRow(t, job.RunID).status != "failed" {
			t.Fatalf("%+v", w.runRow(t, job.RunID))
		}
		if w.shiftState(t) != state || w.activeOverrides(t) != 1 {
			t.Fatal("a failed run must not touch the shift or its moves")
		}
	})

	t.Run("stale after a manual move", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		job := w.mustSolve(t, "rerun1", w.revision(t), "res1")
		if _, err := w.move("b2", "n1", "n2", "mv1", `[]`, nil); err != nil {
			t.Fatal(err)
		}
		state := w.shiftState(t)
		response, err := w.finalize(job.RunID, outputFor("res2"))
		if err != nil || response != (RunResponse{Status: RunStatusStale, RunID: job.RunID}) {
			t.Fatalf("%+v %v", response, err)
		}
		row := w.runRow(t, job.RunID)
		if row.status != "stale" || w.errorCode(t, job.RunID) != "stale" || !row.completed || row.fingerprint != "fp-res2" {
			t.Fatalf("%+v", row)
		}
		if w.shiftState(t) != state || w.activeOverrides(t) != 1 {
			t.Fatal("a stale run must not touch the shift or its moves")
		}
	})
}

func TestAssignmentRunPrepareIntegration(t *testing.T) {
	f := openAccessFixture(t)

	t.Run("stale at prepare records no run", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		for name, baseline := range map[string]string{"old revision": "res1", "wrong baseline": "other"} {
			revision := w.revision(t)
			if name == "old revision" {
				revision = revision.Add(-time.Second)
			}
			prepared, err := w.prepare("m-"+name, revision, baseline)
			if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusStale}) {
				t.Fatalf("%s: %+v %v", name, prepared, err)
			}
		}
		// Asking for a first run on a shift that already has a baseline is stale too.
		if prepared, err := w.prepare("m-first", w.revision(t), ""); err != nil || prepared.Response == nil || prepared.Response.Status != RunStatusStale {
			t.Fatalf("%+v %v", prepared, err)
		}
		if w.runCount(t) != 0 {
			t.Fatal("stale at prepare must not create runs")
		}
	})

	t.Run("an ended shift is stale", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", w.shift)
		w.f.exec(t, "UPDATE public.active_shifts SET updated_at = $2 WHERE id = $1", w.shift, revision)
		if prepared, err := w.prepare("m1", revision, "res1"); err != nil || prepared.Response == nil || prepared.Response.Status != RunStatusStale {
			t.Fatalf("%+v %v", prepared, err)
		}
	})

	t.Run("a mutation reused with other preconditions conflicts", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "m1", revision, "res1")
		for name, other := range map[string]func() (PreparedRun, error){
			"other baseline": func() (PreparedRun, error) { return w.prepare("m1", revision, "other") },
			"other revision": func() (PreparedRun, error) { return w.prepare("m1", revision.Add(time.Second), "res1") },
		} {
			prepared, err := other()
			if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusConflict, RunID: job.RunID}) {
				t.Fatalf("%s: %+v %v", name, prepared, err)
			}
		}
	})

	t.Run("the same mutation while solving is running", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "m1", revision, "res1")
		prepared, err := w.prepare("m1", revision, "res1")
		if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusRunning, RunID: job.RunID}) {
			t.Fatalf("%+v %v", prepared, err)
		}
	})

	t.Run("another mutation at the same revision is running", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "m1", revision, "res1")
		prepared, err := w.prepare("m2", revision, "res1")
		if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusRunning, RunID: job.RunID}) {
			t.Fatalf("%+v %v", prepared, err)
		}
		if w.runCount(t) != 1 {
			t.Fatal("no second run may be created")
		}
	})

	t.Run("replays return the recorded outcome", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "saved", revision, "res1")
		if _, err := w.finalize(job.RunID, outputFor("res2")); err != nil {
			t.Fatal(err)
		}
		// The saved run changed the revision and baseline, yet its retry still answers saved.
		prepared, err := w.prepare("saved", revision, "res1")
		if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusSaved, RunID: job.RunID, ResultID: "res2"}) {
			t.Fatalf("saved replay: %+v %v", prepared, err)
		}
		revision = w.revision(t)
		for mutation, want := range map[string]struct {
			code   string
			status RunStatus
		}{
			"bad-input": {"invalid_input", RunStatusInvalidInput},
			"slow":      {"timed_out", RunStatusTimedOut},
			"crashed":   {"solver_failed", RunStatusFailed},
			"internal":  {"internal_failure", RunStatusFailed},
		} {
			failedRun := f.recordedFailureRun(t, w, mutation, revision, want.code)
			prepared, err := w.prepare(mutation, revision, "res2")
			if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: want.status, RunID: failedRun}) {
				t.Fatalf("%s replay: %+v %v", mutation, prepared, err)
			}
		}
		// A stale run replays as stale with its ID.
		stale := w.mustSolve(t, "stale-run", revision, "res2")
		f.exec(t, "UPDATE public.active_shifts SET updated_at = updated_at + interval '1 second' WHERE id = $1", w.shift)
		if response, err := w.finalize(stale.RunID, outputFor("res3")); err != nil || response.Status != RunStatusStale {
			t.Fatalf("%+v %v", response, err)
		}
		prepared, err = w.prepare("stale-run", revision, "res2")
		if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusStale, RunID: stale.RunID}) {
			t.Fatalf("stale replay: %+v %v", prepared, err)
		}
	})

	t.Run("concurrent duplicates create one run", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		const callers = 8
		var wg sync.WaitGroup
		results := make([]PreparedRun, callers)
		errs := make([]error, callers)
		for i := 0; i < callers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				results[i], errs[i] = w.prepare("same", revision, "res1")
			}()
		}
		wg.Wait()
		solves := 0
		for i := range results {
			if errs[i] != nil {
				t.Fatalf("caller %d: %v", i, errs[i])
			}
			if results[i].Solve != nil {
				solves++
			} else if results[i].Response == nil || results[i].Response.Status != RunStatusRunning || results[i].Response.RunID == "" {
				t.Fatalf("caller %d: %+v", i, results[i].Response)
			}
		}
		if solves != 1 || w.runCount(t) != 1 {
			t.Fatalf("solves=%d runs=%d, want one of each", solves, w.runCount(t))
		}
	})
}

// recordedFailureRun prepares a run and records the failure code on it.
func (f *accessFixture) recordedFailureRun(t *testing.T, w world, mutation string, revision time.Time, code string) string {
	t.Helper()
	job := w.mustSolve(t, mutation, revision, "res2")
	if err := f.store.FailAssignmentRun(contextForTest(), w.caller(), job.RunID, code); err != nil {
		t.Fatal(err)
	}
	return job.RunID
}

func TestAssignmentRunLeaseIntegration(t *testing.T) {
	f := openAccessFixture(t)

	t.Run("a young run is still running", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "m1", revision, "res1")
		f.exec(t, "UPDATE public.optimizer_runs SET started_at = now() - interval '140 seconds' WHERE id = $1", job.RunID)
		prepared, err := w.prepare("m1", revision, "res1")
		if err != nil || prepared.Response == nil || prepared.Response.Status != RunStatusRunning {
			t.Fatalf("%+v %v", prepared, err)
		}
	})

	t.Run("an expired run is reclaimed when it still matches", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "m1", revision, "res1")
		f.exec(t, "UPDATE public.optimizer_runs SET started_at = now() - interval '151 seconds', outcome_summary = '{\"old\":true}' WHERE id = $1", job.RunID)
		reclaimed, err := w.prepare("m1", revision, "res1")
		if err != nil || reclaimed.Solve == nil || reclaimed.Solve.RunID != job.RunID || len(reclaimed.Solve.ShiftSnapshot) == 0 {
			t.Fatalf("%+v %v", reclaimed, err)
		}
		row := w.runRow(t, job.RunID)
		if row.status != "running" || row.summary != "{}" || time.Since(row.started) > time.Minute {
			t.Fatalf("a reclaimed run restarts its clock and clears its summary: %+v", row)
		}
		if w.runCount(t) != 1 {
			t.Fatal("reclaiming must not create a run")
		}
	})

	t.Run("an expired run is stale when the shift moved on", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "m1", revision, "res1")
		f.exec(t, "UPDATE public.optimizer_runs SET started_at = now() - interval '151 seconds' WHERE id = $1", job.RunID)
		f.exec(t, "UPDATE public.active_shifts SET updated_at = updated_at + interval '1 second' WHERE id = $1", w.shift)
		prepared, err := w.prepare("m1", revision, "res1")
		if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusStale, RunID: job.RunID}) {
			t.Fatalf("%+v %v", prepared, err)
		}
		row := w.runRow(t, job.RunID)
		if row.status != "stale" || !row.completed || w.errorCode(t, job.RunID) != "stale" {
			t.Fatalf("%+v", row)
		}
	})
}

// release marks a run as "solver never reached".
func (w world) release(t *testing.T, runID string) {
	t.Helper()
	if err := w.f.store.ReleaseAssignmentRun(contextForTest(), w.caller(), runID); err != nil {
		t.Fatal(err)
	}
}

func TestAssignmentRunReleaseIntegration(t *testing.T) {
	f := openAccessFixture(t)

	t.Run("a released run is reclaimed at once by the same mutation", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "m1", revision, "res1")
		w.release(t, job.RunID)
		row := w.runRow(t, job.RunID)
		if row.status != "running" || row.completed || w.errorCode(t, job.RunID) != "solver_unreachable" {
			t.Fatalf("a released run stays running with a note: %+v", row)
		}
		f.exec(t, "UPDATE public.optimizer_runs SET started_at = now() - interval '60 seconds' WHERE id = $1", job.RunID)
		again := w.mustSolve(t, "m1", revision, "res1")
		if again.RunID != job.RunID || w.runCount(t) != 1 {
			t.Fatalf("expected the same run, got %q (runs %d)", again.RunID, w.runCount(t))
		}
		row = w.runRow(t, job.RunID)
		if row.status != "running" || row.summary != "{}" || time.Since(row.started) > 30*time.Second {
			t.Fatalf("a reclaimed run restarts its clock and clears its summary: %+v", row)
		}
	})

	t.Run("a released run is stale when the shift moved on", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "m1", revision, "res1")
		w.release(t, job.RunID)
		f.exec(t, "UPDATE public.active_shifts SET updated_at = updated_at + interval '1 second' WHERE id = $1", w.shift)
		prepared, err := w.prepare("m1", revision, "res1")
		if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusStale, RunID: job.RunID}) {
			t.Fatalf("%+v %v", prepared, err)
		}
		if row := w.runRow(t, job.RunID); row.status != "stale" || !row.completed {
			t.Fatalf("%+v", row)
		}
	})

	t.Run("releasing a run that already ended changes nothing", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		job := w.mustSolve(t, "m1", w.revision(t), "res1")
		if err := f.store.FailAssignmentRun(contextForTest(), w.caller(), job.RunID, "timed_out"); err != nil {
			t.Fatal(err)
		}
		w.release(t, job.RunID)
		if row := w.runRow(t, job.RunID); row.status != "failed" || w.errorCode(t, job.RunID) != "timed_out" {
			t.Fatalf("%+v", row)
		}
	})

	t.Run("a run without the marker is still running within the lease", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "m1", revision, "res1")
		prepared, err := w.prepare("m1", revision, "res1")
		if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusRunning, RunID: job.RunID}) {
			t.Fatalf("%+v %v", prepared, err)
		}
	})

	t.Run("a different mutation still waits behind a released run", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		revision := w.revision(t)
		job := w.mustSolve(t, "m1", revision, "res1")
		w.release(t, job.RunID)
		prepared, err := w.prepare("m2", revision, "res1")
		if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusRunning, RunID: job.RunID}) {
			t.Fatalf("%+v %v", prepared, err)
		}
	})
}

func TestAssignmentRunFinalizeIntegration(t *testing.T) {
	f := openAccessFixture(t)

	t.Run("invalid output fails the run and leaves the shift alone", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		job := w.mustSolve(t, "m1", w.revision(t), "res1")
		state := w.shiftState(t)
		bad := outputFor("res2")
		bad.AssignmentResult = json.RawMessage(strings.Replace(string(bad.AssignmentResult), `"bedId":"b2"`, `"bedId":"b1"`, 1))
		response, err := w.finalize(job.RunID, bad)
		if err != nil || response != (RunResponse{Status: RunStatusFailed, RunID: job.RunID}) {
			t.Fatalf("%+v %v", response, err)
		}
		row := w.runRow(t, job.RunID)
		if row.status != "failed" || w.errorCode(t, job.RunID) != "duplicate_bed_assignment" || row.fingerprint != "fp-res2" || !row.completed {
			t.Fatalf("%+v code=%s", row, w.errorCode(t, job.RunID))
		}
		if w.shiftState(t) != state {
			t.Fatal("a failed run must not touch the shift")
		}
		// The failed run frees its slot: a new mutation at this revision can run.
		w.mustSolve(t, "m2", w.revision(t), "res1")
	})

	t.Run("malformed output is recorded as a failure", func(t *testing.T) {
		for name, mutate := range map[string]func(*solver.Output){
			"blank fingerprint": func(o *solver.Output) { o.InputFingerprint = "  " },
			"blank version":     func(o *solver.Output) { o.OptimizerVersion = "" },
			"blank result id":   func(o *solver.Output) { o.AssignmentResult = json.RawMessage(`{"id":" "}`) },
		} {
			w := newWorld(t, f, "[]")
			job := w.mustSolve(t, "m1", w.revision(t), "res1")
			state := w.shiftState(t)
			output := outputFor("res2")
			mutate(&output)
			response, err := w.finalize(job.RunID, output)
			if err != nil || response.Status != RunStatusFailed {
				t.Fatalf("%s: %+v %v", name, response, err)
			}
			if row := w.runRow(t, job.RunID); row.status != "failed" || !row.completed || row.fingerprint != "" {
				t.Fatalf("%s: the run must be failed, not left running: %+v", name, row)
			}
			if w.shiftState(t) != state {
				t.Fatalf("%s: shift changed", name)
			}
		}
	})

	t.Run("repeating a finalize is idempotent", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		job := w.mustSolve(t, "m1", w.revision(t), "res1")
		if _, err := w.finalize(job.RunID, outputFor("res2")); err != nil {
			t.Fatal(err)
		}
		state := w.shiftState(t)
		again, err := w.finalize(job.RunID, outputFor("res2"))
		if err != nil || again != (RunResponse{Status: RunStatusSaved, RunID: job.RunID, ResultID: "res2"}) {
			t.Fatalf("%+v %v", again, err)
		}
		different := outputFor("res2")
		different.OptimizerVersion = "v2"
		if response, err := w.finalize(job.RunID, different); err != nil || response.Status != RunStatusFailed {
			t.Fatalf("%+v %v", response, err)
		}
		if w.shiftState(t) != state {
			t.Fatal("a repeated finalize must not write again")
		}
	})

	t.Run("an ended shift makes the run stale", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		job := w.mustSolve(t, "m1", w.revision(t), "res1")
		f.exec(t, "UPDATE public.active_shifts SET ended_at = now() WHERE id = $1", w.shift)
		if response, err := w.finalize(job.RunID, outputFor("res2")); err != nil || response.Status != RunStatusStale {
			t.Fatalf("%+v %v", response, err)
		}
	})
}

func TestAssignmentRunFailIntegration(t *testing.T) {
	f := openAccessFixture(t)
	w := newWorld(t, f, "[]")
	job := w.mustSolve(t, "m1", w.revision(t), "res1")

	if err := f.store.FailAssignmentRun(contextForTest(), w.caller(), job.RunID, "  "); err != nil || w.runRow(t, job.RunID).status != "running" {
		t.Fatalf("a blank code must change nothing: %v", err)
	}
	if err := f.store.FailAssignmentRun(contextForTest(), w.caller(), job.RunID, "timed_out"); err != nil {
		t.Fatal(err)
	}
	row := w.runRow(t, job.RunID)
	if row.status != "failed" || w.errorCode(t, job.RunID) != "timed_out" || !row.completed || !row.duration.Valid {
		t.Fatalf("%+v", row)
	}
	// A run that already ended is left alone.
	if err := f.store.FailAssignmentRun(contextForTest(), w.caller(), job.RunID, "solver_failed"); err != nil || w.errorCode(t, job.RunID) != "timed_out" {
		t.Fatalf("a second failure must not overwrite the first: %v", err)
	}
	if err := f.store.FailAssignmentRun(contextForTest(), w.caller(), "00000000-0000-4000-8000-000000000000", "timed_out"); err != nil {
		t.Fatalf("an unknown run is a quiet no-op: %v", err)
	}
}

func TestAssignmentRunOwnershipIntegration(t *testing.T) {
	f := openAccessFixture(t)
	w := newWorld(t, f, "[]")
	job := w.mustSolve(t, "m1", w.revision(t), "res1")
	stranger := f.newProfile(t, "Stranger")
	strangerCaller := RunCaller{AuthUserID: stranger.AuthUserID, ProfileID: stranger.ID}
	request := RunRequest{ClientMutationID: "m1", ExpectedRevision: w.revision(t), ExpectedBaseline: "res1"}

	if _, err := f.store.PrepareAssignmentRun(contextForTest(), strangerCaller, w.shift, request); !errors.Is(err, ErrShiftNotFound) {
		t.Fatalf("a foreign shift must be forbidden: %v", err)
	}
	if _, err := f.store.PrepareAssignmentRun(contextForTest(), w.caller(), "00000000-0000-4000-8000-000000000000", request); !errors.Is(err, ErrShiftNotFound) {
		t.Fatalf("a missing shift must be forbidden: %v", err)
	}
	if w.runCount(t) != 1 {
		t.Fatal("a refused request must not create a run")
	}

	// A stranger can neither read the run nor change it.
	var visible int64
	err := f.store.WithIdentity(contextForTest(), stranger.AuthUserID, func(tx *gorm.DB) error {
		return tx.Model(&OptimizerRun{}).Where("shift_id = ?", w.shift).Count(&visible).Error
	})
	if err != nil || visible != 0 {
		t.Fatalf("row security must hide the run: visible=%d err=%v", visible, err)
	}
	state := w.shiftState(t)
	if response, err := f.store.FinalizeAssignmentRun(contextForTest(), strangerCaller, job.RunID, outputFor("res2")); err != nil || response.Status != RunStatusFailed {
		t.Fatalf("%+v %v", response, err)
	}
	if err := f.store.FailAssignmentRun(contextForTest(), strangerCaller, job.RunID, "timed_out"); err != nil {
		t.Fatal(err)
	}
	if w.runRow(t, job.RunID).status != "running" || w.shiftState(t) != state {
		t.Fatal("a stranger changed the run or the shift")
	}

	// Go never gets to delete or edit identity columns of a run.
	err = f.store.WithWriteIdentity(contextForTest(), w.charge.AuthUserID, func(tx *gorm.DB) error {
		return tx.Exec("DELETE FROM public.optimizer_runs WHERE id = ?", job.RunID).Error
	})
	if err == nil {
		t.Fatal("deleting a run must be denied")
	}
	err = f.store.WithWriteIdentity(contextForTest(), w.charge.AuthUserID, func(tx *gorm.DB) error {
		return tx.Exec("UPDATE public.optimizer_runs SET requested_by_profile_id = ? WHERE id = ?", stranger.ID, job.RunID).Error
	})
	if err == nil {
		t.Fatal("changing the requester must be denied")
	}
}

// When two requests slip past the checks, the unique indexes decide. The index
// error is turned into "running" and the transaction stays usable.
func TestAssignmentRunUniqueIndexRaceIntegration(t *testing.T) {
	f := openAccessFixture(t)
	w := newWorld(t, f, "[]")
	revision := w.revision(t)
	// A finished run for the same mutation is invisible to the running-run check
	// but still trips the idempotency index.
	f.exec(t, `INSERT INTO public.optimizer_runs (shift_id, requested_by_profile_id, client_mutation_id, expected_shift_revision,
		expected_baseline_assignment_result_id, request_fingerprint, status, result_id, completed_at)
		VALUES ($1, $2, 'm1', $3, 'res1', 'other-fingerprint', 'succeeded', 'old', now())`, w.shift, w.charge.ID, revision)

	var prepared PreparedRun
	err := f.store.WithWriteIdentity(contextForTest(), w.charge.AuthUserID, func(tx *gorm.DB) error {
		shift, err := lockOwnedShift(tx, w.charge.ID, w.shift)
		if err != nil {
			return err
		}
		prepared, err = insertRun(tx, w.charge.ID, &shift, "m1", "res1", "fingerprint")
		if err != nil {
			return err
		}
		var one int
		return tx.Raw("SELECT 1").Row().Scan(&one) // the transaction must still work
	})
	if err != nil || prepared.Response == nil || *prepared.Response != (RunResponse{Status: RunStatusRunning}) {
		t.Fatalf("%+v %v", prepared, err)
	}
	if w.runCount(t) != 1 {
		t.Fatal("the losing insert must leave no run behind")
	}
}

// The row locks Prepare and Finalize take, spelled out for the tests.
const (
	lockRunSQL   = "SELECT 1 FROM public.optimizer_runs WHERE id = $1 FOR UPDATE"
	lockShiftSQL = "SELECT 1 FROM public.active_shifts WHERE id = $1 FOR UPDATE"
)

func isDeadlock(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "40P01"
}

func TestAssignmentRunPrepareFinalizeRaceIntegration(t *testing.T) {
	f := openAccessFixture(t)

	// What this proves: when the original request is saving its answer (finalize) at
	// the very moment a retry of the same request arrives (prepare), the two never
	// get stuck waiting on each other. Both take the run's lock first and the shift's
	// lock second, so one simply waits its turn. We hold the run's lock ourselves,
	// let both requests pile up behind it, then release it so they collide. Whoever
	// wins, the retry must get a consistent answer: "saved" with the same ids if
	// finalize went first, or "running" if the retry went first.
	t.Run("a retry racing finalize never deadlocks", func(t *testing.T) {
		const iterations = 20
		savedCount, runningCount := 0, 0
		for i := 0; i < iterations; i++ {
			w := newWorld(t, f, "[]")
			mutation := "race-" + string(rune('a'+i))
			resultID := "race-res-" + string(rune('a'+i))
			revision := w.revision(t)
			job := w.mustSolve(t, mutation, revision, "res1")

			gate, err := f.admin.Begin()
			if err != nil {
				t.Fatal(err)
			}
			if _, err := gate.Exec(lockRunSQL, job.RunID); err != nil {
				gate.Rollback()
				t.Fatal(err)
			}

			start := make(chan struct{})
			var wg sync.WaitGroup
			var finalized RunResponse
			var finalizeErr error
			var retried PreparedRun
			var retryErr error
			wg.Add(2)
			go func() {
				defer wg.Done()
				<-start
				finalized, finalizeErr = w.finalize(job.RunID, outputFor(resultID))
			}()
			go func() {
				defer wg.Done()
				<-start
				retried, retryErr = w.prepare(mutation, revision, "res1")
			}()
			close(start)
			time.Sleep(100 * time.Millisecond) // both are now blocked on the gate's lock
			if err := gate.Commit(); err != nil {
				t.Fatal(err)
			}

			done := make(chan struct{})
			go func() { wg.Wait(); close(done) }()
			select {
			case <-done:
			case <-time.After(10 * time.Second):
				t.Fatalf("iteration %d: finalize and the retry did not finish in 10s: possible deadlock", i)
			}

			for name, err := range map[string]error{"finalize": finalizeErr, "retry prepare": retryErr} {
				if err == nil {
					continue
				}
				if isDeadlock(err) {
					t.Fatalf("iteration %d: %s hit a deadlock (40P01): %v", i, name, err)
				}
				t.Fatalf("iteration %d: %s failed: %v", i, name, err)
			}
			if finalized.Status != RunStatusSaved || finalized.ResultID != resultID || finalized.RunID != job.RunID {
				t.Fatalf("iteration %d: finalize answered %+v", i, finalized)
			}
			if retried.Response == nil {
				t.Fatalf("iteration %d: the retry must not start a second solve: %+v", i, retried)
			}
			switch got := *retried.Response; {
			case got == finalized:
				savedCount++
			case got == RunResponse{Status: RunStatusRunning, RunID: job.RunID}:
				runningCount++
			default:
				t.Fatalf("iteration %d: the retry answered %+v, want saved %+v or running", i, got, finalized)
			}

			if w.runCount(t) != 1 {
				t.Fatalf("iteration %d: want exactly one run, got %d", i, w.runCount(t))
			}
			if row := w.runRow(t, job.RunID); row.status != "succeeded" || row.resultID != resultID {
				t.Fatalf("iteration %d: run row %+v", i, row)
			}
			if f.text(t, "SELECT status FROM public.active_shifts WHERE id = $1", w.shift) != "assigned" ||
				!strings.Contains(f.text(t, "SELECT shift_snapshot::text FROM public.active_shifts WHERE id = $1", w.shift), `"id": "`+resultID+`"`) {
				t.Fatalf("iteration %d: the shift does not hold result %s", i, resultID)
			}
		}
		t.Logf("retry saw saved (finalize won the lock): %d, running (prepare won the lock): %d, of %d", savedCount, runningCount, iterations)
	})

	// What this proves: the lock order matters. If one request locked the run then
	// the shift while another locked the shift then the run, each would wait forever
	// for the other. Postgres notices (deadlock_detected, SQLSTATE 40P01) and aborts
	// one of them. This is the failure the real code avoids by always going run first.
	t.Run("the opposite lock order would deadlock", func(t *testing.T) {
		w := newWorld(t, f, "[]")
		job := w.mustSolve(t, "deadlock-demo", w.revision(t), "res1")
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second) // far above deadlock_timeout (1s)
		defer cancel()

		tx1, err := f.admin.BeginTx(ctx, nil)
		if err != nil {
			t.Fatal(err)
		}
		defer tx1.Rollback()
		tx2, err := f.admin.BeginTx(ctx, nil)
		if err != nil {
			t.Fatal(err)
		}
		defer tx2.Rollback()
		if _, err := tx1.ExecContext(ctx, lockRunSQL, job.RunID); err != nil {
			t.Fatal(err)
		}
		if _, err := tx2.ExecContext(ctx, lockShiftSQL, w.shift); err != nil {
			t.Fatal(err)
		}

		tx1Err := make(chan error, 1)
		go func() {
			_, err := tx1.ExecContext(ctx, lockShiftSQL, w.shift) // blocks: tx2 holds the shift
			if err != nil {
				tx1.Rollback() // an aborted transaction must let go so the other can finish
			}
			tx1Err <- err
		}()
		time.Sleep(200 * time.Millisecond)
		_, err2 := tx2.ExecContext(ctx, lockRunSQL, job.RunID) // closes the circle
		if err2 != nil {
			tx2.Rollback()
		}
		err1 := <-tx1Err

		if !isDeadlock(err1) && !isDeadlock(err2) {
			t.Fatalf("expected Postgres to abort one transaction with 40P01: tx1=%v tx2=%v", err1, err2)
		}
		if isDeadlock(err1) && isDeadlock(err2) {
			t.Fatalf("expected exactly one victim: tx1=%v tx2=%v", err1, err2)
		}
		t.Logf("deadlock detected as expected: tx1=%v | tx2=%v", err1, err2)
	})
}

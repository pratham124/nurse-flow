import assert from "node:assert/strict";
import test from "node:test";

import {
  OptimizerRepositoryError,
  parseAssignmentOptimizerResponse,
  requestAssignmentOptimization,
} from "../src/services/optimizerRepository.ts";

function createSupabase(accessToken = "test-access-token") {
  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: accessToken ? { access_token: accessToken } : null,
          },
          error: null,
        };
      },
    },
  };
}

test("sends only optimizer action fields with the signed-in bearer token", async () => {
  let capturedRequest;
  const result = await requestAssignmentOptimization(
    createSupabase(),
    {
      clientMutationId: "mutation-1",
      expectedShiftRevision: "2026-08-23T12:00:00.000Z",
      shiftId: "shift-1",
    },
    {
      baseUrl: "https://optimizer.example/",
      async fetchImplementation(url, options) {
        capturedRequest = { options, url };
        return {
          async json() {
            return {
              resultId: "result-1",
              runId: "run-1",
              status: "saved",
            };
          },
          status: 200,
        };
      },
    },
  );

  assert.deepEqual(result, {
    resultId: "result-1",
    runId: "run-1",
    status: "saved",
  });
  assert.equal(
    capturedRequest.url,
    "https://optimizer.example/v1/assignment-runs",
  );
  assert.equal(
    capturedRequest.options.headers.Authorization,
    "Bearer test-access-token",
  );
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    clientMutationId: "mutation-1",
    expectedBaselineAssignmentResultId: null,
    expectedShiftRevision: "2026-08-23T12:00:00.000Z",
    shiftId: "shift-1",
  });
  assert.equal("nextShift" in JSON.parse(capturedRequest.options.body), false);
  assert.equal(
    "assignmentResult" in JSON.parse(capturedRequest.options.body),
    false,
  );
});

test("includes the prior baseline only when a rerun supplies it", async () => {
  let requestBody;

  await requestAssignmentOptimization(
    createSupabase(),
    {
      clientMutationId: "mutation-2",
      expectedBaselineAssignmentResultId: "baseline-1",
      expectedShiftRevision: "revision-2",
      shiftId: "shift-1",
    },
    {
      baseUrl: "https://optimizer.example",
      async fetchImplementation(_url, options) {
        requestBody = JSON.parse(options.body);
        return {
          async json() {
            return { runId: "run-2", status: "stale" };
          },
          status: 409,
        };
      },
    },
  );

  assert.equal(
    requestBody.expectedBaselineAssignmentResultId,
    "baseline-1",
  );
});

test("accepts every frozen app-facing outcome with its matching HTTP status", () => {
  const scenarios = [
    [409, { status: "stale" }],
    [422, { runId: "run-1", status: "invalid_input" }],
    [504, { runId: "run-1", status: "timed_out" }],
    [503, { runId: "run-1", status: "unavailable" }],
    [500, { runId: "run-1", status: "failed" }],
  ];

  for (const [httpStatus, response] of scenarios) {
    assert.deepEqual(
      parseAssignmentOptimizerResponse(httpStatus, response),
      response,
    );
  }
});

test("rejects malformed or contradictory service responses", () => {
  assert.throws(
    () => parseAssignmentOptimizerResponse(200, { status: "saved" }),
    OptimizerRepositoryError,
  );
  assert.throws(
    () =>
      parseAssignmentOptimizerResponse(500, {
        resultId: "invented-result",
        status: "failed",
      }),
    OptimizerRepositoryError,
  );
  assert.throws(
    () => parseAssignmentOptimizerResponse(200, { status: "mystery" }),
    OptimizerRepositoryError,
  );
  assert.throws(
    () => parseAssignmentOptimizerResponse(200, "saved"),
    OptimizerRepositoryError,
  );
  assert.throws(
    () => parseAssignmentOptimizerResponse(200, { status: "stale" }),
    OptimizerRepositoryError,
  );
});

test("normalizes a mutation conflict to stale so the app refreshes", () => {
  assert.deepEqual(
    parseAssignmentOptimizerResponse(409, {
      runId: "run-conflict",
      status: "conflict",
    }),
    { runId: "run-conflict", status: "stale" },
  );
});

test("rejects malformed JSON returned by a reachable service", async () => {
  await assert.rejects(
    requestAssignmentOptimization(
      createSupabase(),
      {
        clientMutationId: "mutation-malformed",
        expectedShiftRevision: "revision-malformed",
        shiftId: "shift-1",
      },
      {
        baseUrl: "https://optimizer.example",
        async fetchImplementation() {
          return {
            async json() {
              throw new SyntaxError("Unexpected token");
            },
            status: 200,
          };
        },
      },
    ),
    OptimizerRepositoryError,
  );
});

test("turns a transport failure into the safe unavailable outcome", async () => {
  const result = await requestAssignmentOptimization(
    createSupabase(),
    {
      clientMutationId: "mutation-3",
      expectedShiftRevision: "revision-3",
      shiftId: "shift-1",
    },
    {
      baseUrl: "https://optimizer.example",
      async fetchImplementation() {
        throw new TypeError("Network request failed");
      },
    },
  );

  assert.deepEqual(result, { status: "unavailable" });
});

test("requires a signed-in session before contacting the optimizer", async () => {
  await assert.rejects(
    requestAssignmentOptimization(
      createSupabase(""),
      {
        clientMutationId: "mutation-4",
        expectedShiftRevision: "revision-4",
        shiftId: "shift-1",
      },
      { baseUrl: "https://optimizer.example" },
    ),
    OptimizerRepositoryError,
  );
});

test("rejects a blank rerun baseline instead of weakening it to an initial run", async () => {
  await assert.rejects(
    requestAssignmentOptimization(
      createSupabase(),
      {
        clientMutationId: "mutation-5",
        expectedBaselineAssignmentResultId: "   ",
        expectedShiftRevision: "revision-5",
        shiftId: "shift-1",
      },
      { baseUrl: "https://optimizer.example" },
    ),
    OptimizerRepositoryError,
  );
});

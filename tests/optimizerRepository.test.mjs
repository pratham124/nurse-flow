import assert from "node:assert/strict";
import { AxiosError } from "axios";
import test, { afterEach, mock } from "node:test";

import { goApiClient } from "../src/services/goApiClient.ts";

import {
  OptimizerRepositoryError,
  parseAssignmentOptimizerResponse,
  requestAssignmentOptimization,
} from "../src/services/optimizerRepository.ts";

afterEach(() => mock.restoreAll());

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

const baseInput = {
  clientMutationId: "mutation-1",
  expectedShiftRevision: "2026-08-23T12:00:00.000Z",
  shiftId: "shift-1",
};

test("posts the run request to the Go API with the bearer token and long timeout", async () => {
  let captured;
  mock.method(goApiClient, "post", async (url, body, config) => {
    captured = { body, config, url };
    return { status: 200, data: { resultId: "result-1", runId: "run-1", status: "saved" } };
  });

  const result = await requestAssignmentOptimization(createSupabase(), baseInput);

  assert.deepEqual(result, { resultId: "result-1", runId: "run-1", status: "saved" });
  assert.equal(captured.url, "/active-shifts/shift-1/assignment-runs");
  assert.equal(captured.config.headers.Authorization, "Bearer test-access-token");
  assert.equal(captured.config.timeout, 150_000);
  assert.equal(captured.config.validateStatus(500), true);
  assert.deepEqual(captured.body, {
    clientMutationId: "mutation-1",
    expectedBaselineAssignmentResultId: null,
    expectedShiftRevision: "2026-08-23T12:00:00.000Z",
  });
});

test("includes the prior baseline only when a rerun supplies it", async () => {
  let requestBody;
  mock.method(goApiClient, "post", async (_url, body) => {
    requestBody = body;
    return { status: 409, data: { runId: "run-2", status: "stale" } };
  });

  await requestAssignmentOptimization(createSupabase(), {
    ...baseInput,
    expectedBaselineAssignmentResultId: "baseline-1",
  });

  assert.equal(requestBody.expectedBaselineAssignmentResultId, "baseline-1");
});

test("maps every Go response status through the parser", async () => {
  const scenarios = [
    [409, { status: "stale" }, { status: "stale" }],
    [409, { runId: "r", status: "conflict" }, { runId: "r", status: "stale" }],
    [422, { runId: "r", status: "invalid_input" }, { runId: "r", status: "invalid_input" }],
    [413, { status: "invalid_input" }, { status: "invalid_input" }],
    [504, { runId: "r", status: "timed_out" }, { runId: "r", status: "timed_out" }],
    [503, { runId: "r", status: "unavailable" }, { runId: "r", status: "unavailable" }],
    [500, { runId: "r", status: "failed" }, { runId: "r", status: "failed" }],
  ];

  for (const [status, data, expected] of scenarios) {
    mock.restoreAll();
    mock.method(goApiClient, "post", async () => ({ status, data }));
    assert.deepEqual(await requestAssignmentOptimization(createSupabase(), baseInput), expected);
  }
});

test("a running response is an error and Go 401/403 envelopes keep their messages", async () => {
  for (const [status, data, message] of [
    [202, { status: "running" }, /still calculating/],
    [401, { error: { code: "unauthorized", message: "no" } }, /session expired/],
    [403, { error: { code: "forbidden", message: "no" } }, /cannot run assignment/],
  ]) {
    mock.restoreAll();
    mock.method(goApiClient, "post", async () => ({ status, data }));
    await assert.rejects(requestAssignmentOptimization(createSupabase(), baseInput), message);
  }
});

test("rejects an invalid saved result", async () => {
  mock.method(goApiClient, "post", async () => ({ status: 200, data: { status: "saved" } }));
  await assert.rejects(
    requestAssignmentOptimization(createSupabase(), baseInput),
    OptimizerRepositoryError,
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

test("normalizes response text while rejecting non-string and blank identifiers", () => {
  assert.deepEqual(parseAssignmentOptimizerResponse(200, {
    status: "saved", runId: " run ", resultId: " result ", futureField: true,
  }), { status: "saved", runId: "run", resultId: "result" });
  for (const runId of [null, 42, [], " "]) {
    assert.throws(() => parseAssignmentOptimizerResponse(409, { status: "stale", runId }),
      OptimizerRepositoryError);
  }
  assert.deepEqual(parseAssignmentOptimizerResponse(413, { status: "invalid_input" }),
    { status: "invalid_input" });
});

test("preserves session, authorization, and running response messages", () => {
  for (const [status, body, message] of [
    [401, {}, /session expired/],
    [403, {}, /cannot run assignment/],
    [202, { status: "running" }, /still calculating/],
  ]) {
    assert.throws(() => parseAssignmentOptimizerResponse(status, body), message);
  }
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

test("rejects a non-object body from a reachable service", async () => {
  mock.method(goApiClient, "post", async () => ({ status: 200, data: "<html>" }));
  await assert.rejects(
    requestAssignmentOptimization(createSupabase(), baseInput),
    OptimizerRepositoryError,
  );
});

test("turns a network failure or client timeout into the safe unavailable outcome", async () => {
  for (const code of ["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED"]) {
    mock.restoreAll();
    mock.method(goApiClient, "post", async () => {
      throw new AxiosError("no response", code);
    });
    assert.deepEqual(
      await requestAssignmentOptimization(createSupabase(), baseInput),
      { status: "unavailable" },
    );
  }
});

test("requires a signed-in session before contacting the Go API", async () => {
  mock.method(goApiClient, "post", async () => assert.fail("must not post"));
  await assert.rejects(
    requestAssignmentOptimization(createSupabase(""), baseInput),
    /session could not be loaded/,
  );
});

test("rejects a blank rerun baseline instead of weakening it to an initial run", async () => {
  mock.method(goApiClient, "post", async () => assert.fail("must not post"));
  await assert.rejects(
    requestAssignmentOptimization(createSupabase(), {
      ...baseInput,
      expectedBaselineAssignmentResultId: "   ",
    }),
    OptimizerRepositoryError,
  );
});

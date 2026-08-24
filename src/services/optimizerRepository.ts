import type { SupabaseClient } from "@supabase/supabase-js";

export type AssignmentOptimizerStatus =
  | "saved"
  | "stale"
  | "invalid_input"
  | "timed_out"
  | "unavailable"
  | "failed";

export type AssignmentOptimizerResult =
  | { resultId: string; runId: string; status: "saved" }
  | {
      runId?: string;
      status: Exclude<AssignmentOptimizerStatus, "saved">;
    };

export type RequestAssignmentOptimizationInput = {
  clientMutationId: string;
  expectedBaselineAssignmentResultId?: string;
  expectedShiftRevision: string;
  shiftId: string;
};

type RequestAssignmentOptimizationOptions = {
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
};

type OptimizerResponseBody = Record<string, unknown>;

const optimizerPath = "/v1/assignment-runs";
const responseStatuses = new Set<AssignmentOptimizerStatus>([
  "saved",
  "stale",
  "invalid_input",
  "timed_out",
  "unavailable",
  "failed",
]);

export class OptimizerRepositoryError extends Error {}

function requireText(value: string, fieldName: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new OptimizerRepositoryError(`${fieldName} is required.`);
  }

  return normalizedValue;
}

function getOptionalText(body: OptimizerResponseBody, fieldName: string) {
  const value = body[fieldName];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new OptimizerRepositoryError(
      "The assignment service returned an invalid response.",
    );
  }

  return value.trim();
}

function isResponseStatus(value: unknown): value is AssignmentOptimizerStatus {
  return (
    typeof value === "string" &&
    responseStatuses.has(value as AssignmentOptimizerStatus)
  );
}

function hasExpectedHttpStatus(
  status: AssignmentOptimizerStatus,
  httpStatus: number,
) {
  switch (status) {
    case "saved":
      return httpStatus === 200;
    case "stale":
      return httpStatus === 409;
    case "invalid_input":
      return httpStatus === 413 || httpStatus === 422;
    case "timed_out":
      return httpStatus === 504;
    case "unavailable":
      return httpStatus === 503;
    case "failed":
      return httpStatus === 500;
  }
}

export function parseAssignmentOptimizerResponse(
  httpStatus: number,
  value: unknown,
): AssignmentOptimizerResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OptimizerRepositoryError(
      "The assignment service returned an invalid response.",
    );
  }

  const body = value as OptimizerResponseBody;

  if (!isResponseStatus(body.status)) {
    if (httpStatus === 401) {
      throw new OptimizerRepositoryError(
        "Your session expired. Sign in again before running assignment.",
      );
    }

    if (httpStatus === 403) {
      throw new OptimizerRepositoryError(
        "This account cannot run assignment for the current shift.",
      );
    }

    if (body.status === "conflict" && httpStatus === 409) {
      const runId = getOptionalText(body, "runId");

      return {
        ...(runId ? { runId } : {}),
        status: "stale",
      };
    }

    if (body.status === "running" && httpStatus === 202) {
      throw new OptimizerRepositoryError(
        "This assignment request is still calculating. Wait a moment and try again.",
      );
    }

    throw new OptimizerRepositoryError(
      "The assignment service returned an invalid response.",
    );
  }

  if (!hasExpectedHttpStatus(body.status, httpStatus)) {
    throw new OptimizerRepositoryError(
      "The assignment service returned an invalid response.",
    );
  }

  const runId = getOptionalText(body, "runId");
  const resultId = getOptionalText(body, "resultId");

  if (body.status === "saved") {
    if (!runId || !resultId) {
      throw new OptimizerRepositoryError(
        "The assignment service returned an invalid saved result.",
      );
    }

    return {
      resultId,
      runId,
      status: "saved",
    };
  }

  if (resultId) {
    throw new OptimizerRepositoryError(
      "The assignment service returned an invalid response.",
    );
  }

  return {
    ...(runId ? { runId } : {}),
    status: body.status,
  };
}

function getOptimizerBaseUrl(override?: string) {
  const baseUrl = override ?? process.env.EXPO_PUBLIC_OPTIMIZER_SERVICE_URL;

  if (!baseUrl?.trim()) {
    throw new OptimizerRepositoryError(
      "Add EXPO_PUBLIC_OPTIMIZER_SERVICE_URL before running assignment.",
    );
  }

  return baseUrl.trim().replace(/\/+$/, "");
}

export async function requestAssignmentOptimization(
  supabase: SupabaseClient,
  input: RequestAssignmentOptimizationInput,
  options: RequestAssignmentOptimizationOptions = {},
): Promise<AssignmentOptimizerResult> {
  const shiftId = requireText(input.shiftId, "Shift ID");
  const clientMutationId = requireText(
    input.clientMutationId,
    "Client mutation ID",
  );
  const expectedShiftRevision = requireText(
    input.expectedShiftRevision,
    "Expected shift revision",
  );
  const expectedBaselineAssignmentResultId =
    input.expectedBaselineAssignmentResultId === undefined
      ? undefined
      : requireText(
          input.expectedBaselineAssignmentResultId,
          "Expected baseline assignment result ID",
        );
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new OptimizerRepositoryError(error.message);
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new OptimizerRepositoryError(
      "Sign in before running assignment.",
    );
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;

  let response: Response;

  try {
    response = await fetchImplementation(
      `${getOptimizerBaseUrl(options.baseUrl)}${optimizerPath}`,
      {
        body: JSON.stringify({
          clientMutationId,
          expectedBaselineAssignmentResultId:
            expectedBaselineAssignmentResultId ?? null,
          expectedShiftRevision,
          shiftId,
        }),
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
  } catch (error) {
    if (error instanceof OptimizerRepositoryError) {
      throw error;
    }

    return { status: "unavailable" };
  }

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    throw new OptimizerRepositoryError(
      "The assignment service returned an invalid response.",
    );
  }

  return parseAssignmentOptimizerResponse(response.status, responseBody);
}

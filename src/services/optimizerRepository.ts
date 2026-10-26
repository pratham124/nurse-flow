import type { SupabaseClient } from "@supabase/supabase-js";
import { isAxiosError } from "axios";
import { z } from "zod";

import { goApiClient } from "./goApiClient";
import { getGoAuthHeaders } from "./goApiAuth";

const optimizerStatusSchema = z.enum([
  "saved", "stale", "invalid_input", "timed_out", "unavailable", "failed",
]);
const responseEnvelopeSchema = z.looseObject({ status: z.unknown().optional() });
const optionalResponseTextSchema = z.string().trim().min(1).optional();

export type AssignmentOptimizerStatus = z.infer<typeof optimizerStatusSchema>;

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

// The Go API waits for the optimizer, so this call outlives the client's 10 s default.
const assignmentRunTimeoutMs = 150_000;

export class OptimizerRepositoryError extends Error {}

function requireText(value: string, fieldName: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new OptimizerRepositoryError(`${fieldName} is required.`);
  }

  return normalizedValue;
}

function getOptionalText(value: unknown) {
  const result = optionalResponseTextSchema.safeParse(value);
  if (!result.success) {
    throw new OptimizerRepositoryError(
      "The assignment service returned an invalid response.",
    );
  }

  return result.data;
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
  const envelope = responseEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    throw new OptimizerRepositoryError(
      "The assignment service returned an invalid response.",
    );
  }

  const body = envelope.data;
  const status = optimizerStatusSchema.safeParse(body.status);

  if (!status.success) {
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
      const runId = getOptionalText(body.runId);

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

  if (!hasExpectedHttpStatus(status.data, httpStatus)) {
    throw new OptimizerRepositoryError(
      "The assignment service returned an invalid response.",
    );
  }

  const runId = getOptionalText(body.runId);
  const resultId = getOptionalText(body.resultId);

  if (status.data === "saved") {
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
    status: status.data,
  };
}

export async function requestAssignmentOptimization(
  supabase: SupabaseClient,
  input: RequestAssignmentOptimizationInput,
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
  const headers = await getGoAuthHeaders(supabase);

  try {
    // validateStatus lets 409/422/5xx come back as normal responses, because
    // the parser below maps every HTTP status to an app outcome.
    const response = await goApiClient.post<unknown>(
      `/active-shifts/${encodeURIComponent(shiftId)}/assignment-runs`,
      {
        clientMutationId,
        expectedBaselineAssignmentResultId:
          expectedBaselineAssignmentResultId ?? null,
        expectedShiftRevision,
      },
      {
        headers,
        timeout: assignmentRunTimeoutMs,
        validateStatus: () => true,
      },
    );

    return parseAssignmentOptimizerResponse(response.status, response.data);
  } catch (error) {
    // No response at all (offline, timeout, abort): keep the retry path open.
    if (isAxiosError(error)) {
      return { status: "unavailable" };
    }

    throw error;
  }
}

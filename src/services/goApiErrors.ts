import { isAxiosError } from "axios";
import { z } from "zod";

const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type GoApiFailure = {
  code: string;
  message: string;
  status: number;
};

// Reads the Go server's {"error":{"code","message"}} envelope from a failed
// request. Returns undefined when the failure never reached the server.
export function readGoApiFailure(error: unknown): GoApiFailure | undefined {
  if (!isAxiosError(error) || !error.response) {
    return undefined;
  }

  const envelope = errorEnvelopeSchema.safeParse(error.response.data);

  return {
    code: envelope.success ? envelope.data.error.code : "",
    message: envelope.success ? envelope.data.error.message : "",
    status: error.response.status,
  };
}

// Errors that never got a response (timeouts, offline) become one readable message.
export function throwGoNetworkError(error: unknown, serviceName: string): never {
  if (!isAxiosError(error)) {
    throw error;
  }

  if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
    throw new Error(`The ${serviceName} took too long. Try again.`);
  }

  throw new Error(
    `Could not reach the ${serviceName}. Check the API address and connection, then try again.`,
  );
}

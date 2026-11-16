type LogContext = {
  profileId?: string;
  recordId?: string;
  [key: string]: string | undefined;
};

type ErrorDetail = { code?: string; message?: string; details?: string };

function readErrorDetail(error: unknown): ErrorDetail {
  if (error === null || error === undefined) return {};
  if (typeof error !== "object") {
    return { message: String(error) };
  }
  const { code, message, details } = error as Record<string, unknown>;
  return {
    code: typeof code === "string" ? code : undefined,
    message: typeof message === "string" ? message : undefined,
    details: typeof details === "string" ? details : undefined,
  };
}

/**
 * Logs one structured line a Vercel log search can find: what failed, for whom
 * and on which record. Context carries ids only, never emails, phone numbers,
 * IC numbers or money amounts. Only the error's code, message and details are
 * copied, so a thrown object cannot drag other fields into the log.
 */
export function logServerError(
  message: string,
  error: unknown,
  context: LogContext = {},
): void {
  console.error(
    JSON.stringify({ message, context, error: readErrorDetail(error) }),
  );
}

/** The id Next puts on a server error so it can be matched to the server log; absent on client-side errors. */
export function errorDigest(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const { digest } = error as { digest?: unknown };
  return typeof digest === "string" ? digest : null;
}

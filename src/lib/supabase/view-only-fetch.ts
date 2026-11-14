/**
 * Every Supabase call from the server goes through this fetch, so it is the one place View as is
 * enforced: while the MD is viewing as someone, anything that could save is refused here, before
 * it leaves the server. Reads pass untouched, so the MD sees exactly what that person sees.
 */

export const VIEW_ONLY_MESSAGE = "View only – not saved.";
export const VIEW_ONLY_CODE = "VIEW_ONLY";

/**
 * Database functions that only read. supabase-js calls every function with POST, so a function is
 * refused while viewing unless it is listed here. A new read-only function that a page calls
 * belongs on this list; one that writes never does.
 */
const READ_ONLY_FUNCTIONS = new Set([
  "commission_basis",
  "my_team",
  "report_filers",
  "site_supervisors",
  "team_directory",
]);

/** Auth calls that only move this browser's own session: refresh, switch back, sign out. */
const SESSION_PATHS = new Set([
  "/auth/v1/token",
  "/auth/v1/verify",
  "/auth/v1/logout",
]);

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Whether a Supabase request could save something. */
export function couldSave(url: string, method: string): boolean {
  if (READ_METHODS.has(method.toUpperCase())) return false;
  const { pathname } = new URL(url);
  if (SESSION_PATHS.has(pathname)) return false;
  const rpc = pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/);
  return !(rpc?.[1] && READ_ONLY_FUNCTIONS.has(rpc[1]));
}

function refused(): Response {
  // Shaped like a PostgREST error so supabase-js hands it back as { error } like any other failure.
  return Response.json(
    {
      code: VIEW_ONLY_CODE,
      message: VIEW_ONLY_MESSAGE,
      details: null,
      hint: null,
    },
    { status: 403 },
  );
}

/** A fetch that refuses anything that could save while isViewing() says the MD is viewing as someone. */
export function viewOnlyFetch(
  isViewing: () => Promise<boolean>,
  send: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    // Read off the arguments rather than building a Request, which would use up a streamed body.
    const isRequest = input instanceof Request;
    const url = isRequest ? input.url : input.toString();
    const method = init?.method ?? (isRequest ? input.method : "GET");
    if (couldSave(url, method) && (await isViewing())) {
      return refused();
    }
    return send(input, init);
  };
}

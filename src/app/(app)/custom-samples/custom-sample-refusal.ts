/** The database words its own refusals ("This sample was given away."); a bare policy refusal says nothing useful. */
export function plainRefusal(error: { code?: string; message?: string }) {
  return error.code === "42501" &&
    error.message &&
    !/row-level security/i.test(error.message)
    ? error.message
    : null;
}

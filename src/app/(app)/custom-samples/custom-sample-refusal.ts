import { z } from "zod";

export const NOT_FOUND = "Could not find that sample. Reload the page.";
export const TRY_AGAIN = "Could not save. Try again.";

/** A sample id from the browser; a bad one reads as a sample that is gone. */
export const sampleId = z.uuid({ error: NOT_FOUND });

/** The database words its own refusals ("This sample was given away."); a bare policy refusal says nothing useful. */
export function plainRefusal(error: { code?: string; message?: string }) {
  return error.code === "42501" &&
    error.message &&
    !/row-level security/i.test(error.message)
    ? error.message
    : null;
}

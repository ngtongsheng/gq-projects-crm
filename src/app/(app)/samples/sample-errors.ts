export type SampleResult = { error: string | null };

export const NOT_EDITOR =
  "Only the people who look after samples can change them.";
export const NOT_FOUND_SAMPLE = "Could not find that sample. Reload the page.";
export const TRY_AGAIN = "Could not save. Try again.";

export type DbError = { code?: string; message?: string };

/** The database words its own refusals in plain English (check violations and "Only 1 pc at Best Link."). */
export const plainDbMessage = (error: DbError) =>
  error.code === "23514" && error.message ? error.message : null;

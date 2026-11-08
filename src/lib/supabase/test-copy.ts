// Example data and the dev role panel must only ever reach the test copy (docs/environments.md).
// The scripts import this too, so it stays free of app imports.
export const DEV_PROJECT_REF = "heobsflkmqwkesfgbehz";
export const PROD_PROJECT_REF = "jepoalodqfrgeddzpfgz";

/** The Supabase project ref in an API URL such as https://<ref>.supabase.co, or null. */
export function projectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const match = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Throws unless the URL is the test copy. Anything else, not just the live app, is refused. */
export function assertTestCopy(url: string): void {
  const ref = projectRefFromUrl(url);
  if (ref === PROD_PROJECT_REF) {
    throw new Error(
      "Refusing to run: this points at the live app. Example data goes to the test copy only.",
    );
  }
  if (ref !== DEV_PROJECT_REF) {
    throw new Error(
      `Refusing to run: ${url} is not the test copy (${DEV_PROJECT_REF}).`,
    );
  }
}

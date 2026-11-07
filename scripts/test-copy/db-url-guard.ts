import {
  DEV_PROJECT_REF,
  PROD_PROJECT_REF,
} from "../example-data/seed-guard.ts";

/**
 * The Supabase project ref a Postgres connection string points at, or null.
 * Pooler strings carry it in the user (`postgres.<ref>`), direct ones in the host (`db.<ref>.supabase.co`).
 */
export function projectRefFromDbUrl(dbUrl: string): string | null {
  try {
    const url = new URL(dbUrl);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
      return null;
    }
    const fromUser = /^postgres\.([a-z0-9]+)$/.exec(url.username);
    if (fromUser) return fromUser[1];
    const fromHost = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
    return fromHost ? fromHost[1] : null;
  } catch {
    return null;
  }
}

/** Throws unless the connection string is the test copy's. Never puts the string in the message: it holds the password. */
export function assertDevDbUrl(dbUrl: string): void {
  const ref = projectRefFromDbUrl(dbUrl);
  if (ref === PROD_PROJECT_REF) {
    throw new Error(
      "Refusing to run: this database is the live app. Only the test copy may be changed from here.",
    );
  }
  if (ref !== DEV_PROJECT_REF) {
    throw new Error(
      `Refusing to run: the database is not the test copy (${DEV_PROJECT_REF}).`,
    );
  }
}

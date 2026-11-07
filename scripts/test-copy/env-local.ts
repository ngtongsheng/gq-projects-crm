import { DEV_PROJECT_REF } from "../example-data/seed-guard.ts";

// Supavisor session-mode pooler of the test copy (Singapore). Reachable over IPv4, unlike the direct host.
const POOLER_HOST = "aws-0-ap-southeast-1.pooler.supabase.com";

export type TestCopySecrets = { secretKey: string; dbPassword: string };

const SECRET_KEY_START = /^(sb_secret_|eyJ)/;

/**
 * Splits what Tong Sheng sent (the secret key and the database password, in either order, any whitespace between)
 * into the two values. Error messages never include a value.
 */
export function parseTestCopyPaste(text: string): TestCopySecrets {
  const tokens = text
    .split(/\s+/)
    .map((token) => token.replace(/^[A-Z_]+=/, "").replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  const keys = tokens.filter((token) => SECRET_KEY_START.test(token));
  const rest = tokens.filter((token) => !SECRET_KEY_START.test(token));
  if (keys.length !== 1 || rest.length !== 1) {
    throw new Error(
      "Expected two values: the secret key (starts with sb_secret_) and the database password.",
    );
  }
  return { secretKey: keys[0], dbPassword: rest[0] };
}

export function buildDevDbUrl(dbPassword: string): string {
  return `postgresql://postgres.${DEV_PROJECT_REF}:${encodeURIComponent(dbPassword)}@${POOLER_HOST}:5432/postgres`;
}

/** Sets each variable in the .env text, keeping every other line as it was. */
export function mergeEnv(
  existing: string,
  entries: Record<string, string>,
): string {
  const lines = existing === "" ? [] : existing.replace(/\n$/, "").split("\n");
  for (const [name, value] of Object.entries(entries)) {
    const line = `${name}=${value}`;
    const at = lines.findIndex((l) => l.startsWith(`${name}=`));
    if (at === -1) lines.push(line);
    else lines[at] = line;
  }
  return `${lines.join("\n")}\n`;
}

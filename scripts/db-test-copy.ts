// Puts pending database changes on the test copy (gq-crm-dev) only. The guard exits before any connection
// unless the connection string is the test copy's.
//
// Usage: pnpm db:test-copy   (needs SUPABASE_DEV_DB_URL in .env.local, see the connect-test-copy skill)
import { spawnSync } from "node:child_process";
import { assertDevDbUrl } from "./test-copy/db-url-guard.ts";

const dbUrl = process.env.SUPABASE_DEV_DB_URL;
if (!dbUrl) {
  throw new Error(
    "Missing SUPABASE_DEV_DB_URL. Run the connect-test-copy skill first.",
  );
}
assertDevDbUrl(dbUrl);

const result = spawnSync(
  "pnpm",
  ["exec", "supabase", "db", "push", "--db-url", dbUrl, "--yes"],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);

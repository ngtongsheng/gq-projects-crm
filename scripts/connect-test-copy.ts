// One-time setup of Vicky's laptop for the test copy: checks the secret key against it, then writes
// SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DEV_DB_URL to .env.local (gitignored). Prints no secret.
// The two values Tong Sheng sent are read from stdin, in any order, so they never sit in a command line.
//
// Usage: pnpm connect:test-copy  (values on stdin, see the connect-test-copy skill)
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assertTestCopy } from "../src/lib/supabase/test-copy.ts";
import {
  buildDevDbUrl,
  mergeEnv,
  parseTestCopyPaste,
} from "./test-copy/env-local.ts";

const ENV_FILE = ".env.local";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_URL");
assertTestCopy(url);

const { secretKey, dbPassword } = parseTestCopyPaste(readFileSync(0, "utf8"));

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await supabase.auth.admin.listUsers({ perPage: 1 });
if (error) {
  throw new Error(
    "The secret key was not accepted by the test copy. Check it with Tong Sheng.",
  );
}

let existing = "";
try {
  existing = readFileSync(ENV_FILE, "utf8");
} catch {
  // First time: there is no file yet.
}
writeFileSync(
  ENV_FILE,
  mergeEnv(existing, {
    SUPABASE_SERVICE_ROLE_KEY: secretKey,
    SUPABASE_DEV_DB_URL: buildDevDbUrl(dbPassword),
  }),
  { mode: 0o600 },
);
console.log(
  `Connected: the secret key works on the test copy, saved to ${ENV_FILE}.`,
);

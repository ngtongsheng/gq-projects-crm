// Fills the test copy with fictional records for every module, and creates one test sign-in
// per demo person. Never the live app: the guard refuses anything but the test copy.
//
// Usage: pnpm seed:example   (needs .env.seed.dev, see docs/environments.md)
import { createClient } from "@supabase/supabase-js";
import { todayMyt } from "../src/lib/format/date.ts";
import { assertTestCopy } from "../src/lib/supabase/test-copy.ts";
import { buildExampleData } from "./example-data/dataset.ts";
import {
  insertExampleRows,
  removeExampleRows,
} from "./example-data/example-rows.ts";
import { ensureTestUsers } from "./example-data/test-users.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
assertTestCopy(url);

const supabase = createClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { people, signIns } = await ensureTestUsers(supabase);
const data = buildExampleData({ people, today: todayMyt() });

await removeExampleRows(supabase, data);
const counts = await insertExampleRows(supabase, data);

console.log("Example rows added:");
for (const [table, count] of Object.entries(counts)) {
  if (count > 0) console.log(`  ${table}: ${count}`);
}
console.log("\nTest sign-ins (passwords shown once, new on every run):");
for (const { fullName, email, password } of signIns) {
  console.log(`  ${fullName.padEnd(15)} ${email}  ${password}`);
}

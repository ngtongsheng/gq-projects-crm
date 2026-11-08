// Gives each job role's test sign-in on the test copy a new password and prints them. Nothing is saved.
// Never the live app: the guard refuses anything but the test copy.
//
// Usage: pnpm reset:sign-ins   (needs SUPABASE_SERVICE_ROLE_KEY in .env.local, see the connect-test-copy skill)
import { createClient } from "@supabase/supabase-js";
import { assertTestCopy } from "../src/lib/supabase/test-copy.ts";
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

const { signIns } = await ensureTestUsers(supabase);
console.log("Test sign-ins (new passwords, shown once):");
for (const { jobRole, email, password } of signIns) {
  console.log(`  ${jobRole.padEnd(9)} ${email}  ${password}`);
}

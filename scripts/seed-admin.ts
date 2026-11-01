// One-off: creates an admin user (the owner, Vicky). Not a migration, so no
// personal data lands in git. See docs/environments.md for usage.
//
// Usage: node --env-file=.env.development --env-file=.env.seed \
//   scripts/seed-admin.ts --email someone@example.com --name "Full Name"
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
  },
});
if (!values.email || !values.name) {
  throw new Error('Usage: --email someone@example.com --name "Full Name"');
}

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const password = randomBytes(12).toString("base64url");
const { data, error } = await supabase.auth.admin.createUser({
  email: values.email,
  password,
  email_confirm: true,
  user_metadata: { full_name: values.name },
});
if (error) throw new Error(`Could not create user: ${error.message}`);

// The trigger created the profile as staff; promote it.
const { error: roleError } = await supabase
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", data.user.id);
if (roleError)
  throw new Error(`User created but not promoted: ${roleError.message}`);

console.log(`Admin created: ${values.email}`);
console.log(`Temporary password (share privately, shown once): ${password}`);

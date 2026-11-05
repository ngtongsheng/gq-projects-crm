import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobRole } from "../../src/lib/auth/job-role.ts";
import { TEST_USERS } from "./people.ts";
import type { People } from "./types.ts";

export type TestSignIn = { email: string; jobRole: JobRole; password: string };

/**
 * Creates (or resets the password of) one sign-in per job role and sets their profile.
 * Every sign-in gets `SEED_TEST_PASSWORD` when it is set (so a team can share one test password
 * kept out of git); otherwise a fresh random one per run, only returned here, never stored.
 */
export async function ensureTestUsers(
  supabase: SupabaseClient,
): Promise<{ people: People; signIns: TestSignIn[] }> {
  const { data: existing, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`Could not list users: ${listError.message}`);

  const people: Partial<People> = {};
  const signIns: TestSignIn[] = [];

  for (const user of TEST_USERS) {
    const password =
      process.env.SEED_TEST_PASSWORD || randomBytes(12).toString("base64url");
    const found = existing.users.find((u) => u.email === user.email);
    const { data, error } = found
      ? await supabase.auth.admin.updateUserById(found.id, {
          password,
          email_confirm: true,
          user_metadata: { full_name: user.fullName },
        })
      : await supabase.auth.admin.createUser({
          email: user.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: user.fullName },
        });
    if (error) {
      throw new Error(`Could not set up ${user.email}: ${error.message}`);
    }

    // The signup trigger made a plain staff profile; give it the job.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: user.fullName,
        role: user.role,
        job_role: user.jobRole,
        arranges_stock: user.arrangesStock,
        yearly_target: user.yearlyTarget,
      })
      .eq("id", data.user.id);
    if (profileError) {
      throw new Error(
        `Could not set the profile of ${user.email}: ${profileError.message}`,
      );
    }

    people[user.jobRole] = data.user.id;
    signIns.push({ email: user.email, jobRole: user.jobRole, password });
  }

  return { people: people as People, signIns };
}

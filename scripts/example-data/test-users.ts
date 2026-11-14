import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type PersonKey, TEST_USERS } from "./people.ts";
import type { People } from "./types.ts";

export type TestSignIn = { email: string; fullName: string; password: string };

// Test sign-ins from before the demo's people were seeded (one per job role).
const LEGACY_EMAILS = [
  "md",
  "director",
  "bd",
  "sales",
  "accounts",
  "site",
  "support",
].map((role) => `test-${role}@example.invalid`);

/**
 * Creates (or resets the password of) one sign-in per demo person and sets their profile.
 * Passwords are fresh on every run and only returned here, never stored.
 */
export async function ensureTestUsers(
  supabase: SupabaseClient,
): Promise<{ people: People; signIns: TestSignIn[] }> {
  const { data: existing, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`Could not list users: ${listError.message}`);

  const people: Partial<Record<PersonKey, string>> = {};
  const signIns: TestSignIn[] = [];

  for (const user of TEST_USERS) {
    const password = randomBytes(12).toString("base64url");
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

    // The signup trigger made a plain staff profile; give it the job. reports_to comes in a
    // second pass, because the lead's job role must be saved before someone can report to them.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: user.fullName,
        role: user.role,
        job_role: user.jobRole,
        title: user.title,
        arranges_stock: user.arrangesStock,
        sells: user.sells,
        sees_margin: user.seesMargin,
        language: user.language,
        yearly_target: user.yearlyTarget,
        active: user.left === null,
        left_on: user.left?.on ?? null,
        left_reason: user.left?.reason ?? null,
      })
      .eq("id", data.user.id);
    if (profileError) {
      throw new Error(
        `Could not set the profile of ${user.email}: ${profileError.message}`,
      );
    }

    people[user.key] = data.user.id;
    signIns.push({
      email: user.email,
      fullName: user.fullName,
      password,
    });
  }

  for (const user of TEST_USERS) {
    const id = people[user.key];
    const leadId = user.reportsTo ? people[user.reportsTo] : null;
    if (!id) continue;
    const { error } = await supabase
      .from("profiles")
      .update({ reports_to: leadId ?? null })
      .eq("id", id);
    if (error) {
      throw new Error(
        `Could not set who ${user.fullName} reports to: ${error.message}`,
      );
    }
  }

  // Retire the old per-role test people so the dev panel and People list show only the demo's.
  for (const email of LEGACY_EMAILS) {
    const old = existing.users.find((u) => u.email === email);
    if (!old) continue;
    const { error } = await supabase
      .from("profiles")
      .update({ active: false, left_on: "2026-11-14", left_reason: "Replaced" })
      .eq("id", old.id);
    if (error) {
      throw new Error(`Could not retire ${email}: ${error.message}`);
    }
  }

  return { people: people as People, signIns };
}

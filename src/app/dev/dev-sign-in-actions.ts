"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDevSignInAllowed, isTestSignInEmail } from "@/lib/auth/dev-sign-in";
import { IMPERSONATION_COOKIE } from "@/lib/auth/impersonation";
import {
  ADMIN_UNAVAILABLE_MESSAGE,
  createAdminClient,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DevSignInResult = { error: string };
export type DevPerson = { id: string; fullName: string; title: string };

const NOT_HERE =
  "One-click sign-in only works on a laptop connected to the test copy.";
const NOT_SET_UP =
  "The test sign-ins need setting up first. Ask Claude to set up the test sign-ins.";
const TRY_AGAIN = "Could not sign in. Try again in a moment.";

function devAllowed(): boolean {
  return isDevSignInAllowed({
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}

/** The active people on the test copy, for the "Signed in as" list. Empty anywhere else. */
export async function listDevPeople(): Promise<DevPerson[]> {
  if (!devAllowed()) return [];
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, title")
    .eq("active", true)
    .order("full_name");
  if (error) {
    console.error("Could not list the dev people", error);
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name ?? "Unnamed",
    title: row.title ?? "",
  }));
}

/**
 * Signs in as a test person, without a password. Server actions are reachable in any build,
 * so the gate is checked here, before any admin call. Only @example.invalid people qualify,
 * so a real address on the test copy can never be signed in to this way.
 */
export async function devSignIn(personId: unknown): Promise<DevSignInResult> {
  if (!devAllowed()) return { error: NOT_HERE };

  const parsed = z.uuid().safeParse(personId);
  if (!parsed.success) return { error: "That person does not exist." };

  // A leftover View as would point at someone else and refuse the sign-in link below.
  (await cookies()).delete(IMPERSONATION_COOKIE);

  const admin = createAdminClient();
  if (!admin) return { error: ADMIN_UNAVAILABLE_MESSAGE };

  const { data: found, error: findError } = await admin.auth.admin.getUserById(
    parsed.data,
  );
  if (findError || !found.user) return { error: NOT_SET_UP };
  const email = found.user.email;
  if (!email || !isTestSignInEmail(email)) return { error: NOT_SET_UP };

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) {
    console.error("Could not make the dev sign-in link", linkError);
    return { error: TRY_AGAIN };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) {
    console.error("Could not sign in as the test person", verifyError);
    return { error: TRY_AGAIN };
  }
  redirect("/");
}

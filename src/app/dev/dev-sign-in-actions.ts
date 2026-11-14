"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  isDevSignInAllowed,
  TEST_SIGN_IN_EMAILS,
} from "@/lib/auth/dev-sign-in";
import { IMPERSONATION_COOKIE } from "@/lib/auth/impersonation";
import { JobRole } from "@/lib/auth/job-role";
import {
  ADMIN_UNAVAILABLE_MESSAGE,
  createAdminClient,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DevSignInResult = { error: string };

const NOT_HERE =
  "One-click sign-in only works on a laptop connected to the test copy.";
const NOT_SET_UP =
  "The test sign-ins need setting up first. Ask Claude to set up the test sign-ins.";
const TRY_AGAIN = "Could not sign in. Try again in a moment.";

/**
 * Signs in as the test person for a job role, without a password. Server actions are reachable
 * in any build, so the gate is checked here, before any admin call.
 */
export async function devSignIn(jobRole: unknown): Promise<DevSignInResult> {
  const allowed = isDevSignInAllowed({
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  if (!allowed) return { error: NOT_HERE };

  const parsed = JobRole.safeParse(jobRole);
  if (!parsed.success) return { error: "That job role does not exist." };

  // A leftover View as would point at someone else and refuse the sign-in link below.
  (await cookies()).delete(IMPERSONATION_COOKIE);

  const admin = createAdminClient();
  if (!admin) return { error: ADMIN_UNAVAILABLE_MESSAGE };

  const email = TEST_SIGN_IN_EMAILS[parsed.data];
  // generateLink would quietly create a missing user, so look first.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) {
    console.error("Could not list the test sign-ins", listError);
    return { error: TRY_AGAIN };
  }
  if (!list.users.some((user) => user.email === email)) {
    return { error: NOT_SET_UP };
  }

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

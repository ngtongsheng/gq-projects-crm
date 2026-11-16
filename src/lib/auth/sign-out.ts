"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { closeImpersonationLog } from "./close-impersonation-log";
import { IMPERSONATION_COOKIE, readImpersonation } from "./impersonation";

export async function signOut() {
  const impersonation = await readImpersonation();
  (await cookies()).delete(IMPERSONATION_COOKIE);
  if (impersonation) {
    // Signing out while viewing as someone ends that view, same as switching back. The cookie is
    // gone by now, so the write is no longer refused as a View as save.
    const admin = createAdminClient();
    if (admin) await closeImpersonationLog(admin, impersonation);
  }
  const supabase = await createClient();
  // supabase-js clears the session cookie even when the server call fails, so the person is
  // signed out on this device either way; the log shows a refresh token left valid.
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Sign-out did not reach Supabase", error);
  redirect("/sign-in");
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IMPERSONATION_COOKIE } from "./impersonation";

export async function signOut() {
  (await cookies()).delete(IMPERSONATION_COOKIE);
  const supabase = await createClient();
  // supabase-js clears the session cookie even when the server call fails, so the person is
  // signed out on this device either way; the log shows a refresh token left valid.
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Sign-out did not reach Supabase", error);
  redirect("/sign-in");
}

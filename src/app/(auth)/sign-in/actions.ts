"use server";

import { redirect } from "next/navigation";
import { requestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

/** Starts Google sign-in; Google returns to /auth/callback with a code. */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await requestOrigin()}/auth/callback`,
      // People with a personal and a work Google account choose each time.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) {
    console.error("Could not start Google sign-in", error);
    redirect("/sign-in?refused=failed");
  }
  redirect(data.url);
}

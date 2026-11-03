"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null };

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Enter your email and password." };
  }
  if (!email.trim() || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    // Supabase being down or rate-limiting is not the person's mistake, so say so and log it.
    if (!error.status || error.status === 429 || error.status >= 500) {
      console.error("Sign-in did not reach Supabase", error);
      return { error: "Could not sign in. Try again in a moment." };
    }
    // One message for every other failure so the form never reveals which emails exist.
    return { error: "That email and password don't match." };
  }

  redirect("/");
}

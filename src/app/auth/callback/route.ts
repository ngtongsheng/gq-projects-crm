import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  decideSignIn,
  parseAllowedDomains,
  type SignInRefusal,
} from "@/lib/auth/sign-in-decision";
import { createClient } from "@/lib/supabase/server";

function refuse(reason: SignInRefusal): never {
  redirect(`/sign-in?refused=${reason}`);
}

/**
 * Google sends people back here through Supabase with a one-time code. Sign-ups are off, so
 * Supabase itself turns away an email nobody added; this checks the company domain and that the
 * person still works here, and signs out anyone who fails.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  if (!code) {
    if (params.get("error_code") === "signup_disabled") refuse("not-added");
    console.error("Google sign-in came back without a code", {
      error: params.get("error"),
      errorCode: params.get("error_code"),
      description: params.get("error_description"),
    });
    refuse("failed");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Could not finish Google sign-in", error);
    refuse("failed");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Could not load the profile at sign-in", profileError);
  }

  const refusal = profileError
    ? "failed"
    : decideSignIn({
        email: data.user.email,
        allowedDomains: parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS),
        profile,
      });
  if (refusal) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError)
      console.error("Sign-out did not reach Supabase", signOutError);
    refuse(refusal);
  }

  redirect("/");
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IMPERSONATION_COOKIE } from "@/lib/auth/impersonation";
import { createClient } from "@/lib/supabase/server";

/**
 * Where getCurrentProfile sends someone who has left. A route handler, not a page, because only
 * route handlers and actions may clear the session cookies. Someone still working here who
 * follows the link stays signed in.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) redirect("/sign-in");

  const { data: row, error } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  if (row?.active) redirect("/");

  (await cookies()).delete(IMPERSONATION_COOKIE);
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError)
    console.error("Sign-out did not reach Supabase", signOutError);
  redirect("/sign-in?left=1");
}

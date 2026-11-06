"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_MAX_AGE_SECONDS,
  readImpersonation,
  signImpersonation,
} from "@/lib/auth/impersonation";
import { requireRole } from "@/lib/auth/require-role";
import {
  ADMIN_UNAVAILABLE_MESSAGE,
  createAdminClient,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { newLinkSchema } from "./schemas";

export type SignInAsResult = { error: string | null };

const TRY_AGAIN = "Could not switch. Try again in a moment.";

/**
 * Signs the MD in as another person, so they see and do exactly what that person can. Every
 * switch is written to impersonation_log. Only the MD, who is also an admin, may.
 */
export async function signInAs(userId: string): Promise<SignInAsResult> {
  const me = await requireRole("admin");
  if (me.jobRole !== "md") redirect("/");

  const parsed = newLinkSchema.safeParse({ userId });
  if (!parsed.success) return { error: "Could not find that person." };
  if (parsed.data.userId === me.id) {
    return { error: "You are already signed in as yourself." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: ADMIN_UNAVAILABLE_MESSAGE };

  const { data: found, error: findError } = await admin.auth.admin.getUserById(
    parsed.data.userId,
  );
  const email = found?.user?.email;
  if (findError || !email) {
    console.error("Could not find the person to sign in as", findError);
    return { error: "Could not find that person." };
  }

  // The record first: no switch without a trace.
  const { data: logged, error: logError } = await admin
    .from("impersonation_log")
    .insert({ admin_id: me.id, target_id: parsed.data.userId })
    .select("id")
    .single();
  if (logError || !logged) {
    console.error("Could not record the switch", logError);
    return { error: TRY_AGAIN };
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) {
    console.error("Could not make the sign-in as link", linkError);
    await admin.from("impersonation_log").delete().eq("id", logged.id);
    return { error: TRY_AGAIN };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) {
    console.error("Could not sign in as the person", verifyError);
    await admin.from("impersonation_log").delete().eq("id", logged.id);
    return { error: TRY_AGAIN };
  }

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  (await cookies()).set(
    IMPERSONATION_COOKIE,
    signImpersonation(
      { adminId: me.id, targetId: parsed.data.userId, logId: logged.id },
      secret,
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
    },
  );
  redirect("/");
}

/** Switches back from the person the MD signed in as to the MD's own account. */
export async function backToMyAccount(): Promise<void> {
  const impersonation = await readImpersonation();
  const store = await cookies();
  if (!impersonation) {
    store.delete(IMPERSONATION_COOKIE);
    redirect("/");
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  // The cookie only counts for the person it names; anyone else just loses it.
  if (auth?.claims.sub !== impersonation.targetId) {
    store.delete(IMPERSONATION_COOKIE);
    redirect("/");
  }

  const admin = createAdminClient();
  const { data: found } = admin
    ? await admin.auth.admin.getUserById(impersonation.adminId)
    : { data: null };
  const email = found?.user?.email;
  if (!admin || !email) {
    console.error("Could not find the MD's account to switch back to");
    store.delete(IMPERSONATION_COOKIE);
    await supabase.auth.signOut();
    redirect("/sign-in");
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const { error: verifyError } = linkError
    ? { error: linkError }
    : await supabase.auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: "magiclink",
      });
  store.delete(IMPERSONATION_COOKIE);
  if (verifyError) {
    console.error("Could not switch back", verifyError);
    await supabase.auth.signOut();
    redirect("/sign-in");
  }

  await admin
    .from("impersonation_log")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", impersonation.logId);
  redirect("/people");
}

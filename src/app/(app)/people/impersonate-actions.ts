"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_COOKIE_MAX_AGE_SECONDS,
  isViewingAs,
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

export type ViewAsResult = { error: string | null };

const TRY_AGAIN = "Could not switch. Try again in a moment.";

/**
 * Opens the app as another person, so the MD sees exactly what they see. Nothing can be saved
 * until the MD switches back (src/lib/supabase/view-only-fetch.ts). Every view is written to
 * impersonation_log. Only the MD, who is also an admin, may.
 */
export async function viewAs(userId: string): Promise<ViewAsResult> {
  const me = await requireRole("admin");
  if (me.jobRole !== "md") redirect("/");

  const parsed = newLinkSchema.safeParse({ userId });
  if (!parsed.success) return { error: "Could not find that person." };
  if (parsed.data.userId === me.id) {
    return { error: "This is already what you see." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: ADMIN_UNAVAILABLE_MESSAGE };

  const { data: found, error: findError } = await admin.auth.admin.getUserById(
    parsed.data.userId,
  );
  const email = found?.user?.email;
  if (findError || !email) {
    console.error("Could not find the person to view as", findError);
    return { error: "Could not find that person." };
  }

  // The record first: no view without a trace.
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
    console.error("Could not make the view as link", linkError);
    await admin.from("impersonation_log").delete().eq("id", logged.id);
    return { error: TRY_AGAIN };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) {
    console.error("Could not open the view as the person", verifyError);
    await admin.from("impersonation_log").delete().eq("id", logged.id);
    return { error: TRY_AGAIN };
  }

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  (await cookies()).set(
    IMPERSONATION_COOKIE,
    signImpersonation(
      {
        adminId: me.id,
        adminName: me.fullName ?? "",
        targetId: parsed.data.userId,
        logId: logged.id,
      },
      secret,
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: IMPERSONATION_COOKIE_MAX_AGE_SECONDS,
    },
  );
  redirect("/");
}

/** Ends View as and switches back to the MD's own account. */
export async function endViewAs(): Promise<void> {
  const viewing = await isViewingAs();
  const impersonation = await readImpersonation();
  const store = await cookies();
  // From here on the switch back may save (sign-in link, closing the record).
  store.delete(IMPERSONATION_COOKIE);
  const supabase = await createClient();
  if (!viewing) redirect("/");
  if (!impersonation) {
    // An expired or altered cookie: the session may still be the other person's, so end it.
    await supabase.auth.signOut();
    redirect("/sign-in");
  }

  const { data: auth } = await supabase.auth.getClaims();
  // The cookie only counts for the person it names; anyone else just loses it.
  if (auth?.claims.sub !== impersonation.targetId) redirect("/");

  const admin = createAdminClient();
  const { data: found } = admin
    ? await admin.auth.admin.getUserById(impersonation.adminId)
    : { data: null };
  const email = found?.user?.email;
  if (!admin || !email) {
    console.error("Could not find the MD's account to switch back to");
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

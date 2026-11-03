"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setPasswordSchema } from "./schema";

export type SetPasswordState = {
  error: string | null;
  /** True once the link has been spent and the person's session is open, so a retry needs no new link. */
  linkVerified: boolean;
};

const LINK_PROBLEM =
  "This link has already been used or has expired. Ask your admin for a new one.";

export async function setPassword(
  formData: FormData,
): Promise<SetPasswordState> {
  const parsed = setPasswordSchema.safeParse({
    tokenHash: formData.get("token_hash"),
    type: formData.get("type"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return { error: message ?? LINK_PROBLEM, linkVerified: false };
  }

  const supabase = await createClient();
  // Only a retry that the form says follows a verified link may reuse the session. Trusting any
  // existing session would change a signed-in admin's own password when they open someone's link.
  const retrying = formData.get("link_verified") === "true";
  const { data: current } = retrying
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  if (!current.user) {
    // The token is spent here, on submit, so opening or previewing the link is harmless.
    const { error: linkError } = await supabase.auth.verifyOtp({
      token_hash: parsed.data.tokenHash,
      type: parsed.data.type,
    });
    if (linkError) {
      console.error("Could not verify the set-password link", linkError);
      return { error: LINK_PROBLEM, linkVerified: false };
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    console.error("Could not save the new password", error);
    return {
      error:
        "Could not save your password. Try again with a different password.",
      linkVerified: true,
    };
  }

  redirect("/");
}

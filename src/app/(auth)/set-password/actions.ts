"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setPasswordSchema } from "./schema";

export type SetPasswordState = { error: string | null };

const LINK_PROBLEM =
  "This link has already been used or has expired. Ask your admin for a new one.";

export async function setPassword(
  _previous: SetPasswordState,
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
    return { error: message ?? LINK_PROBLEM };
  }

  const supabase = await createClient();
  // The token is spent here, on submit, so opening or previewing the link is harmless.
  const { error: linkError } = await supabase.auth.verifyOtp({
    token_hash: parsed.data.tokenHash,
    type: parsed.data.type,
  });
  if (linkError) return { error: LINK_PROBLEM };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: "Could not save your password. Try again." };

  redirect("/");
}

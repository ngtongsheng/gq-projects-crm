"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/require-role";
import {
  ADMIN_UNAVAILABLE_MESSAGE,
  createAdminClient,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteMessage } from "./invite-message";
import {
  addPersonSchema,
  changeRoleSchema,
  personSettingsSchema,
} from "./schemas";

export type AddPersonState = {
  error: string | null;
  invite: { link: string; message: string } | null;
};

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function addPerson(
  _previous: AddPersonState,
  formData: FormData,
): Promise<AddPersonState> {
  await requireRole("admin");

  const parsed = addPersonSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the details.",
      invite: null,
    };
  }
  const { fullName, email, role } = parsed.data;

  const admin = createAdminClient();
  if (!admin) return { error: ADMIN_UNAVAILABLE_MESSAGE, invite: null };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name: fullName } },
  });
  if (error) {
    if (error.code !== "email_exists")
      console.error("Could not add person", error);
    return {
      error:
        error.code === "email_exists"
          ? "Someone with that email is already added."
          : "Could not add them. Try again in a moment.",
      invite: null,
    };
  }

  // The link is checked on the set-password page, not by Supabase's own redirect.
  const link = `${await requestOrigin()}/set-password?${new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: data.properties.verification_type,
  })}`;
  const invite = { link, message: inviteMessage(fullName, link) };

  // The sign-up trigger always creates staff; promote when asked.
  if (role === "admin") {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (roleError) {
      console.error("Could not make the new person an admin", roleError);
      revalidatePath("/people");
      return {
        error:
          "They were added as staff, but making them an admin failed. Change their role in the list.",
        invite,
      };
    }
  }

  revalidatePath("/people");
  return { error: null, invite };
}

export type ChangeRoleResult = { error: string | null };

/** Must match the message in the keep_one_admin trigger. */
const LAST_ADMIN = "There must be at least one admin.";

export async function changeRole(input: unknown): Promise<ChangeRoleResult> {
  await requireRole("admin");

  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a role." };
  const { userId, role } = parsed.data;

  // Admins can read and update all profiles through RLS, so no service key needed.
  const supabase = await createClient();

  if (role === "staff") {
    const { data: admins, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    if (error) {
      console.error("Could not check the admins", error);
      return { error: "Could not change the role. Try again." };
    }
    const isLastAdmin =
      admins.length === 1 && admins.some((row) => row.id === userId);
    if (isLastAdmin) return { error: LAST_ADMIN };
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id");
  // The keep_one_admin trigger refuses when another admin was demoted at the same moment.
  if (error?.code === "23514" && error.message === LAST_ADMIN) {
    return { error: LAST_ADMIN };
  }
  if (error) console.error("Could not change role", error);
  if (error || updated.length === 0) {
    return { error: "Could not change the role. Try again." };
  }

  revalidatePath("/people");
  return { error: null };
}

export type PersonSettingsResult = { error: string | null };

export async function updatePersonSettings(
  formData: FormData,
): Promise<PersonSettingsResult> {
  await requireRole("admin");

  const parsed = personSettingsSchema.safeParse({
    userId: formData.get("userId"),
    jobRole: formData.get("jobRole"),
    arrangesStock: formData.get("arrangesStock"),
    commissionMode: formData.get("commissionMode"),
    yearlyTarget: formData.get("yearlyTarget"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error:
        issue?.path[0] === "yearlyTarget"
          ? issue.message
          : "Choose a job role and commission setting.",
    };
  }
  const { userId, jobRole, arrangesStock, commissionMode, yearlyTarget } =
    parsed.data;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      job_role: jobRole,
      arranges_stock: arrangesStock,
      commission_mode: commissionMode,
      yearly_target: yearlyTarget,
    })
    .eq("id", userId)
    .select("id");
  if (error) {
    console.error("Could not update person settings", error);
    return { error: "Could not save their settings. Try again." };
  }
  if (updated.length === 0) {
    return { error: "Could not save their settings. Try again." };
  }

  revalidatePath("/people");
  return { error: null };
}

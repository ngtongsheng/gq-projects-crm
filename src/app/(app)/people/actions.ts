"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { textField } from "@/lib/form/form-fields";
import { requestOrigin } from "@/lib/request-origin";
import {
  ADMIN_UNAVAILABLE_MESSAGE,
  createAdminClient,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildInvite, type Invite } from "./invite-message";
import {
  addPersonSchema,
  changeRoleSchema,
  personSettingsSchema,
} from "./schemas";

export type AddPersonState = {
  error: string | null;
  invite: Invite | null;
};

/** Must match the message in the check_reports_to trigger. */
const REPORTS_TO_REFUSED =
  "A person can only report to a Sales Director or Marketing Director.";

export async function addPerson(formData: FormData): Promise<AddPersonState> {
  await requireRole("admin");

  const parsed = addPersonSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: formData.get("role"),
    jobRole: formData.get("jobRole") ?? undefined,
    mobile: textField(formData, "mobile"),
    title: textField(formData, "title"),
    joinedOn: textField(formData, "joinedOn"),
    reportsTo: textField(formData, "reportsTo"),
    language: formData.get("language") ?? "en",
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the details.",
      invite: null,
    };
  }
  const { fullName, email, role, jobRole, mobile, ...person } = parsed.data;

  const admin = createAdminClient();
  if (!admin) return { error: ADMIN_UNAVAILABLE_MESSAGE, invite: null };

  // Confirmed up front so their first Google sign-in links to this person (same email).
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
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

  const invite = buildInvite(
    fullName,
    email,
    `${await requestOrigin()}/sign-in`,
    mobile,
  );

  // The sign-up trigger always creates a salesperson on staff; set what was asked.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role,
      job_role: jobRole,
      title: person.title,
      joined_on: person.joinedOn,
      reports_to: person.reportsTo,
      whatsapp: mobile,
      language: person.language,
    })
    .eq("id", data.user.id);
  if (profileError) {
    console.error("Could not set the new person's details", profileError);
    revalidatePath("/people");
    return {
      error:
        profileError.message === REPORTS_TO_REFUSED
          ? "They were added, but they can only report to a Sales Director or Marketing Director. Change it in Settings."
          : "They were added, but their details could not be saved. Change them in Settings.",
      invite,
    };
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

// Fields whose own message says what to fix; the rest are picked from a list.
const SPECIFIC_MESSAGE_FIELDS = new Set([
  "yearlyTarget",
  "whatsapp",
  "title",
  "joinedOn",
  "leftOn",
  "leftReason",
]);

export async function updatePersonSettings(
  formData: FormData,
): Promise<PersonSettingsResult> {
  const me = await requireRole("admin");

  const parsed = personSettingsSchema.safeParse({
    userId: formData.get("userId"),
    jobRole: formData.get("jobRole"),
    arrangesStock: formData.get("arrangesStock"),
    sells: formData.get("sells"),
    seesMargin: formData.get("seesMargin"),
    commissionMode: formData.get("commissionMode"),
    yearlyTarget: textField(formData, "yearlyTarget"),
    whatsapp: textField(formData, "whatsapp"),
    title: textField(formData, "title"),
    joinedOn: textField(formData, "joinedOn"),
    reportsTo: textField(formData, "reportsTo"),
    language: formData.get("language"),
    hasLeft: formData.get("hasLeft"),
    leftOn: textField(formData, "leftOn"),
    leftReason: textField(formData, "leftReason"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error:
        issue && SPECIFIC_MESSAGE_FIELDS.has(String(issue.path[0]))
          ? issue.message
          : "Choose a job role, language and commission setting.",
    };
  }
  const { userId, ...person } = parsed.data;
  if (userId === me.id && !person.active) {
    return { error: "You can't mark yourself as left." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      job_role: person.jobRole,
      arranges_stock: person.arrangesStock,
      sells: person.sells,
      sees_margin: person.seesMargin,
      commission_mode: person.commissionMode,
      yearly_target: person.yearlyTarget,
      whatsapp: person.whatsapp,
      title: person.title,
      joined_on: person.joinedOn,
      reports_to: person.reportsTo,
      language: person.language,
      active: person.active,
      left_on: person.leftOn,
      left_reason: person.leftReason,
    })
    .eq("id", userId)
    .select("id");
  if (error?.message === REPORTS_TO_REFUSED) {
    return {
      error: "They can only report to a Sales Director or Marketing Director.",
    };
  }
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

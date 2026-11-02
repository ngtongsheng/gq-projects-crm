"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditSite } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import {
  canCloseFollowUp,
  FOLLOW_UP_OWNERS,
  SITE_ACTIVITIES,
} from "@/lib/domain/site-log";
import { SITE_STAGES } from "@/lib/domain/site-stage";
import { optionalText, textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";

export type SiteWorkResult = { error: string | null };

const NOT_SITE_TEAM =
  "Only the MD, Sales Director or a site supervisor can update site work.";
const NOT_CLOSER = "Only the group that owns this follow-up can close it.";
const NOT_FOUND_MOF = "Could not find that MOF. Reload the page.";
const NOT_FOUND_LOG = "Could not find that site visit. Reload the page.";
const NOT_FOUND_FOLLOW_UP = "Could not find that follow-up. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

// Files are not uploaded; the Drive link only has to be a web address.
const driveLink = z
  .string()
  .trim()
  .max(2000, "Keep the Drive link under 2000 characters.")
  .refine(
    (value) =>
      value === "" ||
      (/^https?:\/\//i.test(value) && z.url().safeParse(value).success),
    "Enter the Drive link as a web address starting with https://",
  )
  .transform((value) => (value === "" ? null : value));

const mofId = z.uuid({ error: NOT_FOUND_MOF });

const logForm = z.object({
  mofId,
  visitedOn: z.iso.date("Choose the visit date."),
  activity: z.enum(SITE_ACTIVITIES, "Choose the activity."),
  notes: optionalText(1000, "Keep the notes under 1000 characters."),
  measurementReceived: z.boolean(),
  driveLink,
  handoverSigned: z.boolean(),
});

const followUpForm = z.object({
  mofId,
  siteLogId: z.uuid({ error: NOT_FOUND_LOG }),
  action: z
    .string()
    .trim()
    .min(1, "Enter what needs to be done.")
    .max(300, "Keep the action under 300 characters."),
  ownerGroup: z.enum(FOLLOW_UP_OWNERS, "Choose who owns it."),
  dueOn: z
    .union([z.literal(""), z.iso.date("Choose the due date.")])
    .transform((value) => (value === "" ? null : value)),
});

const stageForm = z.object({
  mofId,
  stage: z.enum(SITE_STAGES, "Choose the site stage."),
});

const doneForm = z.object({
  mofId,
  followUpId: z.uuid({ error: NOT_FOUND_FOLLOW_UP }),
  ownerGroup: z.enum(FOLLOW_UP_OWNERS, NOT_FOUND_FOLLOW_UP),
});

/** Maps a database refusal to a message she can act on, or null when it is something else. */
function refusal(error: { code?: string }): string | null {
  if (error.code === "42501") return NOT_SITE_TEAM;
  if (error.code === "23503") return NOT_FOUND_MOF;
  return null;
}

function revalidateSite(id: string) {
  revalidatePath("/site-work");
  revalidatePath(`/site-work/${id}`);
}

/** Moves a site along its stages. The database function checks the job role again. */
export async function setSiteStage(
  mofIdValue: string,
  stage: string,
): Promise<SiteWorkResult> {
  const me = await requireSection("siteWork");
  if (!canEditSite(me.jobRole)) return { error: NOT_SITE_TEAM };

  const parsed = stageForm.safeParse({ mofId: mofIdValue, stage });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_site_stage", {
    mof_id: parsed.data.mofId,
    stage: parsed.data.stage,
  });
  if (error) {
    if (error.code === "P0002") return { error: NOT_FOUND_MOF };
    const message = refusal(error);
    if (message) return { error: message };
    console.error("Could not change the site stage", error);
    return { error: TRY_AGAIN };
  }

  revalidateSite(parsed.data.mofId);
  return { error: null };
}

/** Logs a site visit. The supervisor is whoever is signed in. */
export async function addSiteLog(formData: FormData): Promise<SiteWorkResult> {
  const me = await requireSection("siteWork");
  if (!canEditSite(me.jobRole)) return { error: NOT_SITE_TEAM };

  const parsed = logForm.safeParse({
    mofId: textField(formData, "mofId"),
    visitedOn: textField(formData, "visitedOn"),
    activity: textField(formData, "activity"),
    notes: textField(formData, "notes"),
    measurementReceived: formData.get("measurementReceived") === "on",
    driveLink: textField(formData, "driveLink"),
    handoverSigned: formData.get("handoverSigned") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const log = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("site_logs").insert({
    mof_id: log.mofId,
    visited_on: log.visitedOn,
    activity: log.activity,
    notes: log.notes,
    measurement_received: log.measurementReceived,
    drive_link: log.driveLink,
    handover_signed: log.handoverSigned,
  });
  if (error) {
    const message = refusal(error);
    if (message) return { error: message };
    console.error("Could not save the site visit", error);
    return { error: TRY_AGAIN };
  }

  revalidateSite(log.mofId);
  return { error: null };
}

/** Adds a follow-up action to a site visit. */
export async function addFollowUp(formData: FormData): Promise<SiteWorkResult> {
  const me = await requireSection("siteWork");
  if (!canEditSite(me.jobRole)) return { error: NOT_SITE_TEAM };

  const parsed = followUpForm.safeParse({
    mofId: textField(formData, "mofId"),
    siteLogId: textField(formData, "siteLogId"),
    action: textField(formData, "action"),
    ownerGroup: textField(formData, "ownerGroup"),
    dueOn: textField(formData, "dueOn"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const followUp = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("site_follow_ups").insert({
    site_log_id: followUp.siteLogId,
    action: followUp.action,
    owner_group: followUp.ownerGroup,
    due_on: followUp.dueOn,
  });
  if (error) {
    if (error.code === "23503") return { error: NOT_FOUND_LOG };
    const message = refusal(error);
    if (message) return { error: message };
    console.error("Could not save the follow-up", error);
    return { error: TRY_AGAIN };
  }

  revalidateSite(followUp.mofId);
  return { error: null };
}

/**
 * Ticks a follow-up done, or reopens it. Only the group that owns it, or a manager, may; the
 * database checks the same and stamps who and when.
 */
export async function setFollowUpDone(
  mofIdValue: string,
  followUpId: string,
  ownerGroup: string,
  done: boolean,
): Promise<SiteWorkResult> {
  const me = await requireSection("siteWork");

  const parsed = doneForm.safeParse({
    mofId: mofIdValue,
    followUpId,
    ownerGroup,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  if (!canCloseFollowUp(me.jobRole, parsed.data.ownerGroup)) {
    return { error: NOT_CLOSER };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_follow_ups")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", parsed.data.followUpId)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_CLOSER };
    console.error("Could not update the follow-up", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND_FOLLOW_UP };

  revalidateSite(parsed.data.mofId);
  return { error: null };
}

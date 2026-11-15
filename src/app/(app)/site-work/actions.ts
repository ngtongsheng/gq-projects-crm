"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditSite } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import {
  canChaseFollowUp,
  FOLLOW_UP_OWNERS,
  SITE_ACTIVITIES,
  type SiteActivity,
  VISIT_SAVED_BUT,
} from "@/lib/domain/site-log";
import {
  SITE_STAGE_LABEL,
  SITE_STAGES,
  type SiteStage,
  stageAfterVisit,
} from "@/lib/domain/site-stage";
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

const mofId = z.uuid({ error: NOT_FOUND_MOF });

const followUpForm = z.object({
  mofId,
  siteLogId: z.uuid({ error: NOT_FOUND_LOG }),
  action: z
    .string()
    .trim()
    .min(1, "Enter what needs to be done.")
    .max(300, "Keep the action under 300 characters."),
  ownerGroup: z.enum(FOLLOW_UP_OWNERS, "Choose who owns it."),
  assigneeId: z
    .union([z.literal(""), z.uuid("Choose who it is assigned to.")])
    .transform((value) => (value === "" ? null : value)),
  dueOn: z
    .union([z.literal(""), z.iso.date("Choose the due date.")])
    .transform((value) => (value === "" ? null : value)),
});

const stageForm = z.object({
  mofId,
  stage: z.enum(SITE_STAGES, "Choose the site stage."),
});

const doneForm = z.object({
  // A follow-up from a visit with no MOF has no site page to refresh.
  mofId: mofId.nullable(),
  followUpId: z.uuid({ error: NOT_FOUND_FOLLOW_UP }),
  ownerGroup: z.enum(FOLLOW_UP_OWNERS, NOT_FOUND_FOLLOW_UP),
  assigneeId: z.uuid({ error: NOT_FOUND_FOLLOW_UP }).nullable(),
});

/** Maps a database refusal to a message she can act on, or null when it is something else. */
function refusal(error: { code?: string }): string | null {
  if (error.code === "42501") return NOT_SITE_TEAM;
  if (error.code === "23503") return NOT_FOUND_MOF;
  return null;
}

function revalidateSite(id: string | null) {
  revalidatePath("/site-work");
  revalidatePath("/today");
  if (id) revalidatePath(`/site-work/${id}`);
}

/** Moves a site along its stages. The database function checks the job role again. */
export async function setSiteStage(
  mofIdValue: string,
  stage: string,
): Promise<SiteWorkResult> {
  const me = await requirePage("site");
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

// The wizard sends null for a question it did not ask.
const answered = z.boolean().nullable().default(null);
const pickedId = (message: string) =>
  z.uuid({ error: message }).nullable().default(null);
const typedText = (max: number, message: string) =>
  optionalText(max, message).nullable().default(null);

const visitForm = z
  .object({
    mofId: pickedId(NOT_FOUND_MOF),
    siteName: typedText(200, "Keep the site name under 200 characters."),
    salespersonId: pickedId("Choose the salesperson."),
    projectId: pickedId("Could not find that project. Reload the page."),
    visitedOn: z.iso.date("Choose the visit date."),
    activities: z
      .array(z.enum(SITE_ACTIVITIES, "Choose the activity."))
      .min(1, "Choose what you did on site.")
      .refine(
        (list) => new Set(list).size === list.length,
        "Choose each activity once.",
      ),
    note: typedText(1000, "Keep the notes under 1000 characters."),
    installedPct: z
      .number()
      .int()
      .min(0, "Choose how much is installed.")
      .max(100, "Choose how much is installed.")
      .nullable()
      .default(null),
    measurementSent: answered,
    photosPosted: answered,
    completedPhotosPosted: answered,
    handoverSigned: answered,
    deliveryOk: answered,
    returnAnswer: typedText(
      500,
      "Keep the balance stock answer under 500 characters.",
    ),
    followUp: z
      .object({
        action: z
          .string()
          .trim()
          .min(1, "Enter what needs to be done.")
          .max(300, "Keep the action under 300 characters."),
        ownerGroup: z.enum(FOLLOW_UP_OWNERS, "Choose who owns it."),
        dueOn: z.iso.date("Choose the due date.").nullable(),
      })
      .nullable()
      .default(null),
  })
  .superRefine((visit, context) => {
    const missing = (message: string) =>
      context.addIssue({ code: "custom", message });
    const did = (activity: SiteActivity) => visit.activities.includes(activity);
    if (!visit.mofId && !visit.siteName) missing("Enter the site name.");
    if (!visit.mofId && !visit.salespersonId) {
      missing("Choose the salesperson.");
    }
    if (did("installation") && visit.installedPct === null) {
      missing("Choose how much of the whole job is installed.");
    }
    if (did("measurement") && visit.measurementSent === null) {
      missing("Say whether the measurement went to the salesperson.");
    }
    if (did("shooting") && visit.photosPosted === null) {
      missing("Say whether the photos are posted in the job WhatsApp group.");
    }
    if (did("handover") && visit.handoverSigned === null) {
      missing("Say whether the handover form is signed.");
    }
    if (did("handover") && visit.completedPhotosPosted === null) {
      missing("Say whether the completed photos are posted.");
    }
    if (did("delivery") && visit.deliveryOk === null) {
      missing("Say whether the delivery arrived fine.");
    }
  });

const mofForVisit = z.object({
  site_stage: z.enum(SITE_STAGES),
  salesperson_id: z.string(),
});

export type SiteVisitResult = {
  error: string | null;
  /** The stage the MOF moved to, or null when it stayed. */
  movedTo: SiteStage | null;
};

/**
 * Saves a visit from the Log work wizard: one site log per activity (the follow-up and the
 * balance stock answer go on the first), then moves the MOF's stage on per loop 17 D6.
 */
export async function saveSiteVisit(input: unknown): Promise<SiteVisitResult> {
  const me = await requirePage("site");
  if (!canEditSite(me.jobRole)) return { error: NOT_SITE_TEAM, movedTo: null };

  const parsed = visitForm.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the details.",
      movedTo: null,
    };
  }
  const visit = parsed.data;
  const supabase = await createClient();

  let mof: z.infer<typeof mofForVisit> | null = null;
  if (visit.mofId) {
    const { data, error } = await supabase
      .from("mofs")
      .select("site_stage, salesperson_id")
      .eq("id", visit.mofId)
      .maybeSingle();
    if (error) {
      console.error("Could not load the MOF for a site visit", error);
      return { error: TRY_AGAIN, movedTo: null };
    }
    if (!data) return { error: NOT_FOUND_MOF, movedTo: null };
    mof = mofForVisit.parse(data);
  }

  const posted = (yes: boolean | null) => (yes ? visit.visitedOn : null);
  const rows = visit.activities.map((activity, index) => ({
    mof_id: visit.mofId,
    site_name: mof ? null : visit.siteName,
    salesperson_id: mof ? null : visit.salespersonId,
    project_id: mof ? null : visit.projectId,
    visited_on: visit.visitedOn,
    activity,
    notes: visit.note,
    handover_signed: activity === "handover" && visit.handoverSigned === true,
    inst_pct: activity === "installation" ? visit.installedPct : null,
    measurement_to:
      activity === "measurement"
        ? (mof?.salesperson_id ?? visit.salespersonId)
        : null,
    measurement_sent_on:
      activity === "measurement" ? posted(visit.measurementSent) : null,
    photos_posted_on:
      activity === "shooting"
        ? posted(visit.photosPosted)
        : activity === "handover"
          ? posted(visit.completedPhotosPosted)
          : null,
    delivery_ok: activity === "delivery" ? visit.deliveryOk : null,
    return_answer: index === 0 ? visit.returnAnswer : null,
  }));

  const { data: saved, error } = await supabase
    .from("site_logs")
    .insert(rows)
    .select("id");
  if (error) {
    const message = refusal(error);
    if (message) return { error: message, movedTo: null };
    console.error("Could not save the site visit", error);
    return { error: TRY_AGAIN, movedTo: null };
  }
  if (visit.mofId) revalidateSite(visit.mofId);
  else revalidatePath("/site-work");

  if (visit.followUp) {
    const [first] = z.array(z.object({ id: z.string() })).parse(saved);
    const followUp = await supabase.from("site_follow_ups").insert({
      site_log_id: first?.id,
      action: visit.followUp.action,
      owner_group: visit.followUp.ownerGroup,
      due_on: visit.followUp.dueOn,
    });
    if (followUp.error) {
      console.error("Could not save the visit's follow-up", followUp.error);
      return {
        error: `${VISIT_SAVED_BUT} the follow-up was not. Add it again.`,
        movedTo: null,
      };
    }
  }

  if (!mof || !visit.mofId) return { error: null, movedTo: null };
  const next = stageAfterVisit(mof.site_stage, {
    installation: visit.activities.includes("installation"),
    handoverSigned:
      visit.activities.includes("handover") && visit.handoverSigned === true,
    delivery: visit.activities.includes("delivery"),
  });
  if (next === mof.site_stage) return { error: null, movedTo: null };

  const moved = await supabase.rpc("set_site_stage", {
    mof_id: visit.mofId,
    stage: next,
  });
  if (moved.error) {
    console.error("Could not move the site stage after a visit", moved.error);
    return {
      error: `${VISIT_SAVED_BUT} the site stage did not move to ${SITE_STAGE_LABEL[next]}. Set it on the MOF.`,
      movedTo: null,
    };
  }
  return { error: null, movedTo: next };
}

/** Adds a follow-up action to a site visit. */
export async function addFollowUp(formData: FormData): Promise<SiteWorkResult> {
  const me = await requirePage("site");
  if (!canEditSite(me.jobRole)) return { error: NOT_SITE_TEAM };

  const parsed = followUpForm.safeParse({
    mofId: textField(formData, "mofId"),
    siteLogId: textField(formData, "siteLogId"),
    action: textField(formData, "action"),
    ownerGroup: textField(formData, "ownerGroup"),
    assigneeId: textField(formData, "assigneeId"),
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
    assignee_id: followUp.assigneeId,
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
 * Ticks a follow-up done, or reopens it. Only the group that owns it, a manager or the person
 * it is assigned to may; the database checks the same and stamps who and when.
 */
export async function setFollowUpDone(
  mofIdValue: string | null,
  followUpId: string,
  ownerGroup: string,
  done: boolean,
  assigneeId: string | null = null,
): Promise<SiteWorkResult> {
  const me = await requirePage("site");

  const parsed = doneForm.safeParse({
    mofId: mofIdValue,
    followUpId,
    ownerGroup,
    assigneeId,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  if (!canChaseFollowUp(me, parsed.data)) {
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

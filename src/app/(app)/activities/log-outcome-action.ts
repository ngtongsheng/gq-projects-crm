"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import { textField } from "@/lib/form/form-fields";
import { formatMonth } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { AccountType } from "../customers/schemas";
import { canCreateProject } from "../projects/project-access";
import { projectFormSchema } from "../projects/schemas";
import { canEditActivity, canLogActivity } from "./activity-access";
import { parseMytInput } from "./activity-time";
import {
  needsOutcome,
  type OutcomeForm,
  outcomeFormSchema,
} from "./outcome-schema";
import { ActivityStatus } from "./schemas";

/** `late` is read back from the database, which stamps it against the week's deadline. */
export type LogOutcomeResult =
  | { error: string; late?: never }
  | { error: null; late: boolean };

const fail = (error: string): LogOutcomeResult => ({ error });

const SAVE_FAILED = "Could not log the outcome. Try again.";

const activityRow = z.object({
  owner_id: z.string(),
  contact_id: z.string(),
  status: ActivityStatus,
  starts_at: z.string(),
});

const customerRow = z.object({
  account_type: AccountType,
  passed_by: z.string().nullable(),
  contact_owners: z.array(z.object({ profile_id: z.string() })),
});

const loggedRow = z.array(z.object({ late_logged: z.boolean() }));

/** Logs a visit's outcome: completes it, may add a project lead, and plans the follow-up. */
export async function logOutcome(
  formData: FormData,
): Promise<LogOutcomeResult> {
  const me = await requirePage("cust", "cal");
  if (!canLogActivity(me.jobRole)) {
    return fail("Your role can view activities but not log them.");
  }

  const parsed = outcomeFormSchema.safeParse({
    activityId: textField(formData, "activityId"),
    result: textField(formData, "result"),
    learnings: textField(formData, "learnings"),
    leadName: textField(formData, "leadName"),
    leadValue: textField(formData, "leadValue"),
    leadStart: textField(formData, "leadStart"),
    nextStep: textField(formData, "nextStep"),
    nextDate: textField(formData, "nextDate"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  }
  const form = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select("owner_id, contact_id, status, starts_at")
    .eq("id", form.activityId)
    .maybeSingle();
  if (error) {
    console.error("Could not load activity", error);
    return fail(SAVE_FAILED);
  }
  if (!data) return fail("Could not find that activity. Reload the page.");
  const activity = activityRow.parse(data);

  if (!canEditActivity(me.jobRole, activity.owner_id === me.id)) {
    return fail("Only the person who owns this activity can log its outcome.");
  }
  if (activity.status !== "planned") {
    return fail("This activity is already completed or cancelled.");
  }
  if (!needsOutcome({ status: "planned", startsAt: activity.starts_at })) {
    return fail("This activity hasn't started yet. Change its time first.");
  }

  // The lead goes in first so the activity can point at it; a lead without its visit is still a lead.
  let leadProjectId: string | null = null;
  if (form.leadName) {
    const lead = await addProjectLead(
      me,
      activity.owner_id,
      activity.contact_id,
      form,
    );
    if (!lead.ok) return fail(lead.error);
    leadProjectId = lead.projectId;
  }

  const { data: logged, error: logError } = await supabase
    .from("activities")
    .update({
      status: "completed",
      result: form.result,
      outcome: form.learnings,
      lead_project_id: leadProjectId,
    })
    .eq("id", form.activityId)
    .eq("status", "planned")
    .select("late_logged");
  if (logError) {
    console.error("Could not log outcome", logError);
    return fail(SAVE_FAILED);
  }
  const rows = loggedRow.parse(logged);
  if (rows.length === 0) {
    return fail("This activity changed meanwhile. Reload the page.");
  }

  revalidatePath("/customers", "layout");
  revalidatePath("/calendar");
  revalidatePath("/projects");

  const followUpAt = form.nextDate && parseMytInput(`${form.nextDate}T10:00`);
  if (followUpAt) {
    // RLS logs every activity under the signed-in person, so the follow-up is theirs.
    const { error: followUpError } = await supabase.from("activities").insert({
      contact_id: activity.contact_id,
      owner_id: me.id,
      type: "visit",
      purpose: form.nextStep ?? "Follow-up",
      starts_at: followUpAt.toISOString(),
      status: "planned",
    });
    if (followUpError) {
      console.error("Could not plan follow-up", followUpError);
      return fail(
        "The outcome is logged, but the follow-up could not be planned. Add it from the calendar.",
      );
    }
  }

  return { error: null, late: rows[0]?.late_logged ?? false };
}

type LeadResult =
  | { ok: false; error: string }
  | { ok: true; projectId: string };

/** A Lead / Enquiry project for the visited customer, checked as any new project is. */
async function addProjectLead(
  me: Pick<Profile, "id" | "jobRole">,
  salespersonId: string,
  contactId: string,
  form: OutcomeForm,
): Promise<LeadResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("account_type, passed_by, contact_owners(profile_id)")
    .eq("id", contactId)
    .maybeSingle();
  if (error) {
    console.error("Could not load customer", error);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!data) {
    return {
      ok: false,
      error: "Could not find that customer. Reload the page.",
    };
  }
  const customer = customerRow.parse(data);
  const ownsCustomer = customer.contact_owners.some(
    (owner) => owner.profile_id === me.id,
  );
  if (!canCreateProject(me.jobRole, ownsCustomer)) {
    return {
      ok: false,
      error:
        "Only the customer's owners, the MD or the Sales Director can add a project lead for this customer.",
    };
  }

  const project = projectFormSchema.safeParse({
    contactId,
    name: form.leadName,
    // The visit form has no source; a lead found on one's own visit is own prospecting.
    leadSource: "cold_call",
    stage: "lead",
    qtySqft: "",
    value: form.leadValue,
    picId: salespersonId,
    supportId: "",
    commissionType: customer.account_type,
    passedBy: customer.passed_by ?? "",
    nextAction: form.nextStep ?? "",
    nextActionDate: form.nextDate ?? "",
    notes: form.leadStart
      ? `Expected start: ${formatMonth(`${form.leadStart}-01`)}`
      : "",
  });
  if (!project.success) {
    return {
      ok: false,
      error: project.error.issues[0]?.message ?? "Check the project lead.",
    };
  }
  const lead = project.data;

  const { data: inserted, error: insertError } = await supabase
    .from("projects")
    .insert({
      contact_id: lead.contactId,
      name: lead.name,
      lead_source: lead.leadSource,
      stage: lead.stage,
      qty_sqft: lead.qtySqft,
      value: lead.value,
      pic_id: lead.picId,
      passed_by: lead.passedBy,
      commission_type: lead.commissionType,
      next_action: lead.nextAction,
      next_action_date: lead.nextActionDate,
      notes: lead.notes,
    })
    .select("id")
    .single();
  if (insertError) {
    console.error("Could not add project lead", insertError);
    return { ok: false, error: "Could not add the project lead. Try again." };
  }
  return {
    ok: true,
    projectId: z.object({ id: z.string() }).parse(inserted).id,
  };
}

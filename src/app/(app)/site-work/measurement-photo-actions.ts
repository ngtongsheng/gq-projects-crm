"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import {
  canCancelShootRequest,
  canRequestShoot,
  isDriveFolderLink,
  SHOOT_KINDS,
} from "@/lib/domain/site-photos";
import { optionalId, optionalText, textField } from "@/lib/form/form-fields";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import type { SiteWorkResult } from "./actions";

const NOT_RECEIVER =
  "Only the salesperson it was sent to, or a manager, can mark this measurement received.";
const NOT_POSTER =
  "Only the supervisor who logged these photos, or a manager, can mark them posted.";
const NOT_SAVER =
  "These photos are not posted yet, or you cannot save them to Drive.";
const NOT_REQUESTER =
  "Only sales, the marketing team, the MD or the Sales Director can request a shooting.";
const NOT_CANCELLER = "Only whoever asked, or a manager, can cancel a request.";
const NOT_FOUND_LOG = "Could not find that site visit. Reload the page.";
const NOT_FOUND_REQUEST = "Could not find that request. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const logId = z.uuid({ error: NOT_FOUND_LOG });

function refresh() {
  revalidatePath("/site-work");
  // The MOF's own page lists the same measurements and photos.
  revalidatePath("/site-work/[mofId]", "page");
}

/** The salesperson (or a manager) taps Received on a measurement. The database checks who. */
export async function receiveMeasurement(
  siteLogId: string,
): Promise<SiteWorkResult> {
  await requirePage("site");
  const parsed = logId.safeParse(siteLogId);
  if (!parsed.success) return { error: NOT_FOUND_LOG };

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_measurement", {
    site_log_id: parsed.data,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_RECEIVER };
    console.error("Could not mark the measurement received", error);
    return { error: TRY_AGAIN };
  }
  refresh();
  return { error: null };
}

/** The supervisor (or a manager) says the photos are posted in the job WhatsApp group. */
export async function markPhotosPosted(
  siteLogId: string,
): Promise<SiteWorkResult> {
  await requirePage("site");
  const parsed = logId.safeParse(siteLogId);
  if (!parsed.success) return { error: NOT_FOUND_LOG };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_photos_posted", {
    site_log_id: parsed.data,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_POSTER };
    console.error("Could not mark the photos posted", error);
    return { error: TRY_AGAIN };
  }
  refresh();
  return { error: null };
}

const driveForm = z.object({
  siteLogId: logId,
  link: z.string().trim().refine(isDriveFolderLink, {
    error:
      "Paste the Google Drive folder link (it starts with https://drive.google.com/).",
  }),
});

/** Sales support saves the photos into the job's Drive folder and records its link. */
export async function savePhotosToDrive(input: {
  siteLogId: string;
  link: string;
}): Promise<SiteWorkResult> {
  await requirePage("site");
  const parsed = driveForm.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the link." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_photos_to_drive", {
    site_log_id: parsed.data.siteLogId,
    drive_link: parsed.data.link,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_SAVER };
    if (error.code === "23514") {
      return { error: "That link is not a web address. Paste it again." };
    }
    console.error("Could not save the photos to Drive", error);
    return { error: TRY_AGAIN };
  }
  refresh();
  return { error: null };
}

const requestForm = z.object({
  mofId: z.uuid("Choose the MOF."),
  kind: z.enum(SHOOT_KINDS, "Choose what to shoot."),
  dueOn: z.iso.date("Set the due date."),
  bestOn: optionalText(10).pipe(z.iso.date("Choose the best date.").nullable()),
  supervisorId: optionalId("Choose the site supervisor."),
  note: optionalText(300, "Keep the note under 300 characters."),
});

/** Asks the site team for good photos or video of a job worth showing. */
export async function requestShooting(
  formData: FormData,
): Promise<SiteWorkResult> {
  const me = await requirePage("site");
  if (!canRequestShoot(me.jobRole)) return { error: NOT_REQUESTER };

  const parsed = requestForm.safeParse({
    mofId: textField(formData, "mofId"),
    kind: textField(formData, "kind"),
    dueOn: textField(formData, "dueOn"),
    bestOn: textField(formData, "bestOn"),
    supervisorId: textField(formData, "supervisorId"),
    note: textField(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const request = parsed.data;
  if (request.dueOn < todayMyt()) {
    return { error: "The due date cannot be in the past." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("shoot_requests").insert({
    mof_id: request.mofId,
    kind: request.kind,
    due_on: request.dueOn,
    best_on: request.bestOn,
    supervisor_id: request.supervisorId,
    note: request.note,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_REQUESTER };
    if (error.code === "23503") return { error: "Could not find that MOF." };
    console.error("Could not save the shooting request", error);
    return { error: TRY_AGAIN };
  }
  refresh();
  return { error: null };
}

/** Takes back a shooting request nobody has shot yet. */
export async function cancelShootRequest(
  requestId: string,
  createdById: string,
): Promise<SiteWorkResult> {
  const me = await requirePage("site");
  const parsed = z.uuid({ error: NOT_FOUND_REQUEST }).safeParse(requestId);
  if (!parsed.success) return { error: NOT_FOUND_REQUEST };
  if (!canCancelShootRequest(me, { createdById })) {
    return { error: NOT_CANCELLER };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shoot_requests")
    .update({ status: "cancelled" })
    .eq("id", parsed.data)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_CANCELLER };
    console.error("Could not cancel the shooting request", error);
    return { error: TRY_AGAIN };
  }
  // A request someone already shot is no longer open, so the update matches nothing.
  if (data.length === 0) return { error: NOT_FOUND_REQUEST };
  refresh();
  return { error: null };
}

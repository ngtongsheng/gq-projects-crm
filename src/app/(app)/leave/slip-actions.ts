"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import {
  canConfirmOriginalSlip,
  canUploadSlip,
} from "@/lib/domain/leave-approval";
import { AttachmentPath, AttachmentType } from "@/lib/storage/attachment-rules";
import { createReadLink } from "@/lib/storage/signed-url";
import { createUploadTarget, type UploadTarget } from "@/lib/storage/upload";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadLeave } from "./leave-load";

const NOT_FOUND = "Could not find that leave. Reload the page.";
const NOT_ALLOWED = "You cannot do that on this leave.";
const NOT_AVAILABLE = "That slip is not available.";

const leaveId = z.uuid({ error: NOT_FOUND });

export type SlipResult = { error: string | null };
export type UploadTargetResult =
  | { error: string }
  | { error: null; target: UploadTarget };

const uploadForm = z.object({
  id: leaveId,
  fileName: z.string(),
  contentType: z.string(),
  size: z.number(),
});

/**
 * Step one of a slip upload: check this person may add the MC or hospitalisation slip, then hand
 * back a one-file upload token for leave/<request id>/.
 */
export async function requestSlipUpload(
  id: string,
  file: { fileName: string; contentType: string; size: number },
): Promise<UploadTargetResult> {
  const me = await requirePage("leave");
  const parsed = uploadForm.safeParse({ id, ...file });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the file." };
  }

  const supabase = await createClient();
  const leave = await loadLeave(supabase, parsed.data.id);
  if (!leave) return { error: NOT_FOUND };
  if (!canUploadSlip(leave, me)) return { error: NOT_ALLOWED };

  const target = await createUploadTarget(supabase, {
    area: "leave",
    recordId: leave.id,
    fileName: parsed.data.fileName,
    contentType: parsed.data.contentType,
    size: parsed.data.size,
  });
  return target.ok
    ? { error: null, target: target.target }
    : { error: target.error };
}

/** A slip the browser has already uploaded. */
const SlipInput = z.object({
  path: AttachmentPath,
  fileName: z.string().trim().min(1).max(200),
  contentType: AttachmentType,
});

/** Records (or replaces) the uploaded slip on the leave; the database stamps when. */
export async function addLeaveSlip(
  id: string,
  file: unknown,
): Promise<SlipResult> {
  const me = await requirePage("leave");
  const parsedId = leaveId.safeParse(id);
  if (!parsedId.success) return { error: NOT_FOUND };
  const parsedFile = SlipInput.safeParse(file);
  if (
    !parsedFile.success ||
    !parsedFile.data.path.startsWith(`leave/${parsedId.data}/`)
  ) {
    return { error: "The slip could not be read. Upload it again." };
  }

  const supabase = await createClient();
  const leave = await loadLeave(supabase, parsedId.data);
  if (!leave) return { error: NOT_FOUND };
  if (!canUploadSlip(leave, me)) return { error: NOT_ALLOWED };

  const { error } = await supabase
    .from("leave_requests")
    .update({
      slip_path: parsedFile.data.path,
      slip_file_name: parsedFile.data.fileName,
      slip_content_type: parsedFile.data.contentType,
    })
    .eq("id", leave.id);
  if (error) {
    if (error.code === "42501") return { error: NOT_ALLOWED };
    console.error("Could not save the leave slip", error);
    return { error: "Could not save the slip. Try again." };
  }
  revalidatePath("/leave");
  return { error: null };
}

/** HR & Accounts (or the MD) ticks that the original slip was handed in. */
export async function confirmOriginalSlip(
  id: string,
  given: boolean,
): Promise<SlipResult> {
  const me = await requirePage("leave");
  const parsed = z
    .object({ id: leaveId, given: z.boolean() })
    .safeParse({ id, given });
  if (!parsed.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const leave = await loadLeave(supabase, parsed.data.id);
  if (!leave) return { error: NOT_FOUND };
  if (!canConfirmOriginalSlip(leave, me)) {
    return { error: "Only HR & Accounts confirms the original slip." };
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({ original_given_to_hr: parsed.data.given })
    .eq("id", leave.id);
  if (error) {
    if (error.code === "42501") return { error: NOT_ALLOWED };
    console.error("Could not tick the original slip", error);
    return { error: "Could not save. Try again." };
  }
  revalidatePath("/leave");
  return { error: null };
}

export type OpenSlipResult = { error: string } | { error: null; url: string };

/** A short-lived link to the slip, for anyone who can see the leave. */
export async function openLeaveSlip(id: string): Promise<OpenSlipResult> {
  await requirePage("leave");
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { error: NOT_AVAILABLE };

  // Row-level security hides leave this person cannot see.
  const supabase = await createClient();
  const leave = await loadLeave(supabase, parsedId.data);
  if (!leave?.slipPath) return { error: NOT_AVAILABLE };

  const admin = createAdminClient();
  if (!admin) {
    return { error: "Files open on the preview link or the live site." };
  }
  const link = await createReadLink(admin, leave.slipPath);
  return link.ok ? { error: null, url: link.url } : { error: link.error };
}

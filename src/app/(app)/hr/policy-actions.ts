"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canSeeHr } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { POLICY_CATEGORIES } from "@/lib/domain/hr-policy";
import { logServerError } from "@/lib/log-server-error";
import { AttachmentPath } from "@/lib/storage/attachment-rules";
import { createReadLink } from "@/lib/storage/signed-url";
import { createUploadTarget, type UploadTarget } from "@/lib/storage/upload";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PolicyResult = { error: string | null };
export type UploadTargetResult =
  | { error: string }
  | { error: null; target: UploadTarget };
export type OpenPolicyResult = { error: string } | { error: null; url: string };

const NOT_ALLOWED = "Only the Managing Director and HR & Accounts change this.";
const NOT_FOUND = "Could not find that policy. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";
const PDF_ONLY = "Policy documents are PDFs. Choose a PDF.";

const policyId = z.uuid({ error: NOT_FOUND });

const uploadForm = z.object({
  id: policyId,
  fileName: z.string(),
  contentType: z.literal("application/pdf", { error: PDF_ONLY }),
  size: z.number(),
});

/**
 * Step one of a policy upload: hand back a one-file upload token for hr-policies/<document id>/.
 * The id is chosen by the browser before the row exists, so the row can carry the file from its
 * first save (the table checks the file sits under its own id).
 */
export async function requestPolicyUpload(
  id: string,
  file: { fileName: string; contentType: string; size: number },
): Promise<UploadTargetResult> {
  const me = await requirePage("hr");
  if (!canSeeHr(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = uploadForm.safeParse({ id, ...file });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the file." };
  }

  const target = await createUploadTarget(await createClient(), {
    area: "hr-policies",
    recordId: parsed.data.id,
    fileName: parsed.data.fileName,
    contentType: parsed.data.contentType,
    size: parsed.data.size,
  });
  return target.ok
    ? { error: null, target: target.target }
    : { error: target.error };
}

const policyForm = z
  .object({
    id: policyId,
    replacesId: z.uuid({ error: NOT_FOUND }).nullable(),
    category: z.enum(POLICY_CATEGORIES, { error: "Choose the category." }),
    title: z
      .string()
      .trim()
      .min(1, "Key in the title.")
      .max(200, "Keep the title under 200 characters."),
    version: z
      .string()
      .trim()
      .min(1, "Key in the version.")
      .max(40, "Keep the version under 40 characters."),
    effectiveOn: z.iso.date("Choose the effective date."),
    isCommissionScheme: z.boolean(),
    link: z.union([
      z.literal(""),
      z
        .string()
        .trim()
        .max(500, "Keep the link under 500 characters.")
        .regex(/^https:\/\/\S+$/, "Paste the full https:// link."),
    ]),
    note: z.string().trim().max(500, "Keep the note under 500 characters."),
    file: z
      .object({
        path: AttachmentPath,
        fileName: z.string().trim().min(1).max(200),
        contentType: z.literal("application/pdf", { error: PDF_ONLY }),
      })
      .nullable(),
  })
  .refine((form) => !(form.file && form.link), {
    message: "Use a link or a PDF, not both.",
  })
  .refine(
    (form) =>
      !form.file || form.file.path.startsWith(`hr-policies/${form.id}/`),
    {
      message: "The PDF could not be read. Upload it again.",
    },
  );

type PolicyForm = z.infer<typeof policyForm>;

/** Adds a policy document; naming one it replaces moves that one to Older. */
export async function addPolicy(input: unknown): Promise<PolicyResult> {
  const me = await requirePage("hr");
  if (!canSeeHr(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = policyForm.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("hr_policy_documents").insert({
    id: form.id,
    category: form.category,
    title: form.title,
    version: form.version,
    effective_on: form.effectiveOn,
    is_commission_scheme: form.isCommissionScheme,
    link: form.link || null,
    note: form.note,
    replaces_id: form.replacesId,
    ...fileColumns(form.file),
  });
  if (error) {
    if (error.code === "23505" && error.message.includes("replaces_id")) {
      return { error: "That policy was already replaced. Reload the page." };
    }
    return fail(error, me.id, form.id);
  }
  revalidatePath("/hr");
  return { error: null };
}

/**
 * Changes a policy document's details. A new PDF or a link replaces what it had; with neither
 * given the PDF stays and the link is cleared. What it replaces never changes.
 */
export async function updatePolicy(input: unknown): Promise<PolicyResult> {
  const me = await requirePage("hr");
  if (!canSeeHr(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = policyForm.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_policy_documents")
    .update({
      category: form.category,
      title: form.title,
      version: form.version,
      effective_on: form.effectiveOn,
      is_commission_scheme: form.isCommissionScheme,
      link: form.link || null,
      note: form.note,
      ...(form.file || form.link ? fileColumns(form.file) : {}),
    })
    .eq("id", form.id)
    .select("id");
  if (error) return fail(error, me.id, form.id);
  if (data.length === 0) return { error: NOT_FOUND };
  revalidatePath("/hr");
  return { error: null };
}

function fileColumns(file: PolicyForm["file"]) {
  return {
    file_path: file?.path ?? null,
    file_name: file?.fileName ?? null,
    file_content_type: file?.contentType ?? null,
    file_uploaded_at: file ? new Date().toISOString() : null,
  };
}

/** A short-lived link to the policy's PDF. */
export async function openPolicyFile(id: string): Promise<OpenPolicyResult> {
  const me = await requirePage("hr");
  if (!canSeeHr(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = policyId.safeParse(id);
  if (!parsed.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_policy_documents")
    .select("file_path")
    .eq("id", parsed.data)
    .maybeSingle();
  if (error) {
    logServerError("Could not load the policy file", error, {
      profileId: me.id,
      recordId: parsed.data,
    });
    return { error: "That file is not available." };
  }
  const path = z.object({ file_path: z.string() }).safeParse(data);
  if (!path.success) return { error: "That file is not available." };

  const admin = createAdminClient();
  if (!admin) {
    return { error: "Files open on the preview link or the live site." };
  }
  const link = await createReadLink(admin, path.data.file_path);
  return link.ok ? { error: null, url: link.url } : { error: link.error };
}

function fail(
  error: { code?: string; message?: string },
  profileId: string,
  recordId: string,
): PolicyResult {
  if (error.code === "42501") return { error: NOT_ALLOWED };
  logServerError("Could not save the policy", error, { profileId, recordId });
  return { error: TRY_AGAIN };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { needsReceipt } from "@/lib/domain/claim-expense";
import { CLAIM_EXPENSE_TYPES } from "@/lib/domain/monthly-claim";
import { logServerError } from "@/lib/log-server-error";
import { AttachmentPath, IMAGE_TYPES } from "@/lib/storage/attachment-rules";
import { createReadLink } from "@/lib/storage/signed-url";
import { createUploadTarget, type UploadTarget } from "@/lib/storage/upload";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CLAIM_LOCKED, isNotAllowed, TRY_AGAIN } from "./own-claim";

export type ReceiptResult = { error: string | null };
export type ReceiptTargetResult =
  | { error: string }
  | { error: null; target: UploadTarget };
export type OpenReceiptResult =
  | { error: string }
  | { error: null; url: string };

const NOT_FOUND = "Could not find that expense. Reload the page.";
const NOT_AVAILABLE = "That receipt is not available.";
const IMAGE_ONLY = "Receipts are photos: choose a JPEG, PNG or WebP.";

const expenseRow = z.object({
  claim_id: z.uuid(),
  expense_type: z.enum(CLAIM_EXPENSE_TYPES),
  receipt_path: z.string().nullable(),
});

async function loadExpense(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string,
) {
  const id = z.uuid().safeParse(expenseId);
  if (!id.success) return null;
  const { data, error } = await supabase
    .from("monthly_claim_expenses")
    .select("claim_id, expense_type, receipt_path")
    .eq("id", id.data)
    .maybeSingle();
  if (error) throw new Error(`Could not load the expense: ${error.message}`);
  return data ? { id: id.data, ...expenseRow.parse(data) } : null;
}

const uploadForm = z.object({
  fileName: z.string(),
  contentType: z.enum(IMAGE_TYPES, { error: IMAGE_ONLY }),
  size: z.number(),
});

/**
 * Step one of a receipt upload: check the expense is on the person's open claim and takes a
 * receipt, then hand back a one-file upload token for claims/<claim id>/.
 */
export async function requestReceiptUpload(
  expenseId: string,
  file: { fileName: string; contentType: string; size: number },
): Promise<ReceiptTargetResult> {
  await requirePage("claims");
  const parsed = uploadForm.safeParse(file);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the file." };
  }

  const supabase = await createClient();
  const expense = await loadExpense(supabase, expenseId);
  if (!expense) return { error: NOT_FOUND };
  if (!needsReceipt(expense.expense_type)) {
    return { error: "Meals and mileage have no receipt." };
  }

  const target = await createUploadTarget(supabase, {
    area: "claims",
    recordId: expense.claim_id,
    ...parsed.data,
  });
  return target.ok
    ? { error: null, target: target.target }
    : { error: target.error };
}

const ReceiptInput = z.object({
  path: AttachmentPath,
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(IMAGE_TYPES, { error: IMAGE_ONLY }),
});

/**
 * Records (or replaces) the uploaded receipt on the expense. The database gives a first receipt
 * the claim's next number (R1, R2...) and keeps it when the photo is replaced.
 */
export async function attachReceipt(
  expenseId: string,
  file: unknown,
): Promise<ReceiptResult> {
  const me = await requirePage("claims");
  const parsed = ReceiptInput.safeParse(file);
  if (!parsed.success) {
    return { error: "The receipt could not be read. Upload it again." };
  }

  const supabase = await createClient();
  const expense = await loadExpense(supabase, expenseId);
  if (!expense) return { error: NOT_FOUND };
  if (
    !needsReceipt(expense.expense_type) ||
    !parsed.data.path.startsWith(`claims/${expense.claim_id}/`)
  ) {
    return { error: "The receipt could not be read. Upload it again." };
  }

  const { data, error } = await supabase
    .from("monthly_claim_expenses")
    .update({
      receipt_path: parsed.data.path,
      receipt_file_name: parsed.data.fileName,
      receipt_content_type: parsed.data.contentType,
    })
    .eq("id", expense.id)
    .select("id");
  if (error) {
    if (isNotAllowed(error)) return { error: CLAIM_LOCKED };
    logServerError("Could not save the claim receipt", error, {
      profileId: me.id,
      recordId: expense.id,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: CLAIM_LOCKED };

  revalidatePath("/claims");
  return { error: null };
}

/** A short-lived link to the receipt photo, for anyone who can see the claim. */
export async function openReceipt(
  expenseId: string,
): Promise<OpenReceiptResult> {
  await requirePage("claims");
  // Row-level security hides expenses on claims this person cannot see.
  const supabase = await createClient();
  const expense = await loadExpense(supabase, expenseId);
  if (!expense?.receipt_path) return { error: NOT_AVAILABLE };

  const admin = createAdminClient();
  if (!admin) {
    return { error: "Files open on the preview link or the live site." };
  }
  const link = await createReadLink(admin, expense.receipt_path);
  return link.ok ? { error: null, url: link.url } : { error: link.error };
}

import { uploadToTarget } from "@/lib/storage/upload";
import { attachReceipt, requestReceiptUpload } from "./receipt-actions";

/** Browser side: ask the server to sign the upload, send the (already downscaled) photo, then record it on the expense. */
export async function uploadReceipt(
  expenseId: string,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const signed = await requestReceiptUpload(expenseId, {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });
  if (signed.error !== null) return { ok: false, error: signed.error };
  const sent = await uploadToTarget(file, signed.target);
  if (!sent.ok) return sent;
  const saved = await attachReceipt(expenseId, {
    path: sent.path,
    fileName: file.name,
    contentType: file.type,
  });
  return saved.error === null
    ? { ok: true }
    : { ok: false, error: saved.error };
}

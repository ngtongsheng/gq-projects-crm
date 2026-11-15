import { uploadToTarget } from "@/lib/storage/upload";
import { addLeaveSlip, requestSlipUpload } from "./slip-actions";

/** Browser side: ask the server to sign the upload, send the (already checked) file, then record it on the leave. */
export async function uploadLeaveSlip(
  leaveId: string,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const signed = await requestSlipUpload(leaveId, {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });
  if (signed.error !== null) return { ok: false, error: signed.error };
  const sent = await uploadToTarget(file, signed.target);
  if (!sent.ok) return sent;
  const saved = await addLeaveSlip(leaveId, {
    path: sent.path,
    fileName: file.name,
    contentType: file.type,
  });
  return saved.error === null
    ? { ok: true }
    : { ok: false, error: saved.error };
}

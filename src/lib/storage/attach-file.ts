import type { UploadOutcome } from "@/components/app/file-upload";
import { prepareAttachment } from "./downscale";

export type AttachOutcome =
  | { ok: true; name: string }
  | { ok: false; error: string };

export const UPLOAD_FAILED_MESSAGE = "The upload failed. Try again.";

/**
 * Checks, shrinks and sends one picked file. Always settles with an outcome: a photo the browser
 * cannot read or a send that throws becomes a failure message, so the picker never stays on "Uploading...".
 */
export async function attachFile(
  file: File,
  upload: (file: File) => Promise<UploadOutcome>,
): Promise<AttachOutcome> {
  try {
    const prepared = await prepareAttachment(file);
    if (!prepared.ok) return { ok: false, error: prepared.error };
    const outcome = await upload(prepared.file);
    return outcome.ok
      ? { ok: true, name: prepared.file.name }
      : { ok: false, error: outcome.error };
  } catch {
    return { ok: false, error: UPLOAD_FAILED_MESSAGE };
  }
}

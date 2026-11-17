import { uploadToTarget } from "@/lib/storage/upload";
import { requestCustomSamplePhotoUpload } from "./custom-sample-actions";

/** Browser side: ask the server to sign the upload under the sample's id, then send the (already checked, shrunk) photo. */
export async function uploadCustomSamplePhoto(
  sampleId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const signed = await requestCustomSamplePhotoUpload(sampleId, {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });
  if (signed.error !== null) return { ok: false, error: signed.error };
  return uploadToTarget(file, signed.target);
}

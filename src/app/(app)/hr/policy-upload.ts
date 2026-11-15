import { uploadToTarget } from "@/lib/storage/upload";
import { requestPolicyUpload } from "./policy-actions";

export type UploadedPolicyFile = {
  path: string;
  fileName: string;
  contentType: "application/pdf";
};

/** Browser side: ask the server to sign the upload, then send the (already checked) PDF. */
export async function uploadPolicyPdf(
  documentId: string,
  file: File,
): Promise<
  { ok: true; file: UploadedPolicyFile } | { ok: false; error: string }
> {
  const signed = await requestPolicyUpload(documentId, {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });
  if (signed.error !== null) return { ok: false, error: signed.error };
  const sent = await uploadToTarget(file, signed.target);
  if (!sent.ok) return sent;
  return {
    ok: true,
    file: {
      path: sent.path,
      fileName: file.name,
      contentType: "application/pdf",
    },
  };
}

import { uploadToTarget } from "@/lib/storage/upload";
import { requestTaskUpload } from "./task-file-actions";
import type { TaskFileInput } from "./task-file-input";

/** Browser side: ask the server to sign the upload, then send the (already checked) file. */
export async function uploadTaskFile(
  taskId: string,
  kind: "reference" | "work",
  file: File,
): Promise<{ ok: true; file: TaskFileInput } | { ok: false; error: string }> {
  const signed = await requestTaskUpload(taskId, kind, {
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
      contentType: file.type as TaskFileInput["contentType"],
    },
  };
}

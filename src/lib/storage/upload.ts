import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import {
  ATTACHMENTS_BUCKET,
  buildAttachmentPath,
  UploadRequest,
} from "./attachment-rules";

export type UploadTarget = { path: string; token: string };
export type UploadTargetResult =
  | { ok: true; target: UploadTarget }
  | { ok: false; error: string };

/** The part of a Supabase client that signs uploads; the signed-in person's client, so the storage policy applies. */
type UploadSigner = {
  storage: {
    from(bucket: string): {
      createSignedUploadUrl(path: string): Promise<{
        data: { token: string; path: string } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

/**
 * Server side, step one of an upload: check what the browser says it is sending and hand back a
 * one-file upload token. The caller (a module's server action) first checks the person may add
 * to this record.
 */
export async function createUploadTarget(
  supabase: UploadSigner,
  request: unknown,
): Promise<UploadTargetResult> {
  const parsed = UploadRequest.safeParse(request);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the file.",
    };
  }

  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUploadUrl(buildAttachmentPath(parsed.data));
  if (error || !data) {
    console.error("Could not sign a file upload", error);
    return { ok: false, error: "Could not upload the file. Try again." };
  }
  return { ok: true, target: { path: data.path, token: data.token } };
}

/** Browser side, step two: send the (already checked and downscaled) file with the token. Returns the stored path. */
export async function uploadToTarget(
  file: File,
  target: UploadTarget,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { data, error } = await createBrowserClient()
    .storage.from(ATTACHMENTS_BUCKET)
    .uploadToSignedUrl(target.path, target.token, file, {
      contentType: file.type,
    });
  if (error || !data) {
    return { ok: false, error: "Could not upload the file. Try again." };
  }
  return { ok: true, path: data.path };
}

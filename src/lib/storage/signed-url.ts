import { ATTACHMENTS_BUCKET, AttachmentPath } from "./attachment-rules";

/** Long enough to open a page and click a file, short enough that a copied link soon stops working. */
export const READ_LINK_SECONDS = 300;

export type ReadLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

type ReadSigner = {
  storage: {
    from(bucket: string): {
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{
        data: { signedUrl: string } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

/**
 * A short-lived link to view a stored file. Nobody can read a file through the API directly, so
 * this needs the service-role client (createAdminClient), and the caller must first have checked
 * that the person may see the record the file belongs to. While View as is on, this call is
 * allowed (see view-only-fetch.ts), so the MD sees the files that person sees.
 */
export async function createReadLink(
  admin: ReadSigner,
  path: string,
): Promise<ReadLinkResult> {
  const parsed = AttachmentPath.safeParse(path);
  if (!parsed.success)
    return { ok: false, error: "That file is not available." };

  const { data, error } = await admin.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(parsed.data, READ_LINK_SECONDS);
  if (error || !data) {
    console.error("Could not sign a file link", error);
    return { ok: false, error: "That file is not available." };
  }
  return { ok: true, url: data.signedUrl };
}

import { z } from "zod";

/** Created by supabase/migrations/20261114160000_storage_attachments.sql; its limits are repeated there. */
export const ATTACHMENTS_BUCKET = "attachments";
export const MAX_ATTACHMENT_BYTES = 1_572_864; // 1.5 MB
/** Images are shrunk to this long edge before upload. */
export const IMAGE_LONG_EDGE_PX = 1100;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ATTACHMENT_TYPES = [...IMAGE_TYPES, "application/pdf"] as const;

export const AttachmentType = z.enum(ATTACHMENT_TYPES, {
  error: "Choose a photo (JPEG, PNG or WebP) or a PDF.",
});
export type AttachmentType = z.infer<typeof AttachmentType>;

export function isImageType(type: string): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}

const AREA = /^[a-z][a-z0-9-]*$/;

/** What the browser sends before it uploads: where the file belongs and what it is. */
export const UploadRequest = z.object({
  area: z.string().regex(AREA, "Unknown file area."),
  recordId: z.uuid(),
  fileName: z.string().trim().min(1, "The file needs a name.").max(200),
  contentType: AttachmentType,
  size: z
    .number()
    .int()
    .positive("The file is empty.")
    .max(MAX_ATTACHMENT_BYTES, "The file is over 1.5 MB."),
});
export type UploadRequest = z.infer<typeof UploadRequest>;

/** A stored file's path: <area>/<record-id>/<file>. The same shape the storage policy enforces. */
export const AttachmentPath = z
  .string()
  .max(400)
  .regex(
    /^[a-z][a-z0-9-]*\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9_-][a-z0-9._-]*$/,
    "Not a stored file.",
  );

const MAX_NAME_LENGTH = 80;

/** Lowercase letters, digits, dot, dash and underscore only, so the name is safe in a path and a link. */
function safeFileName(fileName: string): string {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/-+(?=\.)/g, "")
    .replace(/^[-.]+/, "");
  return cleaned.slice(-MAX_NAME_LENGTH) || "file";
}

/**
 * <area>/<record-id>/<random>-<file>. The random part means two uploads never overwrite each other,
 * so nothing needs upsert (and the storage policy allows only adding).
 */
export function buildAttachmentPath(
  request: Pick<UploadRequest, "area" | "recordId" | "fileName">,
  newId: () => string = () => crypto.randomUUID().slice(0, 8),
): string {
  return `${request.area}/${request.recordId}/${newId()}-${safeFileName(request.fileName)}`;
}

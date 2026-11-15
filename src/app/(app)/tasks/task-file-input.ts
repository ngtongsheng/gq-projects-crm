import { z } from "zod";
import { AttachmentPath, AttachmentType } from "@/lib/storage/attachment-rules";

/** A file the browser has already uploaded, ready to be recorded against a task. */
export const TaskFileInput = z.object({
  path: AttachmentPath,
  fileName: z.string().trim().min(1).max(200),
  contentType: AttachmentType,
});
export type TaskFileInput = z.infer<typeof TaskFileInput>;

/** Task files live under tasks/<task-id>/, the same folder the upload was signed for. */
export const isInTaskFolder = (file: TaskFileInput, taskId: string) =>
  file.path.startsWith(`tasks/${taskId}/`);

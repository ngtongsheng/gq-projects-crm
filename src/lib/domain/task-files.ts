export type TaskFileKind = "reference" | "work";

type VersionedFile = { kind: TaskFileKind; version: number | null };

/** Every file sent in one submission shares a version; the next submission is one higher (demo tkSubmit). */
export const nextWorkVersion = (files: readonly VersionedFile[]): number =>
  files.reduce(
    (latest, file) =>
      file.kind === "work" ? Math.max(latest, file.version ?? 1) : latest,
    0,
  ) + 1;

/** The small label beside a file: "reference" or "work v2". */
export const taskFileTag = (file: VersionedFile): string =>
  file.kind === "reference" ? "reference" : `work v${file.version ?? 1}`;

/** The log line for a submission, with the files and note when there are any (demo tkSubmit). */
export function submitLogBody(
  comment: string,
  fileCount: number,
  version: number,
): string {
  const files =
    fileCount > 0
      ? ` with ${fileCount} file${fileCount > 1 ? "s" : ""} (v${version})`
      : "";
  return `Submitted for review${files}${comment ? ` · ${comment}` : ""}`;
}

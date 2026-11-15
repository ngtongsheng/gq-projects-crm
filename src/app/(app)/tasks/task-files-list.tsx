"use client";

import { FileText, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FileUpload } from "@/components/app/file-upload";
import { Button } from "@/components/ui/button";
import { formatDate, todayMyt } from "@/lib/format/date";
import { useT } from "@/lib/i18n/language-context";
import type { TaskFileRow } from "./task-detail-data";
import { addReferenceFile, openTaskFile } from "./task-file-actions";
import { uploadTaskFile } from "./task-upload";

/** Opens the file in a new tab; the tab is opened first so a phone browser does not block it. */
async function openFile(fileId: string) {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  const result = await openTaskFile(fileId);
  if (result.error !== null) {
    tab?.close();
    toast.error(result.error);
    return;
  }
  if (tab) tab.location.href = result.url;
  else window.location.href = result.url;
}

const isPdf = (name: string) => name.toLowerCase().endsWith(".pdf");

/** Reference files from the assigner and finished work by version; the assigner can add reference files. */
export function TaskFilesList({
  taskId,
  files,
  nameOf,
  canAddReference,
}: {
  taskId: string;
  files: TaskFileRow[];
  nameOf: (personId: string) => string;
  canAddReference: boolean;
}) {
  // A new key empties the picker after each file, so several can be added one after another.
  const [added, setAdded] = useState(0);
  const t = useT();

  return (
    <section className="flex flex-col gap-2" aria-label={t("Files")}>
      <h3 className="text-sm font-semibold">{t("Files")}</h3>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("No files yet.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
            >
              {isPdf(file.fileName) ? (
                <FileText
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              ) : (
                <ImageIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              )}
              <span className="min-w-0 break-all">{file.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {file.kind === "reference"
                  ? t("reference")
                  : `${t("work")} v${file.version ?? 1}`}{" "}
                · {nameOf(file.uploadedBy)} ·{" "}
                {formatDate(todayMyt(new Date(file.uploadedAt)))}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void openFile(file.id)}
              >
                {t("Open")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {canAddReference && (
        <FileUpload
          key={added}
          label={t("reference file")}
          upload={async (picked) => {
            const sent = await uploadTaskFile(taskId, "reference", picked);
            if (!sent.ok) return sent;
            const saved = await addReferenceFile(taskId, sent.file);
            if (saved.error !== null) return { ok: false, error: saved.error };
            toast.success(t("Reference file added."));
            setAdded((count) => count + 1);
            return { ok: true };
          }}
        />
      )}
    </section>
  );
}

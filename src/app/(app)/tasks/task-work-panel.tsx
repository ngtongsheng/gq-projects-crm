"use client";

import { Play, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileUpload } from "@/components/app/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/language-context";
import { moveTaskDueDate, startTask, submitTask } from "./actions";
import type { TaskFileInput } from "./task-file-input";
import { uploadTaskFile } from "./task-upload";

/** For the people on the task: start it, upload finished work, add a note and send it for review, or move the due date. */
export function TaskWorkPanel({
  taskId,
  dueOn,
  today,
  assignerName,
  revising,
  sharedWith,
  can,
  closeHref,
}: {
  taskId: string;
  dueOn: string;
  today: string;
  assignerName: string;
  revising: boolean;
  /** Everyone on a shared task, or empty when one person has it. */
  sharedWith: string[];
  can: { start: boolean; submit: boolean; moveDate: boolean };
  closeHref: string;
}) {
  const router = useRouter();
  const t = useT();
  const [files, setFiles] = useState<TaskFileInput[]>([]);
  const [note, setNote] = useState("");
  const [newDue, setNewDue] = useState(dueOn);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ error: string | null }>,
    done: string,
    close = false,
  ) {
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      if (result.error) return;
      toast.success(done);
      if (close) router.replace(closeHref, { scroll: false });
    });
  }

  return (
    <section
      aria-label={t("Your work")}
      className="flex flex-col gap-3 rounded-xl border p-3"
    >
      {can.start && (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => startTask(taskId), t("Task started."))}
        >
          <Play data-icon="inline-start" />
          {t("Start working")}
        </Button>
      )}
      {can.submit && (
        <>
          <div className="flex flex-col gap-2">
            <FileUpload
              key={files.length}
              label={revising ? t("revised work") : t("finished work")}
              disabled={pending}
              upload={async (picked) => {
                const sent = await uploadTaskFile(taskId, "work", picked);
                if (!sent.ok) return sent;
                setFiles((current) => [...current, sent.file]);
                return { ok: true };
              }}
            />
            {files.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {files.map((file) => (
                  <li key={file.path} className="flex items-center gap-2">
                    <span className="min-w-0 break-all">{file.fileName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${t("Remove")} ${file.fileName}`}
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((other) => other.path !== file.path),
                        )
                      }
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {sharedWith.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("Shared task:")} {sharedWith.join(", ")}{" "}
              {t(
                "can all upload and update it. Agree between you who submits the final version.",
              )}
            </p>
          )}
        </>
      )}
      {(can.submit || can.moveDate) && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taskNote">
            {t("Note for")} {assignerName}
          </Label>
          <Input
            id="taskNote"
            placeholder={t("e.g. Final version, also sent on WhatsApp")}
            value={note}
            maxLength={1500}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {can.submit && (
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () => submitTask(taskId, note, files),
              `${t("Sent to")} ${assignerName} ${t("for review.")}`,
              true,
            )
          }
        >
          {t("Submit for review")}
        </Button>
      )}
      {can.moveDate && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="taskNewDue">
              {t("Can't make the due date? New date")}
            </Label>
            <Input
              id="taskNewDue"
              type="date"
              min={today}
              value={newDue}
              onChange={(event) => setNewDue(event.target.value)}
              className="w-44"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending || newDue === "" || newDue === dueOn}
            onClick={() =>
              run(
                () => moveTaskDueDate(taskId, newDue, note),
                t("Due date updated."),
              )
            }
          >
            {t("Save new date")}
          </Button>
        </div>
      )}
    </section>
  );
}

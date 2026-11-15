"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/language-context";
import { approveTask, reviseTask } from "./actions";

/** For the assigner or the MD when the work is waiting: approve it, or send it back with what to change. */
export function TaskReviewPanel({
  taskId,
  assigneeName,
  closeHref,
}: {
  taskId: string;
  assigneeName: string;
  closeHref: string;
}) {
  const router = useRouter();
  const t = useT();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    startTransition(async () => {
      const result = approve
        ? await approveTask(taskId, comment)
        : await reviseTask(taskId, comment);
      setError(result.error);
      if (result.error) return;
      toast.success(
        approve
          ? t("Task completed.")
          : `${t("Sent back to")} ${assigneeName}.`,
      );
      router.replace(closeHref, { scroll: false });
    });
  }

  return (
    <section
      aria-label={t("Review")}
      className="flex flex-col gap-2 rounded-xl border p-3"
    >
      <h3 className="text-sm font-semibold">{t("Review")}</h3>
      <Input
        aria-label={t("Review comment")}
        placeholder={t("Comment (required if asking for changes)")}
        value={comment}
        maxLength={1500}
        onChange={(event) => setComment(event.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => decide(false)}
        >
          {t("Request revision")}
        </Button>
        <Button type="button" disabled={pending} onClick={() => decide(true)}>
          {t("Approve · completed")}
        </Button>
      </div>
    </section>
  );
}

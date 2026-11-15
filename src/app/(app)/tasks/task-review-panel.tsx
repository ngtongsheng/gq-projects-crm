"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        approve ? "Task completed." : `Sent back to ${assigneeName}.`,
      );
      router.replace(closeHref, { scroll: false });
    });
  }

  return (
    <section
      aria-label="Review"
      className="flex flex-col gap-2 rounded-xl border p-3"
    >
      <h3 className="text-sm font-semibold">Review</h3>
      <Input
        aria-label="Review comment"
        placeholder="Comment (required if asking for changes)"
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
          Request revision
        </Button>
        <Button type="button" disabled={pending} onClick={() => decide(true)}>
          Approve · completed
        </Button>
      </div>
    </section>
  );
}

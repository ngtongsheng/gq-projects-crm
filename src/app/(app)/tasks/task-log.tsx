"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/date";
import { commentOnTask } from "./actions";
import type { TaskLogRow } from "./task-detail-data";

/** Comments and history, newest first, with a box to add a comment (open to anyone who can see the task). */
export function TaskLog({
  taskId,
  log,
  nameOf,
}: {
  taskId: string;
  log: TaskLogRow[];
  nameOf: (personId: string) => string;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function post() {
    startTransition(async () => {
      const result = await commentOnTask(taskId, comment);
      setError(result.error);
      if (!result.error) setComment("");
    });
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Comments and history">
      <h3 className="text-sm font-semibold">Comments &amp; history</h3>
      <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
        {log.map((entry) => (
          <li key={entry.id} className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {nameOf(entry.byId)}
            </span>{" "}
            · {formatDateTime(entry.at)} · {entry.body}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          post();
        }}
      >
        <Input
          aria-label="Write a comment"
          placeholder="Write a comment"
          value={comment}
          maxLength={1500}
          onChange={(event) => setComment(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={pending}>
          Post
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

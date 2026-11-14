"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  reviewWeeklyReport,
  submitWeeklyReport,
} from "./weekly-report-actions";

/** The salesperson's "Submit weekly report" box; disabled while outcomes are still to log. */
export function SubmitWeeklyReport({
  monday,
  blocked,
}: {
  monday: string;
  blocked: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      const result = await submitWeeklyReport(monday, note);
      setError(result.error);
      if (result.error === null) {
        toast.success(
          result.late
            ? "Weekly report sent, after the deadline."
            : "Weekly report sent.",
        );
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="weekly-report-note">
          Key points for Monday's meeting (optional)
        </Label>
        <Textarea
          id="weekly-report-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. 2 quotations out, need help with the Kayu presentation"
        />
      </div>
      <div>
        <Button disabled={pending || blocked} onClick={submit}>
          Submit weekly report
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** "Mark reviewed" with an optional comment, for the MD or the salesperson's team lead. */
export function ReviewWeeklyReport({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function review() {
    startTransition(async () => {
      const result = await reviewWeeklyReport(reportId, comment);
      setError(result.error);
      if (result.error === null) toast.success("Marked reviewed.");
    });
  }

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Comment (optional)"
          placeholder="Comment (optional)"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="min-w-48 flex-1"
        />
        <Button size="sm" disabled={pending} onClick={review}>
          Mark reviewed
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

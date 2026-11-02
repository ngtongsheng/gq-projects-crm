"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reviewReport } from "./actions";

/** The reviewer's optional comment and "Mark reviewed". */
export function ReviewForm({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  function review() {
    startTransition(async () => {
      const result = await reviewReport(reportId, note);
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Marked as reviewed.");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Input
        aria-label="Comment for the person (optional)"
        placeholder="Comment (optional)"
        className="min-w-0 flex-[1_1_200px]"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button disabled={pending} onClick={review}>
        Mark reviewed
      </Button>
    </div>
  );
}

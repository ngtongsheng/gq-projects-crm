"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startOriginalRevision } from "./revision-actions";

/** A quote whose first insert worked but whose draft revision did not: offers to create the draft. */
export function MissingRevision({
  quoteId,
  salespersonName,
  canStart,
}: {
  quoteId: string;
  salespersonName: string;
  canStart: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const result = await startOriginalRevision({ quoteId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6">
      <p className="text-sm">
        This costing was not fully started, so it has no draft yet.
        {canStart
          ? " Create the draft to start adding products."
          : ` ${salespersonName} can create the draft by opening it.`}
      </p>
      {canStart && (
        <Button type="button" onClick={start} disabled={pending}>
          {pending ? "Creating..." : "Create the draft"}
        </Button>
      )}
    </div>
  );
}

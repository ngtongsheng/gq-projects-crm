"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelDo } from "./do-actions";

/**
 * Cancels a DO: the delivery is postponed and the number is never used again. Asks once, in
 * place, because the number cannot be given back.
 */
export function CancelDoButton({
  mofId,
  jobId,
  doNo,
}: {
  mofId: string;
  jobId: string;
  doNo: string;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const result = await cancelDo(mofId, jobId);
      if (result.error) toast.error(result.error);
      else toast.success(`DO ${doNo} cancelled. The number is not reused.`);
      setAsking(false);
    });
  }

  if (!asking) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
        Cancel DO no.
      </Button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      Cancel {doNo}? It is never used again.
      <Button
        size="sm"
        variant="destructive"
        onClick={cancel}
        disabled={pending}
      >
        {pending ? "Cancelling..." : "Yes, cancel it"}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setAsking(false)}>
        Keep
      </Button>
    </span>
  );
}

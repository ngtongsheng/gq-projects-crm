"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideOwnershipRequest } from "./actions";

export function DecisionButtons({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(approve: boolean) {
    startTransition(async () => {
      const result = await decideOwnershipRequest(requestId, approve);
      setError(result.error);
      if (!result.error) {
        toast.success(approve ? "Owner changed." : "Request rejected.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide(true)}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => decide(false)}
        >
          Reject
        </Button>
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}

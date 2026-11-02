"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OT_CLAIM_TYPE_LABEL, type OtDecision } from "@/lib/domain/ot-claim";
import { decideOtClaim } from "./actions";

const CHOICES: { decision: OtDecision; label: string; done: string }[] = [
  {
    decision: "ot",
    label: `Approve as ${OT_CLAIM_TYPE_LABEL.ot}`,
    done: "Approved as an OT claim.",
  },
  {
    decision: "replacement_leave",
    label: `Approve as ${OT_CLAIM_TYPE_LABEL.replacement_leave}`,
    done: "Approved as replacement leave.",
  },
  { decision: "reject", label: "Reject", done: "Overtime rejected." },
];

/** The approver's three choices for a pending claim. */
export function DecisionButtons({ claimId }: { claimId: string }) {
  const [pending, startTransition] = useTransition();

  function decide(decision: OtDecision, done: string) {
    startTransition(async () => {
      const result = await decideOtClaim(claimId, decision);
      if (result.error) toast.error(result.error);
      else toast.success(done);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CHOICES.map((choice) => (
        <Button
          key={choice.decision}
          size="sm"
          variant={choice.decision === "reject" ? "destructive" : "outline"}
          disabled={pending}
          onClick={() => decide(choice.decision, choice.done)}
        >
          {choice.label}
        </Button>
      ))}
    </div>
  );
}

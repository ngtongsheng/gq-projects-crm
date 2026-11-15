"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatRm } from "@/lib/format/money";
import { decideAppeal } from "./appeal-actions";

type DecideAppealDialogProps = {
  appealId: string;
  personName: string;
  /** "MOF no. · project · company". */
  orderTitle: string;
  reason: string;
  /** Sent on, already formatted. */
  sentOn: string;
  /** What the late cut takes off, when it takes anything. */
  lateCut: number;
};

type Decision = "approved" | "rejected";

/** The MD or HR & Accounts approves (a special favour) or rejects an appeal, with a note to the salesperson. */
export function DecideAppealDialog({
  appealId,
  personName,
  orderTitle,
  reason,
  sentOn,
  lateCut,
}: DecideAppealDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(formData: FormData, decision: Decision) {
    formData.set("decision", decision);
    startTransition(async () => {
      const result = await decideAppeal(formData);
      setError(result.error);
      if (!result.error) {
        toast.success(
          decision === "approved"
            ? "Special approval given."
            : "Appeal rejected.",
        );
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Decide</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Special approval: late collection</DialogTitle>
          <DialogDescription>
            {orderTitle}. {personName} asks to waive the late-collection cut
            {lateCut > 0 ? ` of ${formatRm(lateCut)}` : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-info-bg p-3 text-sm text-info">
          <p className="font-semibold">
            Reason from {personName}, {sentOn}
          </p>
          <p>{reason}</p>
        </div>
        <form
          onSubmit={submitKeepingValues((formData) =>
            decide(formData, "approved"),
          )}
        >
          <input type="hidden" name="appealId" value={appealId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`decide-reply-${appealId}`}>
                Note to {personName}
              </FieldLabel>
              <Input
                id={`decide-reply-${appealId}`}
                name="reply"
                maxLength={500}
                required
                defaultValue="Special approval this time only, as a favour. The late-collection rule still applies to other orders."
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (form) decide(new FormData(form), "rejected");
                }}
              >
                Reject
              </Button>
              <Button type="submit" disabled={pending}>
                Approve as special favour
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

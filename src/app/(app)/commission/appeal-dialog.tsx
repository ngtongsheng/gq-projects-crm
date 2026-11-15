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
import { Textarea } from "@/components/ui/textarea";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { formatRm } from "@/lib/format/money";
import { sendAppeal } from "./appeal-actions";

type AppealDialogProps = {
  mofId: string;
  title: string;
  /** What the late cut takes off so far. */
  lateCut: number;
  /** The decider's note on an earlier appeal that was rejected. */
  rejection: { reply: string; decidedByName: string } | null;
};

/** A salesperson asks the MD or HR & Accounts to waive the late-collection cut on one order. */
export function AppealDialog({
  mofId,
  title,
  lateCut,
  rejection,
}: AppealDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function send(formData: FormData, form: HTMLFormElement) {
    startTransition(async () => {
      const result = await sendAppeal(formData);
      setError(result.error);
      if (!result.error) {
        toast.success("Appeal sent. The MD or HR & Accounts will decide.");
        form.reset();
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {rejection ? "Appeal again" : "Appeal"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Appeal late-collection cut</DialogTitle>
          <DialogDescription>
            {title}. The late cut takes {formatRm(lateCut)} off so far. The MD
            or HR & Accounts decides; an approval is a one-time favour for this
            order.
          </DialogDescription>
        </DialogHeader>
        {rejection && (
          <p className="rounded-lg bg-bad-bg p-3 text-sm text-bad">
            <span className="font-semibold">Rejected earlier.</span>{" "}
            {rejection.decidedByName}: {rejection.reply}
          </p>
        )}
        <form onSubmit={submitKeepingValues(send)}>
          <input type="hidden" name="mofId" value={mofId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`appeal-reason-${mofId}`}>
                Why should the cut be waived?
              </FieldLabel>
              <Textarea
                id={`appeal-reason-${mofId}`}
                name="reason"
                rows={3}
                maxLength={1000}
                required
                placeholder="e.g. The client is a government body and always pays after 4 months. I followed up every month."
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Sending..." : "Send appeal"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

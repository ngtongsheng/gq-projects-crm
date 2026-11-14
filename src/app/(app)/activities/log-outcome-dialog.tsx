"use client";

import { ClipboardCheck } from "lucide-react";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { logOutcome } from "./log-outcome-action";
import { MIN_LEARNINGS, VisitResult, VisitResultLabel } from "./outcome-schema";

type LogOutcomeDialogProps = {
  activityId: string;
  /** e.g. "Visit · Follow up quotation", shown under the title. */
  summary: string;
};

/** Radix unmounts the content on close, so each opening starts blank. */
export function LogOutcomeDialog({
  activityId,
  summary,
}: LogOutcomeDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await logOutcome(formData);
      setError(result.error);
      if (result.error === null) {
        toast.success(
          result.late
            ? "Outcome logged, after this week's deadline."
            : "Outcome logged.",
        );
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ClipboardCheck data-icon="inline-start" />
          Log outcome
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log outcome</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <input type="hidden" name="activityId" value={activityId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="result">Result</FieldLabel>
              <Select name="result" required>
                <SelectTrigger id="result">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {VisitResult.options.map((result) => (
                    <SelectItem key={result} value={result}>
                      {VisitResultLabel[result]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="learnings">
                What did you learn about the company?
              </FieldLabel>
              <Textarea
                id="learnings"
                name="learnings"
                rows={3}
                placeholder="e.g. Met Joyce (ID). They are doing 2 offices in Q1, about 3,000 m². Using Interface now, open to switch if price OK."
                minLength={MIN_LEARNINGS}
                maxLength={2000}
                required
              />
              <FieldDescription>
                Who decides, new projects, competitors, budget, timing.
              </FieldDescription>
            </Field>
            <FieldSet>
              <FieldLegend variant="label">
                Project lead from this visit (optional)
              </FieldLegend>
              <Field>
                <FieldLabel htmlFor="leadName">Project name</FieldLabel>
                <Input
                  id="leadName"
                  name="leadName"
                  placeholder="e.g. Menara ABC L12 office"
                  maxLength={200}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="leadValue">Est. value (RM)</FieldLabel>
                  <Input id="leadValue" name="leadValue" inputMode="decimal" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="leadStart">Expected start</FieldLabel>
                  <Input id="leadStart" name="leadStart" type="month" />
                </Field>
              </div>
            </FieldSet>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nextStep">Next step</FieldLabel>
                <Input
                  id="nextStep"
                  name="nextStep"
                  placeholder="e.g. Send quotation"
                  maxLength={200}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="nextDate">Next follow-up date</FieldLabel>
                <Input id="nextDate" name="nextDate" type="date" />
              </Field>
            </div>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Log outcome"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

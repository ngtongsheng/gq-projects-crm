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
import { Textarea } from "@/components/ui/textarea";
import { textField } from "@/lib/form/form-fields";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { giveAwayCustomSample } from "./custom-sample-loan-actions";
import type { CustomSample } from "./custom-sample-types";

type GiveAwaySampleDialogProps = {
  sample: Pick<CustomSample, "id" | "code" | "designName">;
  /** The customer on the open loan, offered as who it was given to. */
  loanCustomer: string | null;
};

/** Gives a sample away for good (demo sheetTfGift): to whom and why. There is no undo. */
export function GiveAwaySampleDialog({
  sample,
  loanCustomer,
}: GiveAwaySampleDialogProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await giveAwayCustomSample({
        sampleId: sample.id,
        givenTo: textField(formData, "givenTo"),
        reason: textField(formData, "reason"),
      });
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      toast.success(`${sample.code} ${t("recorded as given away")}`);
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">{t("Give away…")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`${t("Give away")} ${sample.code}`}</DialogTitle>
          <DialogDescription>
            {`${sample.designName} – ${t("the sample will not come back to the office.")}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="giveAwayTo">
                {t("Given to (customer)")} *
              </FieldLabel>
              <Input
                id="giveAwayTo"
                name="givenTo"
                defaultValue={loanCustomer ?? ""}
                maxLength={200}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="giveAwayReason">{t("Reason")} *</FieldLabel>
              <Textarea
                id="giveAwayReason"
                name="reason"
                rows={3}
                maxLength={500}
                placeholder={t(
                  "e.g. client confirmed order P1555, keeps sample for site reference",
                )}
                required
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending} className="self-start">
              {pending ? t("Saving...") : t("Give away")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

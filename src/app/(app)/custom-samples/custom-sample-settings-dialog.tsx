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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { saveCustomSampleLoanDays } from "./custom-sample-settings-actions";

/** The loan period for the office (demo tfCfg). Loans already out keep their return-by date. */
export function CustomSampleSettingsDialog({ loanDays }: { loanDays: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveCustomSampleLoanDays(formData);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      toast.success(t("Saved"));
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
        <Button variant="outline">{t("Settings")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Custom samples settings")}</DialogTitle>
          <DialogDescription>
            {t("How long a salesperson may keep a borrowed sample.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="loanDays">
                {t("Loan period (days)")}
              </FieldLabel>
              <Input
                id="loanDays"
                name="loanDays"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                defaultValue={loanDays}
                required
                className="w-32"
              />
              <FieldDescription>
                {t("Loans already out keep their return-by date.")}
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending} className="self-start">
              {pending ? t("Saving...") : t("Save")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

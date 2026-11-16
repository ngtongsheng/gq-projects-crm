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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { returnClaim } from "./actions";

/** Sends the claim back to the person with what to fix (demo clRet). */
export function ClaimReturnDialog({
  claimId,
  personName,
  disabled,
  onReturned,
}: {
  claimId: string;
  personName: string;
  disabled: boolean;
  onReturned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  function send(formData: FormData) {
    startTransition(async () => {
      const result = await returnClaim(
        claimId,
        String(formData.get("reason") ?? ""),
      );
      setError(result.error);
      if (result.error === null) {
        toast.success(t("Returned."));
        setOpen(false);
        onReturned();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" disabled={disabled}>
          {t("Return")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("Return")} {personName}
            {t("'s claim")}
          </DialogTitle>
          <DialogDescription>
            {t("They see this on their claim, fix it and submit again.")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submitKeepingValues(send)}
          className="flex flex-col gap-4"
        >
          <Field>
            <FieldLabel htmlFor="return-reason">{t("What to fix")}</FieldLabel>
            <Input
              id="return-reason"
              name="reason"
              maxLength={500}
              required
              placeholder={t("e.g. Toll receipt 12 Nov missing")}
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? t("Returning...") : t("Return")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

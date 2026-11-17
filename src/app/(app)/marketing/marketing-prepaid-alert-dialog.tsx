"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { textField } from "@/lib/form/form-fields";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { savePrepaidAlert } from "./marketing-prepaid-actions";
import type { PrepaidAccount } from "./marketing-types";

/** Sets the balance an account is warned below (demo sheetMkPreAlert). Mounted while open. */
export function MarketingPrepaidAlertDialog({
  account,
  onClose,
}: {
  account: PrepaidAccount;
  onClose: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await savePrepaidAlert({
        vendorId: account.vendorId,
        alert: textField(formData, "alert"),
      });
      setError(result.error);
      if (result.error !== null) return;
      toast.success(t("Alert saved"));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("Low-balance alert")} · {account.vendorName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="prepaidAlert">
                {t("Warn when balance is below (RM)")}
              </FieldLabel>
              <Input
                id="prepaidAlert"
                name="alert"
                type="number"
                inputMode="decimal"
                min="0"
                step="100"
                className="font-mono"
                placeholder="1500"
                defaultValue={
                  account.lowBalanceAlert > 0 ? account.lowBalanceAlert : ""
                }
              />
              <FieldDescription>
                {t(
                  "The account turns red and the dashboard shows a reminder to top up. Leave blank to turn the alert off.",
                )}
              </FieldDescription>
            </Field>
            {error && <FieldError>{t(error)}</FieldError>}
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? t("Saving...") : t("Save")}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

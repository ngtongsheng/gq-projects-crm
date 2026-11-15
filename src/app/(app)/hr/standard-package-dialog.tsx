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
import type {
  StandardPackage,
  StandardPosition,
} from "@/lib/domain/staff-package";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import {
  type AllowanceDraft,
  AllowanceEditor,
  fromDrafts,
  toDrafts,
} from "./allowance-editor";
import { updateStandardPackage } from "./hr-settings-actions";

/** Edits the usual allowances and claim cap for a position. Packages already recorded do not change. */
export function StandardPackageDialog({
  position,
  title,
  standard,
}: {
  position: StandardPosition;
  title: string;
  standard: StandardPackage;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          {t("Edit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t(
              "The usual package for this position. Changing it here does not change packages already recorded: open the person to apply it.",
            )}
          </DialogDescription>
        </DialogHeader>
        <StandardPackageForm
          position={position}
          standard={standard}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function StandardPackageForm({
  position,
  standard,
  onSaved,
}: {
  position: StandardPosition;
  standard: StandardPackage;
  onSaved: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [allowances, setAllowances] = useState<AllowanceDraft[]>(() =>
    toDrafts(standard.allowances),
  );

  function save(formData: FormData) {
    const cap = formData.get("claimCap");
    const capText = typeof cap === "string" ? cap.trim() : "";
    startTransition(async () => {
      const result = await updateStandardPackage({
        position,
        allowances: fromDrafts(allowances),
        claimCap: capText === "" ? null : Number(capText),
      });
      setError(result.error);
      if (result.error !== null) return;
      toast.success(t("Standard package saved."));
      onSaved();
    });
  }

  return (
    <form onSubmit={submitKeepingValues((formData) => save(formData))}>
      <FieldGroup>
        <Field>
          <FieldLabel>{t("Fixed allowances / month")}</FieldLabel>
          <AllowanceEditor value={allowances} onChange={setAllowances} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`claimCap-${position}`}>
            {t("Petrol + toll + parking claim max / month (RM)")}
          </FieldLabel>
          <Input
            id={`claimCap-${position}`}
            name="claimCap"
            type="number"
            inputMode="decimal"
            min={0}
            step="10"
            defaultValue={standard.claimCap ?? ""}
          />
        </Field>
        {error && <FieldError>{t(error)}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? t("Saving...") : t("Save")}
        </Button>
      </FieldGroup>
    </form>
  );
}

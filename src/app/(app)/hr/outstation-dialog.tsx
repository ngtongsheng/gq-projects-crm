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
import {
  HOTEL_LEVEL_LABEL,
  HOTEL_LEVELS,
  type OutstationRules,
} from "@/lib/domain/staff-package";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { updateOutstationRules } from "./hr-settings-actions";

const MEALS = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
] as const;

const amountField = (formData: FormData, key: string): number => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : Number.NaN;
};

/** Edits the outstation meal allowance and hotel budget per night by level. */
export function OutstationDialog({ rules }: { rules: OutstationRules }) {
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
          <DialogTitle>{t("Outstation rules")}</DialogTitle>
          <DialogDescription>
            {t(
              "Who is a Manager or Director: directors automatically, managers are grade M1 and M2. You can also set it on a person's package.",
            )}
          </DialogDescription>
        </DialogHeader>
        <OutstationForm rules={rules} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function OutstationForm({
  rules,
  onSaved,
}: {
  rules: OutstationRules;
  onSaved: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await updateOutstationRules({
        breakfast: amountField(formData, "breakfast"),
        lunch: amountField(formData, "lunch"),
        dinner: amountField(formData, "dinner"),
        hotelStaff: amountField(formData, "hotelStaff"),
        hotelManager: amountField(formData, "hotelManager"),
        hotelDirector: amountField(formData, "hotelDirector"),
      });
      setError(result.error);
      if (result.error !== null) return;
      toast.success(t("Outstation rules saved."));
      onSaved();
    });
  }

  const hotelFieldName = {
    staff: "hotelStaff",
    manager: "hotelManager",
    director: "hotelDirector",
  } as const;

  return (
    <form onSubmit={submitKeepingValues((formData) => save(formData))}>
      <FieldGroup>
        <p className="text-sm font-medium">
          {t("Meal allowance (RM, no receipt)")}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {MEALS.map(([key, label]) => (
            <Field key={key}>
              <FieldLabel htmlFor={`os-${key}`}>{t(label)}</FieldLabel>
              <Input
                id={`os-${key}`}
                name={key}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                defaultValue={rules[key]}
                required
              />
            </Field>
          ))}
        </div>
        <p className="text-sm font-medium">
          {t("Hotel budget per night (RM, by receipt)")}
        </p>
        {HOTEL_LEVELS.map((level) => (
          <Field key={level}>
            <FieldLabel htmlFor={`os-hotel-${level}`}>
              {t(HOTEL_LEVEL_LABEL[level])}
            </FieldLabel>
            <Input
              id={`os-hotel-${level}`}
              name={hotelFieldName[level]}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              defaultValue={rules.hotel[level]}
              required
            />
          </Field>
        ))}
        {error && <FieldError>{t(error)}</FieldError>}
        <Button type="submit" disabled={pending}>
          {pending ? t("Saving...") : t("Save")}
        </Button>
      </FieldGroup>
    </form>
  );
}

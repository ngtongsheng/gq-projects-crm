"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useT } from "@/lib/i18n/language-context";
import { addHoliday } from "./holiday-actions";

export function AddHolidayDialog({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  function save(formData: FormData, form: HTMLFormElement) {
    startTransition(async () => {
      const result = await addHoliday(formData);
      setError(result.error);
      if (result.error !== null) return;
      toast.success(t("Holiday added."));
      form.reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus data-icon="inline-start" />
          {t("Add holiday")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Add public holiday")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(save)}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="holidayDay">{t("Date")}</FieldLabel>
                <Input
                  id="holidayDay"
                  name="day"
                  type="date"
                  defaultValue={today}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="holidayName">{t("Name")}</FieldLabel>
                <Input
                  id="holidayName"
                  name="name"
                  maxLength={100}
                  placeholder={t("e.g. Christmas Day")}
                  required
                />
              </Field>
            </div>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : t("Save")}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

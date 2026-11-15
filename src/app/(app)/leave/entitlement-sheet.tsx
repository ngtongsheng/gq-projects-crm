"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { resetEntitlement, saveEntitlement } from "./entitlement-actions";

type Days = { annualDays: number; carriedDays: number; mcDays: number };

/** The demo's Leave entitlement sheet: annual, carried forward and MC days for one person and year. */
export function EntitlementSheet({
  personId,
  personName,
  year,
  current,
  companyDefault,
  isOverride,
}: {
  personId: string;
  personName: string;
  year: number;
  current: Days;
  /** What the company default gives this person for the year (prorated if they joined that year). */
  companyDefault: Days;
  isOverride: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function finish(message: string) {
    toast.success(message);
    setError(null);
    setOpen(false);
  }

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveEntitlement(formData);
      if (result.error !== null) return setError(result.error);
      finish("Entitlement saved.");
    });
  }

  function backToDefault() {
    const formData = new FormData();
    formData.set("personId", personId);
    formData.set("year", String(year));
    startTransition(async () => {
      const result = await resetEntitlement(formData);
      if (result.error !== null) return setError(result.error);
      finish("Back to the company default.");
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost">
          Entitlement
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Leave entitlement · {personName} · {year}
          </SheetTitle>
          <SheetDescription>
            Company default: {companyDefault.annualDays} annual leave,{" "}
            {companyDefault.mcDays} MC a year. Change it here for {personName}{" "}
            only.
          </SheetDescription>
        </SheetHeader>
        <form
          className="px-4 pb-4"
          onSubmit={submitKeepingValues((formData) => save(formData))}
        >
          <input type="hidden" name="personId" value={personId} />
          <input type="hidden" name="year" value={year} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`al-${personId}`}>
                Annual leave (days)
              </FieldLabel>
              <Input
                id={`al-${personId}`}
                name="annualDays"
                type="number"
                step="0.5"
                min="0"
                defaultValue={current.annualDays}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`carry-${personId}`}>
                Carried forward from last year
              </FieldLabel>
              <Input
                id={`carry-${personId}`}
                name="carriedDays"
                type="number"
                step="0.5"
                min="0"
                defaultValue={current.carriedDays}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`mc-${personId}`}>
                Medical leave (days)
              </FieldLabel>
              <Input
                id={`mc-${personId}`}
                name="mcDays"
                type="number"
                step="0.5"
                min="0"
                defaultValue={current.mcDays}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
              {isOverride && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={backToDefault}
                >
                  Back to company default
                </Button>
              )}
            </div>
          </FieldGroup>
        </form>
      </SheetContent>
    </Sheet>
  );
}

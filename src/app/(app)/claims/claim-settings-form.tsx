"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ClaimSettings } from "@/lib/domain/monthly-claim";
import { submitKeepingValues } from "@/lib/form/submit-keeping-values";
import { useT } from "@/lib/i18n/language-context";
import { saveClaimSettings } from "./claim-settings-actions";

/** The claim rules the MD and HR & Accounts set (demo clSettings). The late-collection cuts stay with the commission rules. */
export function ClaimSettingsForm({
  settings,
  canSetLateCuts,
}: {
  settings: ClaimSettings;
  /** Only the MD writes the commission rules, so only they get the link. */
  canSetLateCuts: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveClaimSettings(formData);
      setError(result.error);
      if (!result.error) toast.success(t("Claim settings saved."));
    });
  }

  return (
    <form onSubmit={submitKeepingValues(save)} className="max-w-2xl">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="cutOffDay">
              {t("Claim cut-off day")}
            </FieldLabel>
            <Input
              id="cutOffDay"
              name="cutOffDay"
              type="number"
              min="1"
              max="28"
              step="1"
              defaultValue={settings.cutOffDay}
              className="font-mono tabular-nums"
              required
            />
            <FieldDescription>
              {t(
                "Between 1 and 28. Expenses after it go into next month's claim.",
              )}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="mileageRatePerKm">
              {t("Mileage rate (RM per km)")}
            </FieldLabel>
            <Input
              id="mileageRatePerKm"
              name="mileageRatePerKm"
              type="number"
              min="0"
              max="10"
              step="0.01"
              defaultValue={settings.mileageRatePerKm}
              className="font-mono tabular-nums"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="kmPerDay">
              {t("Mileage standard per day (km)")}
            </FieldLabel>
            <Input
              id="kmPerDay"
              name="kmPerDay"
              type="number"
              min="1"
              step="1"
              defaultValue={settings.kmPerDay}
              className="font-mono tabular-nums"
              required
            />
            <FieldDescription>
              {t("More than this in a day is flagged.")}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="monthlyTravelLimit">
              {t("Monthly travel standard (RM)")}
            </FieldLabel>
            <Input
              id="monthlyTravelLimit"
              name="monthlyTravelLimit"
              type="number"
              min="0"
              step="1"
              defaultValue={settings.monthlyTravelLimit}
              className="font-mono tabular-nums"
              required
            />
            <FieldDescription>
              {t("0 means none. More than this in a month is flagged.")}
            </FieldDescription>
          </Field>
        </div>
        <Field orientation="horizontal">
          <Checkbox
            id="needReport"
            name="needReport"
            defaultChecked={settings.needReport}
          />
          <FieldLabel htmlFor="needReport">
            {t(
              "A claim can only be submitted after last month's monthly report is submitted",
            )}
          </FieldLabel>
        </Field>
        <p className="text-sm text-muted-foreground">
          {t("The late-collection cuts are part of the commission rules.")}{" "}
          {canSetLateCuts ? (
            <Link href="/commission/settings" className="underline">
              {t("Change them in Commission settings.")}
            </Link>
          ) : (
            t("The MD changes them.")
          )}
        </p>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? t("Saving...") : t("Save")}
        </Button>
      </FieldGroup>
    </form>
  );
}

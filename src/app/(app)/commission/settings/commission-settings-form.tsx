"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import type { CommissionSettings } from "@/lib/domain/commission-settings";
import { saveCommissionSettings } from "./actions";

type NumberFieldProps = {
  name: string;
  label: string;
  value: number;
  days?: boolean;
  hint?: string;
};

function NumberField({ name, label, value, days, hint }: NumberFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        type="number"
        min="0"
        max={days ? "3650" : "100"}
        step={days ? "1" : "0.01"}
        defaultValue={value}
        className="font-mono tabular-nums"
        required
      />
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

const ROW = "grid gap-4 sm:grid-cols-2";

/** The MD's commission rules. Saving applies them to every calculation from then on. */
export function CommissionSettingsForm({
  settings,
}: {
  settings: CommissionSettings;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await saveCommissionSettings(formData);
      setError(result.error);
      if (!result.error) toast.success("Commission rules saved.");
    });
  }

  return (
    <form action={save} className="max-w-2xl">
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Rates by account type (%)</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              name="baseOwn"
              label="Own effort"
              value={settings.baseRatePct.own}
            />
            <NumberField
              name="basePassDown"
              label="Pass-down"
              value={settings.baseRatePct.pass_down}
            />
            <NumberField
              name="baseCompany"
              label="Company account"
              value={settings.baseRatePct.company}
            />
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Margin rule (%)</FieldLegend>
          <FieldDescription>
            Margin is (invoice - cost) / invoice. It needs the cost keyed in.
          </FieldDescription>
          <div className={ROW}>
            <NumberField
              name="noCommissionBelow"
              label="No commission: margin below"
              value={settings.noCommissionBelowPct}
            />
            <NumberField
              name="lowMarginBelow"
              label="Low margin: below"
              value={settings.lowMarginBelowPct}
            />
            <NumberField
              name="lowOwn"
              label="Own account rate when margin is low"
              value={settings.lowMarginRatePct.own}
            />
            <NumberField
              name="lowOther"
              label="Pass-down / company rate when margin is low"
              value={settings.lowMarginRatePct.other}
            />
            <NumberField
              name="highMarginAbove"
              label="High margin: above"
              value={settings.highMarginAbovePct}
            />
            <NumberField
              name="highMarginBonus"
              label="Extra commission on high margin"
              value={settings.highMarginBonusPct}
            />
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Late collection</FieldLegend>
          <FieldDescription>
            Commission on money received this many days after the invoice date
            is cut.
          </FieldDescription>
          <div className={ROW}>
            <NumberField
              name="firstCutDays"
              label="First cut after (days)"
              value={settings.firstLateCut.afterDays}
              days
            />
            <NumberField
              name="firstCutPct"
              label="First cut (%)"
              value={settings.firstLateCut.cutPct}
            />
            <NumberField
              name="secondCutDays"
              label="Second cut after (days)"
              value={settings.secondLateCut.afterDays}
              days
            />
            <NumberField
              name="secondCutPct"
              label="Second cut (%)"
              value={settings.secondLateCut.cutPct}
            />
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Claims and shares (%)</FieldLegend>
          <div className={ROW}>
            <NumberField
              name="claimThreshold"
              label="Claimable once paid"
              value={settings.claimThresholdPct}
              hint="Also marks orders as commission open on Collection."
            />
            <NumberField
              name="splitShare"
              label="First salesperson's share"
              value={settings.splitSharePct}
              hint="When two salespeople share an MOF; the second gets the rest."
            />
            <NumberField
              name="flatPassDown"
              label="Flat pass-down rate"
              value={settings.flatPassDownRatePct}
              hint={`For people set to "Flat 1% on pass-down sales" on People.`}
            />
          </div>
        </FieldSet>

        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving..." : "Save rules"}
        </Button>
      </FieldGroup>
    </form>
  );
}

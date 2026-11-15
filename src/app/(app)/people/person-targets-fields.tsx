"use client";

import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRm } from "@/lib/format/money";
import type { YearTargets } from "./people-targets-data";

export type PersonTargets = {
  /** This year first, then next year. */
  years: YearTargets[];
  /** The annual target of their grade; null when they have no grade or the viewer cannot read grades. */
  gradeTarget: number | null;
};

/** The company default shown when a person has no visit target of their own (the reports use 50). */
const DEFAULT_VISITS = 50;

/** Targets are kept per year; the form posts the chosen year's two numbers. */
export function PersonTargetsFields({ targets }: { targets: PersonTargets }) {
  const [year, setYear] = useState(targets.years[0].year);
  const chosen = targets.years.find((entry) => entry.year === year);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="targetYear">Targets for</FieldLabel>
          <Select
            name="targetYear"
            value={String(year)}
            onValueChange={(value) => setYear(Number(value))}
          >
            <SelectTrigger id="targetYear">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targets.years.map((entry) => (
                <SelectItem key={entry.year} value={String(entry.year)}>
                  {entry.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="salesTarget">Sales target (RM)</FieldLabel>
          <Input
            key={`sales-${year}`}
            id="salesTarget"
            name="salesTarget"
            inputMode="decimal"
            placeholder={
              targets.gradeTarget === null
                ? "No target"
                : `Grade: ${formatRm(targets.gradeTarget)}`
            }
            defaultValue={chosen?.salesTarget ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="visitTarget">Visits per month</FieldLabel>
          <Input
            key={`visits-${year}`}
            id="visitTarget"
            name="visitTarget"
            inputMode="numeric"
            placeholder={`${DEFAULT_VISITS} (default)`}
            defaultValue={chosen?.visitTarget ?? ""}
          />
        </Field>
      </div>
      <FieldDescription>
        Leave the sales target empty to use their grade's annual target. Someone
        who joins mid-year is measured from the join date, so the year's target
        is prorated.
      </FieldDescription>
    </>
  );
}

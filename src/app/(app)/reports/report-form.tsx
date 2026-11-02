"use client";

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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HIGHLIGHT_ROWS, type ReportKind } from "@/lib/domain/report-stats";
import { type ReportResult, saveReportDraft, submitReport } from "./actions";
import type { Highlight } from "./report-data";

// Fixed, positional rows; the action reads them back by number.
const HIGHLIGHT_SLOTS = Array.from({ length: HIGHLIGHT_ROWS }, (_, row) => row);

type ReportFormProps = {
  month: string;
  kind: ReportKind;
  highlights: Highlight[];
  nextMonthPlan: string | null;
  supportNeeded: string | null;
  passDownsConfirmed: boolean;
};

/** The parts of the monthly report the person writes; the figures above come from the CRM. */
export function ReportForm(props: ReportFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (formData: FormData) => Promise<ReportResult>) {
    return (formData: FormData) =>
      startTransition(async () => {
        const result = await action(formData);
        setError(result.error);
        if (!result.error && result.message) toast.success(result.message);
      });
  }

  return (
    <form
      action={run(saveReportDraft)}
      className="rounded-xl border bg-card p-4"
    >
      <input type="hidden" name="month" value={props.month} />
      <FieldGroup>
        {props.kind !== "site" && (
          <FieldSet>
            <FieldLegend>Key highlights and wins</FieldLegend>
            <FieldDescription>At least 3 before you submit.</FieldDescription>
            {HIGHLIGHT_SLOTS.map((row) => (
              <div key={row} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                <Input
                  name={`highlightCompany${row}`}
                  aria-label={`Highlight ${row + 1} company or project`}
                  placeholder="Company / project"
                  defaultValue={props.highlights[row]?.company ?? ""}
                />
                <Input
                  name={`highlightAchievement${row}`}
                  aria-label={`Highlight ${row + 1} achievement`}
                  placeholder="Key achievement or progress"
                  defaultValue={props.highlights[row]?.achievement ?? ""}
                />
              </div>
            ))}
          </FieldSet>
        )}
        <Field>
          <FieldLabel htmlFor="reportPlan">Plan for next month</FieldLabel>
          <Textarea
            id="reportPlan"
            name="nextMonthPlan"
            rows={3}
            defaultValue={props.nextMonthPlan ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reportSupport">
            {props.kind === "site"
              ? "Site issues and support needed"
              : "Support needed"}
          </FieldLabel>
          <Textarea
            id="reportSupport"
            name="supportNeeded"
            rows={3}
            defaultValue={props.supportNeeded ?? ""}
          />
        </Field>
        {props.kind === "bd" && (
          <Field orientation="horizontal">
            <Checkbox
              id="reportPassDowns"
              name="passDownsConfirmed"
              defaultChecked={props.passDownsConfirmed}
            />
            <FieldLabel htmlFor="reportPassDowns" className="font-normal">
              I confirm every lead and pass-down I made this month is recorded
              in Projects. Leads not recorded there do not count for BD
              commission.
            </FieldLabel>
          </Field>
        )}
        {error ? <FieldError>{error}</FieldError> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={pending}>
            Save draft
          </Button>
          <Button
            type="submit"
            formAction={run(submitReport)}
            disabled={pending}
          >
            Submit report
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

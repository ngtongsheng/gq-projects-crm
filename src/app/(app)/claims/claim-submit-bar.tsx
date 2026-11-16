"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/language-context";
import { submitOwnClaim } from "./claim-submit-actions";

/** The note to HR & Accounts and the Submit button, while the claim is still the person's to change. */
export function ClaimSubmitBar({
  month,
  monthLabel,
  initialNote,
  cutOffLabel,
}: {
  month: string;
  monthLabel: string;
  initialNote: string;
  /** The cut-off date, e.g. "25 Nov 2026". */
  cutOffLabel: string;
}) {
  const [note, setNote] = useState(initialNote);
  const [pending, startTransition] = useTransition();
  const t = useT();

  function submit() {
    startTransition(async () => {
      const result = await submitOwnClaim(month, note);
      if (result.error !== null) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.afterCutOff
          ? t(
              "Submitted after the cut-off, so it goes into next month's payment.",
            )
          : t("Claim submitted."),
      );
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <Field>
        <FieldLabel htmlFor="claimNote">
          {t("Note to HR & Accounts")}
        </FieldLabel>
        <Textarea
          id="claimNote"
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <FieldDescription>
          {t(
            "An explanation or an appeal, e.g. why a client paid late and you ask for no late cut.",
          )}
        </FieldDescription>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending} onClick={submit}>
          {pending
            ? t("Submitting...")
            : `${t("Submit")} ${monthLabel} ${t("claim")}`}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("Submit by")} {cutOffLabel}.
        </span>
      </div>
    </div>
  );
}

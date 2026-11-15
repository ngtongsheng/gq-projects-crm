"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SALES_GRADES } from "@/lib/domain/hr-scheme";
import { useT } from "@/lib/i18n/language-context";
import {
  type GradeResult,
  saveAppendixSigned,
  saveGradeAmount,
  savePersonGrade,
} from "./grade-actions";

/** Runs a save and tells the person how it went; the page then re-reads the saved value. */
function useSaver() {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const save = (run: () => Promise<GradeResult>) =>
    startTransition(async () => {
      const result = await run();
      if (result.error) toast.error(t(result.error));
      else toast.success(t("Saved."));
    });
  return { pending, save };
}

/** A grade's basic or annual target: tap the number, change it, and it saves when you leave the box. */
export function GradeAmountInput({
  grade,
  field,
  value,
  label,
}: {
  grade: string;
  field: "basic" | "annualTarget";
  value: number | null;
  label: string;
}) {
  const t = useT();
  const { pending, save } = useSaver();
  const [text, setText] = useState(value === null ? "" : String(value));

  function commit() {
    const trimmed = text.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next === value) return;
    if (next === null && field === "annualTarget") {
      toast.error(t("Key in the annual target as a number."));
      setText(String(value));
      return;
    }
    save(() => saveGradeAmount({ grade, field, value: next }));
  }

  return (
    <Input
      aria-label={`${grade} ${label}`}
      type="number"
      inputMode="decimal"
      min={0}
      step={field === "basic" ? 100 : 10000}
      value={text}
      placeholder={field === "basic" ? t("key in") : undefined}
      disabled={pending}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="ml-auto h-8 w-28 text-right font-mono tabular-nums"
    />
  );
}

// Radix Select has no empty item value, so "no grade" gets a name.
const NO_GRADE = "none";

export function PersonGradeSelect({
  personId,
  name,
  grade,
}: {
  personId: string;
  name: string;
  grade: string | null;
}) {
  const t = useT();
  const { pending, save } = useSaver();
  return (
    <Select
      value={grade ?? NO_GRADE}
      disabled={pending}
      onValueChange={(next) =>
        save(() =>
          savePersonGrade({
            profileId: personId,
            grade: next === NO_GRADE ? "" : next,
          }),
        )
      }
    >
      <SelectTrigger size="sm" aria-label={`${name} ${t("Grade")}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_GRADE}>-</SelectItem>
        {SALES_GRADES.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The date a person signed the appendix; the current scheme version is stamped on it. */
export function AppendixSignedInput({
  personId,
  name,
  signedOn,
}: {
  personId: string;
  name: string;
  signedOn: string | null;
}) {
  const t = useT();
  const { pending, save } = useSaver();
  return (
    <Input
      aria-label={`${name} ${t("Appendix signed")}`}
      type="date"
      defaultValue={signedOn ?? ""}
      disabled={pending}
      onBlur={(event) => {
        // A half-typed date reads as blank, so save only when the person leaves the box.
        const next = event.target.value;
        if (next === (signedOn ?? "")) return;
        save(() => saveAppendixSigned({ profileId: personId, signedOn: next }));
      }}
      className="h-8 w-40"
    />
  );
}

"use client";

import { useId } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** A labelled number box that keeps what the person typed, so "2." does not jump. */
export function NumberField({
  label,
  value,
  onChange,
  step = "0.01",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (typed: string) => void;
  step?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="font-mono tabular-nums"
      />
    </Field>
  );
}

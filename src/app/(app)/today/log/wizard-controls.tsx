"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A big tap target that is on or off, the demo's `lwb` button. */
export function ChoiceButton({
  on,
  onClick,
  disabled,
  className,
  children,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={on ? "default" : "outline"}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-auto min-h-12 flex-col items-start justify-center gap-0.5 px-3 py-2 text-left text-base whitespace-normal",
        className,
      )}
    >
      {children}
    </Button>
  );
}

/** A yes / no question answered with two big buttons; null until they answer. */
export function YesNo({
  value,
  onChange,
  yes,
  no,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  yes: string;
  no: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ChoiceButton on={value === true} onClick={() => onChange(true)}>
        {yes}
      </ChoiceButton>
      <ChoiceButton on={value === false} onClick={() => onChange(false)}>
        {no}
      </ChoiceButton>
    </div>
  );
}

/** One question of the details step: a bold ask, an optional hint, then the answer. */
export function Question({
  title,
  hint,
  unanswered = false,
  children,
}: {
  title: string;
  hint?: string;
  /** Outlines the card while the answer is still missing. */
  unanswered?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        unanswered && "border-warn",
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

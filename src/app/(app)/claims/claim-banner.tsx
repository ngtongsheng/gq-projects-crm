import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE = {
  info: "bg-info-bg text-info",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
} as const;

/** A line of context above a claim: where it stands, what to fix, what changed. */
export function ClaimBanner({
  tone,
  children,
}: {
  tone: keyof typeof TONE;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl px-4 py-3 text-sm", TONE[tone])}>
      {children}
    </div>
  );
}

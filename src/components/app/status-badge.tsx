import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tones = {
  good: "bg-good-bg text-good",
  info: "bg-info-bg text-info",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  neutral: "bg-neutral-bg text-neutral",
} as const;

export type StatusTone = keyof typeof tones;

type StatusBadgeProps = {
  tone?: StatusTone;
  children: ReactNode;
};

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  return <Badge className={cn("font-semibold", tones[tone])}>{children}</Badge>;
}

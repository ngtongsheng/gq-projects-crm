import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/app/status-badge";
import { type AttentionItem, attentionTotal } from "@/lib/domain/attention";
import { achievedTone } from "@/lib/domain/report-stats";
import { cn } from "@/lib/utils";

/** A headline number with its context. Numbers wear the mono face; colour never carries the meaning alone. */
export function StatTile({
  label,
  value,
  note,
  children,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-4">
      <p
        data-tile-label
        className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {label}
      </p>
      <p className="font-mono text-xl font-semibold tabular-nums break-words sm:text-2xl">
        {value}
      </p>
      {children}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export function TileGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

const FILL = {
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  neutral: "bg-muted-foreground",
} as const;

/**
 * Progress against a target with a mark where it should be by now. Green from 90% of that
 * mark, amber from 70%, red below; the percentage is printed so the colour is never alone.
 */
export function PaceBar({
  done,
  target,
  pace,
  label,
  format = String,
}: {
  done: number;
  target: number;
  /** Share of the period gone, 0 to 1. */
  pace: number;
  label: string;
  /** How the numbers are written, e.g. as RM. Counts by default. */
  format?: (value: number) => string;
}) {
  if (target <= 0) {
    return <p className="text-xs text-muted-foreground">No target set</p>;
  }
  const tone = achievedTone(done, target, pace);
  const share = Math.min(1, done / target);
  const percent = Math.round((done / target) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(done, target)}
        className="relative h-2 rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", FILL[tone])}
          style={{ width: `${share * 100}%` }}
        />
        {pace > 0 && pace < 1 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-foreground"
            style={{ left: `${pace * 100}%` }}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-mono tabular-nums">{format(done)}</span> of{" "}
          <span className="font-mono tabular-nums">{format(target)}</span>
          {pace > 0 && pace < 1 ? (
            <>
              , about{" "}
              <span className="font-mono tabular-nums">
                {format(Math.round(target * pace))}
              </span>{" "}
              by today
            </>
          ) : null}
        </span>
        <StatusBadge tone={tone}>{percent}%</StatusBadge>
      </div>
    </div>
  );
}

export function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-heading text-base font-medium">{title}</h2>
        {aside ? (
          <span className="text-xs text-muted-foreground">{aside}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-sm text-muted-foreground">{children}</p>;
}

/** What needs doing today, each line a link to where it is done. */
export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const total = attentionTotal(items);
  return (
    <Panel title="Needs attention" aside={total > 0 ? `${total} in all` : null}>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-good" aria-hidden />
          Nothing needs your attention today.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-sunk"
              >
                <StatusBadge tone={item.tone}>{item.count}</StatusBadge>
                <span className="min-w-0 flex-1">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** A heading above a table, which draws its own frame. */
export function TableSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-base font-medium">{title}</h2>
        {aside ? (
          <span className="text-xs text-muted-foreground">{aside}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

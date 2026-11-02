import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StatusTone } from "./status-badge";

export type CalendarEvent = {
  id: string;
  /** Clock time to show, e.g. "09:30". */
  time: string;
  title: string;
  detail: string;
  tone: StatusTone;
  href: string;
  /** Shown struck through and faded, e.g. a cancelled visit. */
  muted?: boolean;
};

const toneBorder: Record<StatusTone, string> = {
  good: "border-l-good",
  info: "border-l-info",
  warn: "border-l-warn",
  bad: "border-l-bad",
  neutral: "border-l-neutral",
};

export function CalendarEventLink({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={event.href}
      className={cn(
        "grid min-w-0 gap-px rounded-md border border-l-[3px] bg-card px-2 py-1 text-xs hover:bg-muted",
        toneBorder[event.tone],
        event.muted && "line-through opacity-60",
      )}
    >
      <span className="font-mono tabular-nums text-muted-foreground">
        {event.time}
      </span>
      <span className="truncate font-medium">{event.title}</span>
      <span className="truncate text-muted-foreground">{event.detail}</span>
    </Link>
  );
}

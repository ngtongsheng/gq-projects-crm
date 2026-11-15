import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CalendarParams, CalendarView } from "./calendar-params";

const TABS: { view: CalendarView; label: string }[] = [
  { view: "week", label: "Week" },
  { view: "list", label: "Monthly list" },
  { view: "outcomes", label: "Weekly outcomes" },
];

/** Switches between the calendar's tabs, keeping the day and the person filter. */
export function ViewTabs({
  current,
  href,
}: {
  current: CalendarView;
  href: (patch: Partial<CalendarParams>) => string;
}) {
  return (
    <nav aria-label="Calendar views" className="inline-flex gap-1">
      {TABS.map((tab) => (
        <Button
          key={tab.view}
          asChild
          size="sm"
          variant={current === tab.view ? "default" : "outline"}
        >
          <Link
            href={href({ view: tab.view })}
            aria-current={current === tab.view ? "page" : undefined}
          >
            {tab.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}

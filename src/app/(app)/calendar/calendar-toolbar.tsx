import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CalendarDate } from "@/lib/format/date";
import type { CalendarParams, CalendarView } from "./calendar-params";
import { stepDate } from "./calendar-params";
import type { TeamFilter } from "./team-filter";

const ALL = "all";

type CalendarToolbarProps = {
  view: CalendarView;
  date: CalendarDate;
  title: string;
  /** A link to this calendar with `patch` changed; the view and person filter are kept. */
  href: (patch: Partial<CalendarParams>) => string;
  /** The "Who" filter; absent for people who only see their own diary. */
  filter?: TeamFilter;
};

/** Previous, next and today, the period's title, and a manager's "Who" filter. */
export function CalendarToolbar({
  view,
  date,
  title,
  href,
  filter,
}: CalendarToolbarProps) {
  const unit = view === "list" ? "month" : "week";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="icon-sm" variant="outline">
        <Link
          href={href({ date: stepDate(view, date, -1) })}
          aria-label={`Previous ${unit}`}
        >
          <ChevronLeft />
        </Link>
      </Button>
      <Button asChild size="icon-sm" variant="outline">
        <Link
          href={href({ date: stepDate(view, date, 1) })}
          aria-label={`Next ${unit}`}
        >
          <ChevronRight />
        </Link>
      </Button>
      <h2 className="min-w-40 font-heading text-base font-medium">{title}</h2>
      <Button asChild size="sm" variant="ghost">
        <Link href={href({})}>Today</Link>
      </Button>
      {filter && (
        <form action="/calendar" className="ml-auto flex items-center gap-2">
          {view !== "week" && <input type="hidden" name="view" value={view} />}
          <input type="hidden" name="date" value={date} />
          <Select name="who" defaultValue={filter.who ?? ALL}>
            <SelectTrigger aria-label="Salesperson" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{filter.allLabel}</SelectItem>
              {filter.choices.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline">
            Show
          </Button>
        </form>
      )}
    </div>
  );
}

import { DataTable } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { type DailyLogCell, dailyLogCell } from "@/lib/domain/site-daily-log";
import type { WorkCalendar } from "@/lib/domain/workdays";
import { type CalendarDate, dayOfWeek, formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import type { SupervisorWeek } from "./daily-log-data";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const shortDate = (day: CalendarDate) => formatDate(day).replace(/ \d{4}$/, "");

function CellBadge({ cell, t }: { cell: DailyLogCell; t: Translate }) {
  switch (cell.kind) {
    case "no-site-work":
      return (
        <span className="text-xs text-muted-foreground">
          {t(cell.reason === "sunday" ? "Sun" : "Holiday")}
        </span>
      );
    case "logged":
      return (
        <StatusBadge tone="good">
          {`${cell.sites} ${t(cell.sites > 1 ? "sites" : "site")}`}
        </StatusBadge>
      );
    case "away":
      return <StatusBadge tone="info">{cell.label}</StatusBadge>;
    case "today":
      return cell.reminderGone ? (
        <StatusBadge tone="bad">{t("Not logged yet")}</StatusBadge>
      ) : (
        <StatusBadge tone="warn">{t("Not yet")}</StatusBadge>
      );
    case "before-joined":
      return null;
    case "missing":
      return <StatusBadge tone="bad">{t("Missing")}</StatusBadge>;
  }
}

/**
 * Each supervisor's last seven days: logged, away, not yet, or missing. Leave, MC and office
 * days must be recorded too, or the day shows as missing (demo: siteRemind).
 */
export function DailyLogGrid({
  weeks,
  days,
  today,
  calendar,
  reminderTimePassed,
  t,
}: {
  weeks: readonly SupervisorWeek[];
  days: readonly CalendarDate[];
  today: CalendarDate;
  calendar: WorkCalendar;
  reminderTimePassed: boolean;
  t: Translate;
}) {
  const cellOf = (week: SupervisorWeek, day: CalendarDate) =>
    dailyLogCell({
      day,
      today,
      calendar,
      sitesLogged: new Set(
        week.logs
          .filter((log) => log.visitedOn === day)
          .map((log) => log.mofId ?? log.projectId ?? log.siteName),
      ).size,
      awayLabel:
        week.away.find((off) => off.startsOn <= day && day <= off.endsOn)
          ?.label ?? null,
      joinedOn: week.joinedOn,
      reminderTimePassed,
    });

  return (
    <DataTable
      rows={[...weeks]}
      getRowKey={(week) => week.id}
      columns={[
        {
          key: "supervisor",
          header: t("Supervisor"),
          cell: (week) => <span className="font-semibold">{week.name}</span>,
        },
        ...days.map((day) => ({
          key: day,
          header: (
            <>
              {t(WEEKDAYS[dayOfWeek(day)])}
              <span className="block font-normal normal-case">
                {shortDate(day)}
              </span>
            </>
          ),
          className: "text-center",
          cell: (week: SupervisorWeek) => (
            <CellBadge cell={cellOf(week, day)} t={t} />
          ),
        })),
      ]}
    />
  );
}

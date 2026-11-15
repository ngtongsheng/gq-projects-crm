import { DataTable } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { planVsDone } from "@/lib/domain/site-daily-log";
import type { PlannedWork } from "@/lib/domain/site-plan";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { StatTile, TileGrid } from "../dashboard/dashboard-parts";
import type { SupervisorWeek } from "./daily-log-data";
import { SubText } from "./sub-text";

/**
 * One supervisor's plan against their log for the past week: calendar = plan, site log = what
 * was done (demo: pvdPanel). A planned job with no log is listed so it can be chased.
 */
export function PlanVsDonePanel({
  week,
  today,
  holidays,
  t,
}: {
  week: SupervisorWeek;
  today: CalendarDate;
  holidays: ReadonlySet<CalendarDate>;
  t: Translate;
}) {
  const result = planVsDone({
    today,
    holidays,
    away: week.away,
    joinedOn: week.joinedOn,
    planned: week.planned,
    // Today is not over, and the plan stops at yesterday.
    logs: week.logs.filter((log) => log.visitedOn < today),
  });
  const missed = result.notLogged.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-heading text-lg font-semibold">
          {`${t("Planned vs done")} · ${week.name} · ${t("last 7 days")}`}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t("Calendar = plan · Site log = what was done")}
        </span>
      </div>
      <TileGrid>
        <StatTile label={t("Planned jobs")} value={result.planned.length} />
        <StatTile label={t("Done (logged)")} value={result.done.length} />
        <StatTile
          label={t("Planned, not logged")}
          value={<span className={cn(missed > 0 && "text-bad")}>{missed}</span>}
        />
        <StatTile
          label={t("Added on the day")}
          value={result.addedOnTheDay.length}
          note={t(
            "Sites logged that were not in the schedule. They still count.",
          )}
        />
      </TileGrid>
      <DataTable
        rows={result.notLogged}
        getRowKey={(job) =>
          `${job.day}|${job.mofId ?? job.projectId ?? job.siteName}|${job.activity}`
        }
        empty={
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t("Every planned job was logged.")}
          </p>
        }
        columns={[
          {
            key: "date",
            header: t("Date"),
            className: "whitespace-nowrap",
            cell: (job: PlannedWork) => (
              <span className="font-mono">{formatDate(job.day)}</span>
            ),
          },
          {
            key: "job",
            header: t("Planned job"),
            cell: (job) => (
              <>
                {job.siteLabel}
                <SubText>{t(job.what)}</SubText>
              </>
            ),
          },
          {
            key: "status",
            header: t("Status"),
            cell: () => <StatusBadge tone="bad">{t("Not logged")}</StatusBadge>,
          },
        ]}
      />
    </section>
  );
}

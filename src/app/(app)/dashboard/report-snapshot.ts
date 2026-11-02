import type { Profile } from "@/lib/auth/current-profile";
import {
  type ReportFlag,
  type ReportKind,
  type ReportStats,
  reportFlag,
  reportKindFor,
  shiftMonth,
} from "@/lib/domain/report-stats";
import type { CalendarDate } from "@/lib/format/date";
import {
  loadLiveStats,
  loadMonthlyReport,
  loadMonthReports,
  loadReportSettings,
  type MonthlyReport,
} from "../reports/report-data";
import { loadReportFilers } from "../reports/report-filers";

const firstOfMonth = (day: CalendarDate): CalendarDate =>
  `${day.slice(0, 7)}-01`;

function lastMonthFlag(
  month: CalendarDate,
  dueTime: string,
  report: MonthlyReport | null,
): ReportFlag {
  return reportFlag({
    month,
    dueTime,
    status: report?.status ?? null,
    submittedAt: report?.submittedAt ?? null,
    now: new Date(),
  });
}

export type TeamRow = {
  id: string;
  name: string;
  kind: ReportKind;
  /** This month's figures so far. */
  stats: Exclude<ReportStats, { kind: "site" }>;
  /** Where last month's report stands. */
  lastReport: ReportFlag;
};

/**
 * Today's month figures for each person who files a sales or BD report, and how many monthly
 * reports for last month are overdue across everyone who files. Managers only: the database
 * returns no filers to anyone else.
 */
export async function loadTeamSnapshot(
  today: CalendarDate,
): Promise<{ rows: TeamRow[]; lateReports: number }> {
  const month = firstOfMonth(today);
  const previous = shiftMonth(month, -1);
  const [filers, settings, reports] = await Promise.all([
    loadReportFilers(),
    loadReportSettings(),
    loadMonthReports(previous),
  ]);
  const flags = new Map(
    filers.map((filer) => [
      filer.id,
      lastMonthFlag(
        previous,
        settings.dueTime,
        reports.find((report) => report.profileId === filer.id) ?? null,
      ),
    ]),
  );
  const rows = (
    await Promise.all(
      filers
        .filter((filer) => filer.kind !== "site")
        .map(async (filer): Promise<TeamRow[]> => {
          const stats = await loadLiveStats(
            filer.kind,
            filer.id,
            month,
            settings.targets,
          );
          const lastReport = flags.get(filer.id);
          return stats.kind === "site" || !lastReport
            ? []
            : [
                {
                  id: filer.id,
                  name: filer.name,
                  kind: filer.kind,
                  stats,
                  lastReport,
                },
              ];
        }),
    )
  ).flat();
  return {
    rows,
    lateReports: [...flags.values()].filter((flag) => flag.tone === "bad")
      .length,
  };
}

export type OwnMonth = {
  kind: ReportKind;
  stats: ReportStats;
  /** Last month's report is past its due time and not filed. */
  reportOverdue: boolean;
};

/** The signed-in person's own figures this month, for roles that file a report; null for the rest. */
export async function loadOwnMonth(
  me: Pick<Profile, "id" | "jobRole">,
  today: CalendarDate,
): Promise<OwnMonth | null> {
  const kind = reportKindFor(me.jobRole);
  if (!kind) return null;
  const previous = shiftMonth(firstOfMonth(today), -1);
  const [settings, report] = await Promise.all([
    loadReportSettings(),
    loadMonthlyReport(me.id, previous),
  ]);
  return {
    kind,
    stats: await loadLiveStats(
      kind,
      me.id,
      firstOfMonth(today),
      settings.targets,
    ),
    reportOverdue:
      lastMonthFlag(previous, settings.dueTime, report).tone === "bad",
  };
}

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { shiftMonth, startOfMonth } from "@/lib/domain/calendar-grid";
import {
  canReviewReport,
  monthPace,
  type ReportKind,
  reportDueAt,
  reportFlag,
} from "@/lib/domain/report-stats";
import {
  type CalendarDate,
  formatDateTime,
  formatMonth,
} from "@/lib/format/date";
import {
  loadLiveStats,
  type MonthlyReport,
  type ReportSettings,
} from "./report-data";
import { ReportFigures } from "./report-figures";
import { ReportForm } from "./report-form";
import type { ReportsView } from "./report-params";
import { ReviewForm } from "./review-form";

export const KIND_LABEL: Record<ReportKind, string> = {
  sales: "Sales monthly report",
  bd: "BD monthly report",
  site: "Site supervisor monthly report",
};

/** A link to a reports page for a month, keeping the other query values (person, kind). */
export const reportHref = (
  basePath: string,
  month: CalendarDate,
  query: Record<string, string | undefined> = {},
) => {
  const params = new URLSearchParams({ month: month.slice(0, 7) });
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  return `${basePath}?${params}`;
};

export function MonthSwitcher({
  view,
  query,
}: {
  view: ReportsView;
  query?: Record<string, string | undefined>;
}) {
  const current = startOfMonth(view.today);
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon" aria-label="Previous month">
        <Link
          href={reportHref(view.basePath, shiftMonth(view.month, -1), query)}
        >
          <ChevronLeft />
        </Link>
      </Button>
      <span className="min-w-20 text-center font-mono text-sm tabular-nums">
        {formatMonth(view.month)}
      </span>
      {view.month < current ? (
        <Button asChild variant="outline" size="icon" aria-label="Next month">
          <Link
            href={reportHref(view.basePath, shiftMonth(view.month, 1), query)}
          >
            <ChevronRight />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="icon" aria-label="Next month" disabled>
          <ChevronRight />
        </Button>
      )}
    </div>
  );
}

export const dueText = (view: {
  month: CalendarDate;
  settings: ReportSettings;
}) =>
  `Due ${formatDateTime(reportDueAt(view.month, view.settings.dueTime))} (first Monday of the next month)`;

export function flagFor(view: ReportsView, report: MonthlyReport | null) {
  return reportFlag({
    month: view.month,
    dueTime: view.settings.dueTime,
    status: report?.status ?? null,
    submittedAt: report?.submittedAt ?? null,
    now: new Date(),
  });
}

/** A filed report, read-only: highlights, plan and the review. */
function ReportText({ report }: { report: MonthlyReport }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
      {report.kind !== "site" && (
        <div>
          <h3 className="font-medium">Key highlights and wins</h3>
          {report.highlights.length === 0 ? (
            <p className="text-muted-foreground">None written.</p>
          ) : (
            <ol className="mt-1 list-decimal pl-5">
              {report.highlights.map((highlight) => (
                <li key={`${highlight.company}|${highlight.achievement}`}>
                  {highlight.company ? (
                    <span className="font-medium">{highlight.company}: </span>
                  ) : null}
                  {highlight.achievement}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      <div>
        <h3 className="font-medium">Plan for next month</h3>
        <p className="whitespace-pre-line">{report.nextMonthPlan ?? "-"}</p>
      </div>
      <div>
        <h3 className="font-medium">
          {report.kind === "site"
            ? "Site issues and support needed"
            : "Support needed"}
        </h3>
        <p className="whitespace-pre-line">{report.supportNeeded ?? "-"}</p>
      </div>
      {report.kind === "bd" && report.passDownsConfirmed && (
        <p className="text-muted-foreground">
          Confirmed every lead and pass-down this month is recorded in Projects.
        </p>
      )}
    </section>
  );
}

/**
 * One person's report for a month: figures, the written part (editable by its owner while a
 * draft) and the review. `query` is kept on the month links, e.g. the Team Reports tab.
 */
export async function ReportView({
  view,
  personId,
  kind,
  report,
  query,
  backLabel,
}: {
  view: ReportsView;
  personId: string;
  kind: ReportKind;
  report: MonthlyReport | null;
  query?: Record<string, string | undefined>;
  backLabel: string;
}) {
  const own = personId === view.me.id;
  const flag = flagFor(view, report);
  const editable = own && (report === null || report.status === "draft");
  const stats =
    report?.stats ??
    (await loadLiveStats(kind, personId, view.month, view.settings.targets));
  const canReview =
    report !== null &&
    !own &&
    report.status === "submitted" &&
    canReviewReport(view.me.jobRole, kind);
  const name = view.nameOf.get(personId) ?? "Unnamed";

  return (
    <div className="flex flex-col gap-4">
      {!own && (
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link href={reportHref(view.basePath, view.month, query)}>
            <ChevronLeft data-icon="inline-start" />
            {backLabel}
          </Link>
        </Button>
      )}
      <PageHeader
        title={`${KIND_LABEL[kind]} · ${name}`}
        description={dueText(view)}
        actions={
          <MonthSwitcher
            view={view}
            query={own ? query : { ...query, person: personId }}
          />
        }
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge tone={flag.tone}>{flag.label}</StatusBadge>
        {report?.submittedAt ? (
          <span className="font-mono text-muted-foreground tabular-nums">
            Submitted {formatDateTime(report.submittedAt)}
          </span>
        ) : null}
      </div>
      {own && editable && flag.label === "Overdue" && (
        <p className="rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">
          This report is overdue. Fill it in and submit.
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">
          {kind === "site" ? "Site work this month" : "Sales this month"}
        </h2>
        <ReportFigures stats={stats} pace={monthPace(view.month, view.today)} />
        <p className="text-sm text-muted-foreground">
          {report?.stats
            ? "Figures were frozen when the report was submitted."
            : kind === "site"
              ? "Counted from the site log and overtime. Frozen when you submit."
              : "Counted from the calendar, projects and MOFs. Frozen when you submit."}
        </p>
      </section>

      {editable ? (
        <ReportForm
          month={view.month}
          kind={kind}
          highlights={report?.highlights ?? []}
          nextMonthPlan={report?.nextMonthPlan ?? null}
          supportNeeded={report?.supportNeeded ?? null}
          passDownsConfirmed={report?.passDownsConfirmed ?? false}
        />
      ) : report ? (
        <ReportText report={report} />
      ) : null}

      {report?.status === "reviewed" && (
        <p className="rounded-xl bg-good-bg px-4 py-3 text-sm text-good">
          <span className="font-semibold">
            Reviewed by{" "}
            {report.reviewedBy
              ? (view.nameOf.get(report.reviewedBy) ?? "Unnamed")
              : "-"}
          </span>
          {report.reviewNote ? `: ${report.reviewNote}` : null}
        </p>
      )}
      {canReview && report && <ReviewForm reportId={report.id} />}
    </div>
  );
}

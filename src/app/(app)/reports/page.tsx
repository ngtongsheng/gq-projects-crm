import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/auth/current-profile";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  canReviewReport,
  monthPace,
  type ReportKind,
  reportDueAt,
  reportFlag,
  reportKindFor,
  shiftMonth,
} from "@/lib/domain/report-stats";
import {
  type CalendarDate,
  formatDateTime,
  formatMonth,
  todayMyt,
} from "@/lib/format/date";
import {
  loadLiveStats,
  loadMonthlyReport,
  loadMonthReports,
  loadReportSettings,
  type MonthlyReport,
  type ReportSettings,
} from "./report-data";
import { ReportFigures } from "./report-figures";
import { ReportForm } from "./report-form";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Reports" };

const KIND_LABEL: Record<ReportKind, string> = {
  sales: "Sales monthly report",
  bd: "BD monthly report",
  site: "Site supervisor monthly report",
};

const monthParam = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .transform((month) => `${month}-01`)
  .optional()
  .catch(undefined);
const personParam = z.uuid().optional().catch(undefined);

type View = {
  me: Profile;
  month: CalendarDate;
  today: CalendarDate;
  settings: ReportSettings;
  nameOf: Map<string, string>;
};

const reportHref = (month: CalendarDate, person?: string) =>
  `/reports?month=${month.slice(0, 7)}${person ? `&person=${person}` : ""}`;

function MonthSwitcher({
  month,
  current,
  person,
}: {
  month: CalendarDate;
  current: CalendarDate;
  person?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon" aria-label="Previous month">
        <Link href={reportHref(shiftMonth(month, -1), person)}>
          <ChevronLeft />
        </Link>
      </Button>
      <span className="min-w-20 text-center font-mono text-sm tabular-nums">
        {formatMonth(month)}
      </span>
      {month < current ? (
        <Button asChild variant="outline" size="icon" aria-label="Next month">
          <Link href={reportHref(shiftMonth(month, 1), person)}>
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

const dueText = (view: View) =>
  `Due ${formatDateTime(reportDueAt(view.month, view.settings.dueTime))} (first Monday of the next month)`;

function flagFor(view: View, report: MonthlyReport | null) {
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

async function ReportView({
  view,
  personId,
  kind,
  report,
}: {
  view: View;
  personId: string;
  kind: ReportKind;
  report: MonthlyReport | null;
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
          <Link href={reportHref(view.month)}>
            <ChevronLeft data-icon="inline-start" />
            All reports
          </Link>
        </Button>
      )}
      <PageHeader
        title={`${KIND_LABEL[kind]} · ${name}`}
        description={dueText(view)}
        actions={
          <MonthSwitcher
            month={view.month}
            current={`${view.today.slice(0, 7)}-01`}
            person={own ? undefined : personId}
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

async function MonthList({ view }: { view: View }) {
  const reports = (await loadMonthReports(view.month)).sort((a, b) =>
    (view.nameOf.get(a.profileId) ?? "").localeCompare(
      view.nameOf.get(b.profileId) ?? "",
    ),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Team reports"
        description={`Monthly reports from salespeople, the BD Director and Site Supervisors. ${dueText(view)}.`}
        actions={
          <MonthSwitcher
            month={view.month}
            current={`${view.today.slice(0, 7)}-01`}
          />
        }
      />
      <DataTable
        rows={reports}
        getRowKey={(report) => report.id}
        empty={
          <EmptyState
            icon={ClipboardList}
            title={`No reports for ${formatMonth(view.month)} yet`}
            description="Reports appear here once people start them."
          />
        }
        columns={[
          {
            key: "person",
            header: "Person",
            cell: (report) => (
              <Link
                href={reportHref(view.month, report.profileId)}
                className="font-medium underline-offset-4 hover:underline"
              >
                {view.nameOf.get(report.profileId) ?? "Unnamed"}
              </Link>
            ),
          },
          {
            key: "kind",
            header: "Report",
            cell: (report) => KIND_LABEL[report.kind],
          },
          {
            key: "status",
            header: "Status",
            cell: (report) => {
              const flag = flagFor(view, report);
              return <StatusBadge tone={flag.tone}>{flag.label}</StatusBadge>;
            },
          },
          {
            key: "submitted",
            header: "Submitted",
            numeric: true,
            cell: (report) =>
              report.submittedAt ? formatDateTime(report.submittedAt) : "-",
          },
        ]}
      />
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("reports");
  const params = await searchParams;
  const today = todayMyt();
  const current = `${today.slice(0, 7)}-01`;
  const asked = monthParam.parse(params.month);
  const month = asked && asked <= current ? asked : current;
  const person = personParam.parse(params.person);

  const [settings, team] = await Promise.all([
    loadReportSettings(),
    getTeamDirectory(),
  ]);
  const view: View = {
    me,
    month,
    today,
    settings,
    nameOf: new Map(team.map((member) => [member.id, member.name])),
  };

  const ownKind = reportKindFor(me.jobRole);
  if (ownKind && (!person || person === me.id)) {
    return (
      <ReportView
        view={view}
        personId={me.id}
        kind={ownKind}
        report={await loadMonthlyReport(me.id, month)}
      />
    );
  }
  if (person) {
    // Row-level security returns only the reports this person may read.
    const report = await loadMonthlyReport(person, month);
    if (!report) {
      return (
        <div className="flex flex-col gap-4">
          <Button asChild variant="ghost" size="sm" className="self-start">
            <Link href={reportHref(month)}>
              <ChevronLeft data-icon="inline-start" />
              All reports
            </Link>
          </Button>
          <div className="rounded-xl border bg-card">
            <EmptyState
              icon={ClipboardList}
              title={`No report for ${formatMonth(month)}`}
              description="This person has not started their report for the month, or it is not one you can see."
            />
          </div>
        </div>
      );
    }
    return (
      <ReportView
        view={view}
        personId={person}
        kind={report.kind}
        report={report}
      />
    );
  }
  return <MonthList view={view} />;
}

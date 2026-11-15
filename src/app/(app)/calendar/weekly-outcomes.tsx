import { ChevronRight, Users } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import type { Profile } from "@/lib/auth/current-profile";
import { startOfWeek } from "@/lib/domain/calendar-grid";
import {
  addDays,
  type CalendarDate,
  dayOfWeek,
  formatDate,
  formatDateTime,
  todayMyt,
} from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { cn } from "@/lib/utils";
import { activityDay } from "../activities/last-activity";
import { needsOutcome, VisitResultLabel } from "../activities/outcome-schema";
import { ActivityTypeLabel } from "../activities/schemas";
import {
  canReviewWeeklyReport,
  filesWeeklyReport,
  type OutcomeActivity,
  type OutcomesRow,
  type ReportState,
} from "./weekly-outcomes-data";
import { loadWeeklyOutcomes } from "./weekly-outcomes-load";
import { ReviewWeeklyReport, SubmitWeeklyReport } from "./weekly-report-forms";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type WeeklyOutcomesProps = {
  me: Profile;
  /** A day inside the week to show. */
  date: CalendarDate;
  /** The one person a manager picked, if any. */
  picked: string | undefined;
};

/** The Weekly outcomes tab: each salesperson's week, their weekly report, and its review. */
export async function WeeklyOutcomes({
  me,
  date,
  picked,
}: WeeklyOutcomesProps) {
  const { monday, dueAt, now, team, rows } = await loadWeeklyOutcomes({
    me,
    date,
    picked,
  });
  const overdue = now > dueAt;
  const mine = rows.find((row) => row.id === me.id);
  const started = monday <= startOfWeek(todayMyt(now));

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Outcomes due{" "}
        <span className="font-medium text-foreground">{formatDue(dueAt)}</span>{" "}
        · reviewed at the Monday sales meeting on{" "}
        <span className="font-mono tabular-nums">
          {formatDate(addDays(monday, 7))}
        </span>
      </p>
      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No salespeople to show"
          description="Nobody in this view had appointments this week."
        />
      ) : (
        <div className="grid gap-2">
          {rows.map((row) => (
            <PersonWeek
              key={row.id}
              row={row}
              overdue={overdue}
              canReview={canReviewWeeklyReport(me, row.id, team)}
            />
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Every visit, call or meeting needs its outcome logged by{" "}
        {formatDue(dueAt)} of the same week. Open a name to see each visit and
        what was learned.
      </p>
      {filesWeeklyReport(me.jobRole) && mine && started && (
        <MyReport row={mine} monday={monday} />
      )}
    </div>
  );
}

const reportOf = (state: ReportState) =>
  "report" in state ? state.report : null;

function PersonWeek({
  row,
  overdue,
  canReview,
}: {
  row: OutcomesRow;
  overdue: boolean;
  canReview: boolean;
}) {
  const report = reportOf(row.report);
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-3.5">
        <span className="flex min-w-36 items-center gap-1 font-medium">
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
          {row.name}
        </span>
        <Stat label="Visits done" value={row.visitsDone} />
        <Stat label="Outcome logged" value={row.logged} />
        <span className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Not logged</span>
          {row.notLogged > 0 ? (
            <StatusBadge tone={overdue ? "bad" : "warn"}>
              {row.notLogged}
            </StatusBadge>
          ) : (
            <span className="font-mono tabular-nums">0</span>
          )}
        </span>
        <Stat label="Logged late" value={row.lateLogged || "–"} />
        <Stat
          label="New leads"
          value={row.leads ? `${row.leads} · ${formatRm(row.leadValue)}` : "–"}
        />
        <ReportBadge state={row.report} />
        {row.results.length > 0 && (
          <span className="flex basis-full flex-wrap gap-1">
            {row.results.map(({ result, count }) => (
              <StatusBadge key={result}>
                {VisitResultLabel[result]} {count}
              </StatusBadge>
            ))}
          </span>
        )}
      </summary>
      <div className="grid gap-3 border-t bg-sunk p-3.5">
        {report?.note && (
          <p className="text-sm">
            <span className="font-medium">Key points:</span> {report.note}
          </p>
        )}
        {report?.reviewNote && (
          <p className="text-sm text-muted-foreground">
            Review comment: {report.reviewNote}
          </p>
        )}
        {report?.status === "submitted" && canReview && (
          <ReviewWeeklyReport reportId={report.id} />
        )}
        {row.activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No visits this week.</p>
        ) : (
          row.activities.map((activity) => (
            <VisitCard key={activity.id} activity={activity} />
          ))
        )}
      </div>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </span>
  );
}

function ReportBadge({ state }: { state: ReportState }) {
  switch (state.kind) {
    case "reviewed":
      return <StatusBadge tone="good">Reviewed</StatusBadge>;
    case "submitted":
      return (
        <StatusBadge tone={state.report.late ? "warn" : "info"}>
          Submitted {formatDate(activityDay(state.report.submittedAt))}
          {state.report.late ? " · late" : ""}
        </StatusBadge>
      );
    case "not_submitted":
      return <StatusBadge tone="bad">Not submitted</StatusBadge>;
    case "due":
      return <StatusBadge>Report due</StatusBadge>;
    case "not_expected":
      return null;
  }
}

function VisitCard({ activity }: { activity: OutcomeActivity }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          <span className="font-mono tabular-nums">
            {formatDate(activityDay(activity.startsAt))}
          </span>{" "}
          · {activity.company}
        </span>
        <span className="text-muted-foreground">
          {ActivityTypeLabel[activity.type]} · {activity.customer}
        </span>
        {activity.result && (
          <StatusBadge tone="good">
            {VisitResultLabel[activity.result]}
          </StatusBadge>
        )}
        {needsOutcome(activity) && (
          <StatusBadge tone="bad">Outcome not logged</StatusBadge>
        )}
        {activity.lateLogged && activity.loggedAt && (
          <StatusBadge tone="warn">
            Logged late {formatDate(activityDay(activity.loggedAt))}
          </StatusBadge>
        )}
      </div>
      {activity.outcome && <p>{activity.outcome}</p>}
      {activity.lead && (
        <p className="text-muted-foreground">
          Lead: <span className="font-medium">{activity.lead.name}</span>
          {activity.lead.value > 0 && ` · ${formatRm(activity.lead.value)}`}
        </p>
      )}
    </div>
  );
}

/** The salesperson's own report for the week: its status once sent, else the submit box. */
function MyReport({ row, monday }: { row: OutcomesRow; monday: CalendarDate }) {
  const report = reportOf(row.report);
  if (report) {
    return (
      <div
        className={cn(
          "grid gap-1 rounded-xl border p-3.5 text-sm",
          report.status === "reviewed" ? "bg-good-bg" : "bg-info-bg",
        )}
      >
        <p>
          <span className="font-medium">
            Weekly report{" "}
            {report.status === "reviewed" ? "reviewed" : "submitted"}
          </span>{" "}
          · sent {formatDateTime(report.submittedAt)}
          {report.late && (
            <span className="text-warn"> · after the deadline</span>
          )}
        </p>
        {report.note && <p>{report.note}</p>}
        {report.reviewNote && (
          <p className="text-muted-foreground">
            Review comment: {report.reviewNote}
          </p>
        )}
      </div>
    );
  }
  const unlogged = row.activities.filter((a) => needsOutcome(a));
  return (
    <section className="grid gap-3 rounded-xl border bg-card p-3.5">
      <h2 className="font-heading text-base font-medium">
        Submit this week's report
      </h2>
      {unlogged.length > 0 && (
        <p className="text-sm text-bad">
          Log the outcome of {unlogged.length} visit
          {unlogged.length === 1 ? "" : "s"} first:{" "}
          {unlogged
            .map((a) => `${formatDate(activityDay(a.startsAt))} ${a.company}`)
            .join(", ")}
        </p>
      )}
      <SubmitWeeklyReport monday={monday} blocked={unlogged.length > 0} />
    </section>
  );
}

/** e.g. "Fri 20 Nov 2026, 6:00 PM" in Malaysia time. */
function formatDue(dueAt: Date) {
  return `${WEEKDAYS[dayOfWeek(todayMyt(dueAt))]} ${formatDateTime(dueAt)}`;
}

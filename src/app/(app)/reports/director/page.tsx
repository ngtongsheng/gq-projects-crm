import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { requireSection } from "@/lib/auth/require-section";
import { formatDateTime, formatMonth } from "@/lib/format/date";
import { loadMonthlyReport, loadMonthReports } from "../report-data";
import { loadReportFilers } from "../report-filers";
import { loadReportsView } from "../report-params";
import {
  dueText,
  flagFor,
  MonthSwitcher,
  ReportView,
  reportHref,
} from "../report-view";

export const metadata: Metadata = { title: "Director Report" };

const BASE_PATH = "/reports/director";

/**
 * The BD Director's monthly report. The BD Director writes it here; only the MD reviews it,
 * and only the MD and HR & Accounts can read it (the database enforces both).
 */
export default async function DirectorReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("directorReport");
  const { view, person } = await loadReportsView(
    me,
    BASE_PATH,
    await searchParams,
  );

  if (me.jobRole === "bd") {
    return (
      <ReportView
        view={view}
        personId={me.id}
        kind="bd"
        report={await loadMonthlyReport(me.id, view.month)}
        backLabel="Director Report"
      />
    );
  }

  if (me.jobRole === "director") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Director Report" />
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={ClipboardList}
            title="The BD Director's report is seen by the MD and HR & Accounts"
            description="Your Sales Director review of salespeople and site supervisors is under Team Reports."
          />
        </div>
      </div>
    );
  }

  const directors = (await loadReportFilers()).filter(
    (filer) => filer.kind === "bd",
  );
  const filer = person
    ? directors.find((candidate) => candidate.id === person)
    : undefined;
  if (filer) {
    return (
      <ReportView
        view={view}
        personId={filer.id}
        kind="bd"
        report={await loadMonthlyReport(filer.id, view.month)}
        backLabel="Director Report"
      />
    );
  }

  const reports = await loadMonthReports(view.month);
  const rows = directors.map((director) => ({
    ...director,
    report: reports.find((r) => r.profileId === director.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Director Report"
        description={`${formatMonth(view.month)}. ${dueText(view)}. The MD reviews this report.`}
        actions={<MonthSwitcher view={view} />}
      />
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={ClipboardList}
            title="No BD Director yet"
            description="The report appears here once someone has the BD Director job role."
          />
        }
        columns={[
          {
            key: "person",
            header: "Director",
            cell: (row) => (
              <Link
                href={reportHref(BASE_PATH, view.month, { person: row.id })}
                className="font-medium underline-offset-4 hover:underline"
              >
                {row.name}
              </Link>
            ),
          },
          {
            key: "status",
            header: "Report",
            cell: (row) => {
              const flag = flagFor(view, row.report);
              return <StatusBadge tone={flag.tone}>{flag.label}</StatusBadge>;
            },
          },
          {
            key: "submitted",
            header: "Submitted",
            numeric: true,
            cell: (row) =>
              row.report?.submittedAt
                ? formatDateTime(row.report.submittedAt)
                : "-",
          },
        ]}
      />
    </div>
  );
}

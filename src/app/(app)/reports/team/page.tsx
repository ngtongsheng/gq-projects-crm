import { ChevronLeft, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { isManager } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { monthPace } from "@/lib/domain/report-stats";
import { formatMonth } from "@/lib/format/date";
import {
  loadLiveStats,
  loadMonthlyReport,
  loadMonthReports,
} from "../report-data";
import { loadReportFilers } from "../report-filers";
import { loadReportsView } from "../report-params";
import { dueText, MonthSwitcher, ReportView, reportHref } from "../report-view";
import { type TeamRow, TeamTable } from "./team-table";

export const metadata: Metadata = { title: "Team Reports" };

const BASE_PATH = "/reports/team";
const kindParam = z.enum(["sales", "site"]).catch("sales");

/** Everyone's monthly report for a month, open to review. Managers only (MD, Sales Director, HR & Accounts). */
export default async function TeamReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("rep");
  if (!isManager(me.jobRole)) redirect("/reports");
  const params = await searchParams;
  const { view, person } = await loadReportsView(me, BASE_PATH, params);
  const kind = kindParam.parse(params.kind);
  const filers = (await loadReportFilers()).filter(
    (filer) => filer.kind === "sales" || filer.kind === "site",
  );

  if (person) {
    const filer = filers.find((candidate) => candidate.id === person);
    if (!filer) {
      return (
        <div className="flex flex-col gap-4">
          <Button asChild variant="ghost" size="sm" className="self-start">
            <Link href={reportHref(BASE_PATH, view.month, { kind })}>
              <ChevronLeft data-icon="inline-start" />
              Team Reports
            </Link>
          </Button>
          <div className="rounded-xl border bg-card">
            <EmptyState
              icon={ClipboardList}
              title="Report not found"
              description="This person does not file a report you can see here."
            />
          </div>
        </div>
      );
    }
    return (
      <ReportView
        view={view}
        personId={filer.id}
        kind={filer.kind}
        report={await loadMonthlyReport(filer.id, view.month)}
        query={{ kind: filer.kind }}
        backLabel="Team Reports"
      />
    );
  }

  const reports = await loadMonthReports(view.month);
  const rows: TeamRow[] = await Promise.all(
    filers
      .filter((filer) => filer.kind === kind)
      .map(async (filer) => {
        const report = reports.find((r) => r.profileId === filer.id) ?? null;
        return {
          id: filer.id,
          name: filer.name,
          report,
          stats:
            report?.stats ??
            (await loadLiveStats(
              filer.kind,
              filer.id,
              view.month,
              view.settings.targets,
            )),
        };
      }),
  );
  const submitted = rows.filter(
    (row) => row.report && row.report.status !== "draft",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Team Reports"
        description={`${formatMonth(view.month)}: ${submitted} of ${rows.length} submitted. ${dueText(view)}.`}
        actions={<MonthSwitcher view={view} query={{ kind }} />}
      />
      <nav aria-label="Report type" className="flex gap-2">
        {(["sales", "site"] as const).map((tab) => (
          <Button
            key={tab}
            asChild
            size="sm"
            variant={tab === kind ? "default" : "outline"}
          >
            <Link
              href={reportHref(BASE_PATH, view.month, { kind: tab })}
              aria-current={tab === kind ? "page" : undefined}
            >
              {tab === "sales" ? "Salespeople" : "Site supervisors"}
            </Link>
          </Button>
        ))}
      </nav>
      <TeamTable
        view={view}
        kind={kind}
        rows={rows}
        pace={monthPace(view.month, view.today)}
      />
      <p className="text-sm text-muted-foreground">
        {kind === "sales"
          ? "Figures come from the calendar, projects and MOFs. They freeze when the report is submitted."
          : "Counts come from the site log and overtime. They freeze when the report is submitted."}
      </p>
    </div>
  );
}

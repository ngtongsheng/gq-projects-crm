import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth/require-page";
import { reportKindFor } from "@/lib/domain/report-stats";
import { loadMonthlyReport } from "./report-data";
import { loadReportsView } from "./report-params";
import { ReportView, reportHref } from "./report-view";

export const metadata: Metadata = { title: "My Report" };

/** A salesperson's or Site Supervisor's own report; managers go to Team Reports. */
export default async function MyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("rep", "srep");
  const { view } = await loadReportsView(me, "/reports", await searchParams);
  const kind = reportKindFor(me.jobRole);
  if (!kind) redirect(reportHref("/reports/team", view.month));

  return (
    <ReportView
      view={view}
      personId={me.id}
      kind={kind}
      report={await loadMonthlyReport(me.id, view.month)}
      backLabel="All reports"
    />
  );
}

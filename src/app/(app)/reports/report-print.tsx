"use client";

import { Printer } from "lucide-react";
import { PrintLayout, PrintSignatureRow } from "@/components/app/print-layout";
import { Button } from "@/components/ui/button";
import type { ReportKind, ReportStats } from "@/lib/domain/report-stats";
import type { SiteReport } from "@/lib/domain/site-report";
import { type CalendarDate, formatMonth } from "@/lib/format/date";
import type { MonthlyReport } from "./report-data";
import { ReportFigures } from "./report-figures";
import { SiteReportPrintSections } from "./site-report-print";

const STATUS_LABEL: Record<MonthlyReport["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  approved: "Approved",
};

/** The "Print report" button for the page header. It prints the sheet below, not the screen. */
export function PrintReportButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer aria-hidden data-icon="inline-start" />
      Print report
    </Button>
  );
}

const sectionHeading = "mb-1 text-[10px] font-bold uppercase text-[#7a8691]";

/**
 * The report as an A4 form with Prepared / Reviewed / Acknowledged signatures. Invisible on
 * screen; the page's own content is hidden when printing, so only this sheet comes out.
 * It prints what is saved, so a draft's unsaved typing is left out.
 */
export function ReportPrintSheet({
  title,
  kind,
  month,
  personName,
  report,
  stats,
  siteReport,
  pace,
  reviewerName,
  approverName,
}: {
  title: string;
  kind: ReportKind;
  month: CalendarDate;
  personName: string;
  report: MonthlyReport | null;
  stats: ReportStats;
  /** The site report's itinerary and tables; null for the other kinds. */
  siteReport: SiteReport | null;
  pace: number;
  /** Null until someone has reviewed the report. */
  reviewerName: string | null;
  /** Null until the MD has given final approval. */
  approverName: string | null;
}) {
  return (
    <div className="hidden print:block">
      <PrintLayout
        title={title}
        meta={[
          { label: "Name", value: personName },
          { label: "Month", value: formatMonth(month) },
          {
            label: "Status",
            value: report ? STATUS_LABEL[report.status] : "Not started",
          },
        ]}
      >
        <h2 className={sectionHeading}>
          {kind === "site" ? "Site work this month" : "Sales this month"}
        </h2>
        <ReportFigures stats={stats} pace={pace} />
        {siteReport && stats.kind === "site" && (
          <SiteReportPrintSections
            report={siteReport}
            visitTarget={stats.siteVisitTarget}
          />
        )}

        {report && (
          <div className="mt-4 flex flex-col gap-3">
            {kind !== "site" && (
              <section>
                <h2 className={sectionHeading}>Key highlights and wins</h2>
                {report.highlights.length === 0 ? (
                  <p>None written.</p>
                ) : (
                  <ol className="list-decimal pl-5">
                    {report.highlights.map((highlight) => (
                      <li key={`${highlight.company}|${highlight.achievement}`}>
                        {highlight.company ? (
                          <b>{highlight.company}: </b>
                        ) : null}
                        {highlight.achievement}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
            <section>
              <h2 className={sectionHeading}>Plan for next month</h2>
              <p className="whitespace-pre-line">
                {report.nextMonthPlan ?? "-"}
              </p>
            </section>
            <section>
              <h2 className={sectionHeading}>
                {kind === "site"
                  ? "Site issues and support needed"
                  : "Support needed"}
              </h2>
              <p className="whitespace-pre-line">
                {report.supportNeeded ?? "-"}
              </p>
            </section>
            {report.reviewNote && (
              <section>
                <h2 className={sectionHeading}>Review note</h2>
                <p className="whitespace-pre-line">{report.reviewNote}</p>
              </section>
            )}
          </div>
        )}

        <div className="mt-6">
          <PrintSignatureRow
            columns={3}
            signers={[
              {
                label: "Prepared by",
                caption: personName,
                fields: ["Date"],
              },
              {
                label: "Reviewed by",
                caption: reviewerName ?? undefined,
                fields: ["Date"],
              },
              {
                label: "Acknowledged by (MD)",
                caption: approverName ?? undefined,
                fields: ["Date"],
              },
            ]}
          />
        </div>
      </PrintLayout>
    </div>
  );
}

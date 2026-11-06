import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteMonthlyReport } from "@/lib/domain/site-monthly-report";
import { formatDate } from "@/lib/format/date";

const cell = "px-3 py-2 align-top";
const head = `${cell} text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase`;

/**
 * A Site Supervisor's month as the report form lays it out: every site visit, the overtime and
 * the activity counts, with the PDF to download. `pdfHref` is the download link.
 */
export function SiteItinerary({
  report,
  pdfHref,
}: {
  report: SiteMonthlyReport;
  pdfHref: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">
          Itinerary and activity record
        </h2>
        <Button asChild variant="outline" size="sm">
          <a href={pdfHref}>
            <Download data-icon="inline-start" />
            Download PDF
          </a>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className={head}>No.</th>
              <th className={head}>Date</th>
              <th className={head}>MOF no.</th>
              <th className={head}>Project / site</th>
              <th className={head}>Activity</th>
              <th className={head}>Details</th>
            </tr>
          </thead>
          <tbody>
            {report.itinerary.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${cell} text-muted-foreground`}>
                  No site visits logged this month. Add them under Site Work.
                </td>
              </tr>
            ) : (
              report.itinerary.map((row) => (
                <tr key={row.no} className="border-b last:border-0">
                  <td className={`${cell} font-mono tabular-nums`}>{row.no}</td>
                  <td className={`${cell} whitespace-nowrap`}>
                    {formatDate(row.date)}{" "}
                    <span className="text-muted-foreground">{row.day}</span>
                  </td>
                  <td className={`${cell} font-mono`}>{row.mofNo}</td>
                  <td className={cell}>{row.site}</td>
                  <td className={cell}>{row.activity}</td>
                  <td className={`${cell} text-muted-foreground`}>
                    {row.details || "–"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-sm tabular-nums text-muted-foreground">
        {report.summary
          .filter((row) => row.count > 0)
          .map((row) => `${row.count} ${row.label.toLowerCase()}`)
          .join(" · ") || "No activities yet"}
        {report.totalActivities > 0
          ? ` · ${report.totalActivities} in total`
          : ""}
      </p>

      <h2 className="mt-2 font-heading text-lg font-semibold">
        Overtime / night work
      </h2>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className={head}>Date</th>
              <th className={head}>Project / site and reason</th>
              <th className={head}>From</th>
              <th className={head}>To</th>
              <th className={`${head} text-right`}>Hours</th>
              <th className={head}>Approved by</th>
            </tr>
          </thead>
          <tbody>
            {report.overtime.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${cell} text-muted-foreground`}>
                  No overtime this month.
                </td>
              </tr>
            ) : (
              report.overtime.map((row) => (
                <tr key={row.no} className="border-b last:border-0">
                  <td className={`${cell} whitespace-nowrap`}>
                    {formatDate(row.workDate)}
                  </td>
                  <td className={cell}>
                    <span className="font-mono">{row.mofNo}</span>{" "}
                    {row.projectName}
                    <span className="block text-xs text-muted-foreground">
                      {row.reason}
                    </span>
                  </td>
                  <td className={`${cell} font-mono tabular-nums`}>
                    {row.fromTime}
                  </td>
                  <td className={`${cell} font-mono tabular-nums`}>
                    {row.toTime}
                  </td>
                  <td className={`${cell} text-right font-mono tabular-nums`}>
                    {row.hours}
                  </td>
                  <td className={cell}>
                    {row.status === "approved"
                      ? (row.approvedBy ?? "Approved")
                      : "Waiting"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-sm tabular-nums text-muted-foreground">
        Total OT hours: {report.overtimeHours}
      </p>
    </section>
  );
}

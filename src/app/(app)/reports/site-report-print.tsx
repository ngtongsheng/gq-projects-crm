import {
  ORIGIN_LABEL,
  type SiteReport,
  scheduleCheckSummary,
  shootingHandoverWords,
  stockReturnSummary,
} from "@/lib/domain/site-report";
import { formatDate } from "@/lib/format/date";

const sectionHeading = "mb-1 text-[10px] font-bold uppercase text-[#7a8691]";
const cell = "border border-[#c9d0d6] px-1.5 py-1 text-left align-top";

/**
 * The site report's own sections on the A4 form (the demo's `printSrep`): itinerary with the
 * schedule check, shooting and handover, and stock returns. Remarks follow from the sheet.
 */
export function SiteReportPrintSections({
  report,
  visitTarget,
}: {
  report: SiteReport;
  visitTarget: number;
}) {
  const { itinerary, shootingHandover, stockReturns } = report;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <section>
        <h2 className={sectionHeading}>
          Itinerary · {itinerary.counts.visits}/{visitTarget} site visits
        </h2>
        <p className="mb-1">{scheduleCheckSummary(itinerary.counts)}</p>
        {itinerary.lines.length === 0 ? (
          <p>No site visits or bookings this month.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={cell}>Date</th>
                <th className={cell}>Site</th>
                <th className={cell}>Work</th>
                <th className={cell}>Scheduled or added</th>
              </tr>
            </thead>
            <tbody>
              {itinerary.lines.map((line) => (
                <tr key={`${line.day}|${line.siteLabel}`}>
                  <td className={cell}>{formatDate(line.day)}</td>
                  <td className={cell}>{line.siteLabel}</td>
                  <td className={cell}>{line.work.join(", ")}</td>
                  <td className={cell}>{ORIGIN_LABEL[line.origin]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2 className={sectionHeading}>Shooting and handover</h2>
        {shootingHandover.length === 0 ? (
          <p>No shootings or handovers this month.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={cell}>Date</th>
                <th className={cell}>Site</th>
                <th className={cell}>Work</th>
                <th className={cell}>Result</th>
              </tr>
            </thead>
            <tbody>
              {shootingHandover.map((row) => {
                const words = shootingHandoverWords(row);
                return (
                  <tr key={`${row.day}|${row.siteLabel}|${row.activity}`}>
                    <td className={cell}>{formatDate(row.day)}</td>
                    <td className={cell}>{row.siteLabel}</td>
                    <td className={cell}>{words.work}</td>
                    <td className={cell}>{words.result}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2 className={sectionHeading}>Stock returns</h2>
        <p>{stockReturnSummary(stockReturns)}</p>
      </section>
    </div>
  );
}

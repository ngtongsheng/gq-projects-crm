import { PrintLayout } from "@/components/app/print-layout";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import type { EventSheet } from "./marketing-events";
import type { MarketingEvent } from "./marketing-types";

const heading = "mb-1 mt-3 text-[10px] font-bold uppercase text-[#7a8691]";
const table = "w-full border-collapse text-[11px]";
const cell = "border border-[#242e38] px-1.5 py-1";
const head = `${cell} bg-[#eef1f4] text-left text-[10px] font-bold uppercase`;
const num = `${cell} text-right`;

/** "1 May 2026 – 4 May 2026", or the one date given. */
export function eventDates(event: Pick<MarketingEvent, "startsOn" | "endsOn">) {
  const { startsOn, endsOn } = event;
  if (startsOn && endsOn && startsOn !== endsOn) {
    return `${formatDate(startsOn)} – ${formatDate(endsOn)}`;
  }
  const only = startsOn ?? endsOn;
  return only ? formatDate(only) : "";
}

/**
 * The event costing sheet as the demo prints it (printMkEvt): the summary by cost group, every
 * cost item and the total. Invisible on screen; the page's own content is hidden when printing.
 */
export function MarketingEventPrint({
  event,
  sheet,
  printedOn,
  printedBy,
  t,
}: {
  event: MarketingEvent;
  sheet: EventSheet;
  printedOn: string;
  printedBy: string;
  t: Translate;
}) {
  const dates = eventDates(event);
  return (
    <div data-print-sheet className="hidden print:block">
      <PrintLayout
        title={t("Event costing")}
        meta={[
          { label: t("Event"), value: event.name },
          ...(dates ? [{ label: t("Date"), value: dates }] : []),
          ...(event.venue ? [{ label: t("Venue"), value: event.venue }] : []),
        ]}
      >
        <h2 className={heading}>{t("Summary by cost group")}</h2>
        <table className={table}>
          <thead>
            <tr>
              <th className={head}>{t("Group")}</th>
              <th className={`${head} w-32 text-right`}>{t("Total")}</th>
              <th className={`${head} w-14 text-right`}>%</th>
            </tr>
          </thead>
          <tbody>
            {sheet.groups.map((group) => (
              <tr key={group.group}>
                <td className={cell}>{group.group}</td>
                <td className={num}>{formatRm(group.total)}</td>
                <td className={num}>{group.percent}%</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={cell}>{t("TOTAL")}</td>
              <td className={num}>{formatRm(sheet.total)}</td>
              <td className={num} />
            </tr>
          </tbody>
        </table>

        <h2 className={heading}>{t("Cost items")}</h2>
        <table className={table}>
          <thead>
            <tr>
              <th className={head}>{t("Group")}</th>
              <th className={head}>{t("Description")}</th>
              <th className={head}>{t("Supplier / ref")}</th>
              <th className={`${head} text-right`}>{t("Foreign amt")}</th>
              <th className={`${head} text-right`}>{t("Rate")}</th>
              <th className={head}>{t("Unit")}</th>
              <th className={`${head} text-right`}>{t("Qty")}</th>
              <th className={`${head} text-right`}>{t("Total")}</th>
            </tr>
          </thead>
          <tbody>
            {sheet.groups.flatMap((group) =>
              group.items.map((item) => (
                <tr key={`${item.source}-${item.id}`}>
                  <td className={cell}>{group.group}</td>
                  <td className={cell}>{item.description}</td>
                  <td className={cell}>{item.supplierRef}</td>
                  <td className={num}>{item.foreignAmount}</td>
                  <td className={num}>
                    {item.rate === null ? "" : formatRm(item.rate)}
                  </td>
                  <td className={cell}>{item.unit}</td>
                  <td className={num}>{item.qty}</td>
                  <td className={num}>{formatRm(item.total)}</td>
                </tr>
              )),
            )}
            <tr className="font-bold">
              <td className={num} colSpan={7}>
                {t("TOTAL")} {event.name.toUpperCase()}
              </td>
              <td className={num}>{formatRm(sheet.total)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 text-[10px] text-[#7a8691]">
          {t("Printed")} {formatDate(printedOn)} {t("by")} {printedBy}
        </p>
      </PrintLayout>
    </div>
  );
}

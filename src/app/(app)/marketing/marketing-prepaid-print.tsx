import { PrintLayout } from "@/components/app/print-layout";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { formatForeign, type StatementRow } from "./marketing-prepaid";
import type { PrepaidAccount } from "./marketing-types";

const heading = "mb-1 mt-3 text-[10px] font-bold uppercase text-[#7a8691]";
const table = "w-full border-collapse text-[11px]";
const cell = "border border-[#242e38] px-1.5 py-1";
const head = `${cell} bg-[#eef1f4] text-left text-[10px] font-bold uppercase`;
const num = `${cell} text-right`;

/**
 * One vendor's prepaid statement as the demo prints it (printMkPre): the totals and every entry
 * with its running balance. Invisible on screen; the page's own content is hidden when printing.
 */
export function MarketingPrepaidPrint({
  account,
  rows,
  printedOn,
  printedBy,
  t,
}: {
  account: PrepaidAccount;
  rows: readonly StatementRow[];
  printedOn: string;
  printedBy: string;
  t: Translate;
}) {
  return (
    <div data-print-sheet className="hidden print:block">
      <PrintLayout
        title={t("Prepaid account statement")}
        meta={[{ label: t("Vendor"), value: account.vendorName }]}
      >
        <table className={table}>
          <tbody>
            <tr>
              <td className={`${cell} font-bold`}>{t("Topped up")}</td>
              <td className={cell}>{formatRm(account.toppedUp)}</td>
              <td className={`${cell} font-bold`}>{t("Used")}</td>
              <td className={cell}>{formatRm(account.used)}</td>
              <td className={`${cell} font-bold`}>{t("Balance")}</td>
              <td className={`${cell} font-bold`}>
                {formatRm(account.balance)}
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className={heading}>{t("Entries")}</h2>
        <table className={table}>
          <thead>
            <tr>
              <th className={head}>{t("Date")}</th>
              <th className={head}>{t("Client – project")}</th>
              <th className={head}>{t("MOF / ref")}</th>
              <th className={head}>{t("Foreign")}</th>
              <th className={`${head} text-right`}>{t("Top-up (RM)")}</th>
              <th className={`${head} text-right`}>{t("Used (RM)")}</th>
              <th className={`${head} text-right`}>{t("Balance (RM)")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={cell}>{formatDate(row.entryOn)}</td>
                <td className={cell}>{row.description}</td>
                <td className={cell}>{row.mofRef}</td>
                <td className={cell}>
                  {row.foreignCurrency && row.foreignAmount !== null
                    ? formatForeign(row.foreignCurrency, row.foreignAmount)
                    : ""}
                </td>
                <td className={num}>
                  {row.kind === "top_up" ? formatRm(row.amountRm) : ""}
                </td>
                <td className={num}>
                  {row.kind === "deduction" ? formatRm(row.amountRm) : ""}
                </td>
                <td className={num}>{formatRm(row.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-[10px] text-[#7a8691]">
          {t("Printed")} {formatDate(printedOn)} {t("by")} {printedBy}
        </p>
      </PrintLayout>
    </div>
  );
}

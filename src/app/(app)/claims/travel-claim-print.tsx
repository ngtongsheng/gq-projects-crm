import { PrintLayout } from "@/components/app/print-layout";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import type { TravelClaim } from "./travel-claim-data";
import { travelClaimTotal } from "./travel-claim-input";

const heading = "mb-1 mt-3 text-[10px] font-bold uppercase text-[#7a8691]";
const table = "w-full border-collapse text-[11px]";
const cell = "border border-[#242e38] px-1.5 py-1";
const head = `${cell} bg-[#eef1f4] text-left text-[10px] font-bold uppercase`;
const label = `${cell} bg-[#eef1f4] font-bold`;
const num = `${cell} text-right`;

/**
 * The monthly travel claim form as the demo prints it: who and which period, the summary
 * lines, the total, and Claimed / Checked / Approved signatures. Invisible on screen; the
 * page's own content is hidden when printing.
 */
export function TravelClaimPrint({
  claim,
  personName,
  position,
  monthLabel,
  periodLabel,
  monthlyCap,
  t,
}: {
  claim: TravelClaim;
  personName: string;
  position: string;
  /** "Nov 2026". */
  monthLabel: string;
  /** "26 Oct – 25 Nov 2026". */
  periodLabel: string;
  monthlyCap: number | null;
  t: Translate;
}) {
  const lines: [string, number][] = [
    [
      `${t("Petrol + parking + toll (TNG)")}${monthlyCap ? ` (${t("entitlement")} ${formatRm(monthlyCap)})` : ""}`,
      claim.petrolParkingToll ?? 0,
    ],
    [t("Outstation allowance (meals)"), claim.outstation ?? 0],
    [t("Accommodation (hotel)"), claim.hotel ?? 0],
    [
      `${t("Others – bought for the company")}${claim.othersDescription ? ` – ${claim.othersDescription}` : ""}`,
      claim.others ?? 0,
    ],
    ...(claim.overtime
      ? [[t("Overtime (approved OT)"), claim.overtime] as [string, number]]
      : []),
  ];
  const total = travelClaimTotal(claim);

  return (
    <div data-print-sheet className="hidden print:block">
      <PrintLayout
        title={t("Monthly travel claim")}
        meta={[{ label: t("Claim month"), value: monthLabel }]}
      >
        <table className={table}>
          <tbody>
            <tr>
              <td className={`${label} w-[18%]`}>{t("Name")}</td>
              <td className={`${cell} w-[32%]`}>{personName}</td>
              <td className={`${label} w-[18%]`}>{t("Position")}</td>
              <td className={cell}>{position}</td>
            </tr>
            <tr>
              <td className={label}>{t("Claim period")}</td>
              <td className={cell}>{periodLabel}</td>
              <td className={label}>{t("Submitted")}</td>
              <td className={cell}>
                {claim.submittedOn ? formatDate(claim.submittedOn) : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className={heading}>{t("Summary")}</h2>
        <table className={table}>
          <thead>
            <tr>
              <th className={`${head} w-9`}>{t("No.")}</th>
              <th className={head}>{t("Item")}</th>
              <th className={`${head} w-32`}>{t("Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(([item, amount], index) => (
              <tr key={item}>
                <td className={cell}>{index + 1}</td>
                <td className={cell}>{item}</td>
                <td className={num}>{formatRm(amount)}</td>
              </tr>
            ))}
            <tr>
              <td className={`${num} font-bold`} colSpan={2}>
                {t("TOTAL CLAIM")}
              </td>
              <td className={`${num} font-bold`}>{formatRm(total)}</td>
            </tr>
            {claim.finalAmount !== null && claim.finalAmount !== total && (
              <tr>
                <td className={`${num} font-bold`} colSpan={2}>
                  {t("Final approved amount")}
                </td>
                <td className={`${num} font-bold`}>
                  {formatRm(claim.finalAmount)}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {claim.remark && (
          <div className="mt-2 border border-[#242e38] px-2 py-1 text-[11.5px]">
            <b>{t("Remark")}:</b> {claim.remark}
          </div>
        )}
        <p className="my-2 text-[11px]">
          {t(
            "All original receipts (petrol, parking, toll / TNG statement, hotel, others) are attached behind this form. I confirm the above claims are true and were incurred for company work.",
          )}
        </p>
        <table className={`${table} break-inside-avoid`}>
          <thead>
            <tr>
              <th className={`${head} w-1/3`}>{t("Claimed by")}</th>
              <th className={`${head} w-1/3`}>{t("Checked by (Accounts)")}</th>
              <th className={head}>{t("Approved by (Vicky)")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {[0, 1, 2].map((column) => (
                <td
                  key={column}
                  className={`${cell} h-12 align-bottom text-[10px] text-[#7a8691]`}
                >
                  {t("Signature")}
                </td>
              ))}
            </tr>
            <tr>
              <td className={cell}>
                {t("Name")}: {personName}
              </td>
              <td className={cell}>{t("Name")}:</td>
              <td className={cell}>{t("Name")}:</td>
            </tr>
            <tr>
              <td className={cell}>{t("Date")}:</td>
              <td className={cell}>{t("Date")}:</td>
              <td className={cell}>{t("Date")}:</td>
            </tr>
          </tbody>
        </table>
      </PrintLayout>
    </div>
  );
}

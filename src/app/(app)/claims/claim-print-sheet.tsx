import { PrintLayout } from "@/components/app/print-layout";
import { EXPENSE_TYPE_LABEL } from "@/lib/domain/claim-expense";
import type { claimTotals } from "@/lib/domain/monthly-claim";
import { OT_CLAIM_TYPE_LABEL, OT_STATUS_LABEL } from "@/lib/domain/ot-claim";
import { formatDate, formatDateTime, todayMyt } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import type { loadClaimOvertime } from "./claim-ot-data";
import type { Signoff } from "./claim-signoffs-data";
import type { ExpenseLine, StoredCommissionLine } from "./my-claim-data";

const heading = "mb-1 mt-3 text-[10px] font-bold uppercase text-[#7a8691]";
const table = "w-full border-collapse text-[11px]";
const cell = "border border-[#242e38] px-1.5 py-1";
const head = `${cell} bg-[#eef1f4] text-left text-[10px] font-bold uppercase`;
const label = `${cell} bg-[#eef1f4] font-bold`;
const num = `${cell} text-right`;
const box = "mt-2 border border-[#242e38] px-2 py-1 text-[11.5px]";

/** Commission, expense and OT lines of one claim, one per row of each section. */
export type ClaimPrintProps = {
  personName: string;
  position: string;
  monthLabel: string;
  submittedAt: string | null;
  commissions: readonly StoredCommissionLine[];
  expenses: readonly ExpenseLine[];
  overtime: Awaited<ReturnType<typeof loadClaimOvertime>>["entries"];
  /** Null when no OT is in the claim. */
  otAmount: number | null;
  totals: ReturnType<typeof claimTotals>;
  note: string;
  remark: string;
  checked: Signoff | null;
  approved: Signoff | null;
  t: Translate;
};

function Adjusted({
  original,
  amount,
  t,
}: {
  original: number;
  amount: number;
  t: Translate;
}) {
  if (original === amount) return null;
  return (
    <div className="text-[10px]">
      {t("adj. from")} {formatRm(original)}
    </div>
  );
}

/**
 * The monthly claim form as the demo prints it: sections A to C, the total, the original and
 * final amounts when HR & Accounts changed any, and Claimed / Checked / Approved signatures.
 * Invisible on screen; the page's own content is hidden when printing.
 */
export function ClaimPrintSheet(props: ClaimPrintProps) {
  const { t, commissions, expenses, overtime, totals } = props;
  const hasCommission = commissions.length > 0;
  const hasOvertime = overtime.length > 0 || props.otAmount !== null;
  const receipts = expenses.filter((line) => line.receiptNo !== null).length;
  const reasons = [
    ...new Set(
      [...commissions, ...expenses]
        .map((line) => line.adjustmentReason)
        .filter((reason): reason is string => Boolean(reason)),
    ),
  ];
  let section = 0;
  const letter = () => `${String.fromCharCode(65 + section++)}. `;
  const byType = new Map<string, number>();
  for (const line of expenses) {
    const type = t(EXPENSE_TYPE_LABEL[line.expenseType]);
    byType.set(type, (byType.get(type) ?? 0) + line.amount);
  }

  return (
    <div data-print-sheet className="hidden print:block">
      <PrintLayout
        title={t("Monthly claim form")}
        meta={[
          { label: t("Name"), value: props.personName },
          { label: t("Position"), value: props.position },
          { label: t("Claim month"), value: props.monthLabel },
          {
            label: t("Submitted"),
            value: props.submittedAt
              ? formatDate(todayMyt(new Date(props.submittedAt)))
              : t("Not submitted yet"),
          },
        ]}
      >
        {hasCommission && (
          <>
            <h2 className={heading}>
              {letter()}
              {t("Commission")}
            </h2>
            <table className={table}>
              <thead>
                <tr>
                  <th className={head}>{t("No.")}</th>
                  <th className={head}>{t("MOF / project")}</th>
                  <th className={head}>{t("Client")}</th>
                  <th className={head}>{t("Late cut")}</th>
                  <th className={head}>{t("Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((line, index) => (
                  <tr key={line.mofId}>
                    <td className={cell}>{index + 1}</td>
                    <td className={cell}>
                      {line.mofNo} {line.projectName}
                    </td>
                    <td className={cell}>{line.companyName}</td>
                    <td className={cell}>
                      {line.lateCutWaived
                        ? t("Waived – special approval")
                        : line.lateCut >= 1
                          ? `−${formatRm(line.lateCut)}`
                          : "—"}
                    </td>
                    <td className={num}>
                      {formatRm(line.amount)}
                      <Adjusted
                        original={line.originalAmount}
                        amount={line.amount}
                        t={t}
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className={`${num} font-bold`} colSpan={4}>
                    {t("Total commission")}
                  </td>
                  <td className={`${num} font-bold`}>
                    {formatRm(totals.commission.final)}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <h2 className={heading}>
          {hasCommission ? letter() : ""}
          {t("Travelling expense")}
        </h2>
        <table className={table}>
          <thead>
            <tr>
              <th className={head}>{t("Receipt no.")}</th>
              <th className={head}>{t("Date")}</th>
              <th className={head}>{t("Type")}</th>
              <th className={head}>{t("Where / what")}</th>
              <th className={head}>{t("Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td className={cell} colSpan={5}>
                  {t("No travelling expense")}
                </td>
              </tr>
            )}
            {expenses.map((line) => (
              <tr key={line.id}>
                <td className={cell}>
                  <b>{line.receiptNo !== null ? `R${line.receiptNo}` : "–"}</b>
                </td>
                <td className={cell}>{formatDate(line.spentOn)}</td>
                <td className={cell}>
                  {t(EXPENSE_TYPE_LABEL[line.expenseType])}
                  {line.km !== null && ` · ${line.km} km`}
                  {line.nights !== null &&
                    ` · ${line.nights} ${line.nights === 1 ? t("night") : t("nights")}`}
                </td>
                <td className={cell}>{line.description}</td>
                <td className={num}>
                  {formatRm(line.amount)}
                  <Adjusted
                    original={line.originalAmount}
                    amount={line.amount}
                    t={t}
                  />
                </td>
              </tr>
            ))}
            <tr>
              <td className={`${num} font-bold`} colSpan={4}>
                {t("Total travelling expense")}
                {byType.size > 0 && (
                  <div className="text-[10px] font-normal">
                    {[...byType]
                      .map(([type, sum]) => `${type} ${formatRm(sum)}`)
                      .join(" · ")}
                  </div>
                )}
              </td>
              <td className={`${num} font-bold`}>
                {formatRm(totals.expenses.final)}
              </td>
            </tr>
          </tbody>
        </table>

        {hasOvertime && (
          <>
            <h2 className={heading}>
              {letter()}
              {t("Overtime / replacement leave")}
            </h2>
            <table className={table}>
              <thead>
                <tr>
                  <th className={head}>{t("Date")}</th>
                  <th className={head}>{t("Project / site and reason")}</th>
                  <th className={head}>{t("Time")}</th>
                  <th className={head}>{t("Hours")}</th>
                  <th className={head}>{t("Approved as")}</th>
                </tr>
              </thead>
              <tbody>
                {overtime.map((entry) => (
                  <tr key={entry.id}>
                    <td className={cell}>{formatDate(entry.workDate)}</td>
                    <td className={cell}>
                      {entry.mofNo} {entry.projectName} – {entry.reason}
                    </td>
                    <td className={cell}>
                      {entry.fromTime.slice(0, 5)}–{entry.toTime.slice(0, 5)}
                    </td>
                    <td className={cell}>{entry.hours}</td>
                    <td className={cell}>
                      {entry.status === "approved" && entry.approvedAs
                        ? t(OT_CLAIM_TYPE_LABEL[entry.approvedAs])
                        : t(OT_STATUS_LABEL[entry.status])}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className={`${num} font-bold`} colSpan={4}>
                    {t("OT amount")}
                  </td>
                  <td className={`${num} font-bold`}>
                    {props.otAmount
                      ? formatRm(props.otAmount)
                      : t("by Accounts")}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <table className={`${table} mt-3`}>
          <tbody>
            <tr>
              <td className={`${label} w-1/2`}>{t("TOTAL CLAIM")}</td>
              <td className={`${cell} text-[15px] font-bold`}>
                {formatRm(totals.final)}
              </td>
            </tr>
            <tr>
              <td className={label}>{t("Original receipts attached")}</td>
              <td className={cell}>
                {receipts}
                {receipts > 0 && ` (${t("numbered")} R1–R${receipts})`}
              </td>
            </tr>
          </tbody>
        </table>

        {(props.remark || reasons.length > 0) && (
          <div className={box}>
            {props.remark && (
              <div>
                <b>{t("HR & Accounts")}:</b> {props.remark}
              </div>
            )}
            {reasons.length > 0 && (
              <div>
                <b>{t("Adjustment")}:</b> {reasons.join("; ")}
              </div>
            )}
          </div>
        )}
        {props.note && (
          <div className={box}>
            <b>
              {t("Note from")} {props.personName}:
            </b>{" "}
            {props.note}
          </div>
        )}
        {totals.difference !== 0 && (
          <table className={`${table} mt-2`}>
            <tbody>
              <tr>
                <td className={`${label} w-1/2`}>{t("Original claim")}</td>
                <td className={cell}>{formatRm(totals.original)}</td>
              </tr>
              <tr>
                <td className={label}>{t("Final approved amount")}</td>
                <td className={`${cell} font-bold`}>
                  {formatRm(totals.final)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        <p className="my-2 text-[11px]">
          {t(
            "Write the receipt no. (R1, R2…) on each original receipt and staple them behind this form. I confirm the above claims are true and were incurred for company work.",
          )}
        </p>
        <table className={`${table} break-inside-avoid`}>
          <thead>
            <tr>
              <th className={`${head} w-1/3`}>{t("Claimed by")}</th>
              <th className={`${head} w-1/3`}>
                {t("Checked by (HR & Accounts)")}
              </th>
              <th className={head}>{t("Approved by")}</th>
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
                {t("Name")}: {props.personName}
              </td>
              <td className={cell}>
                {t("Name")}: {props.checked?.name}
              </td>
              <td className={cell}>
                {t("Name")}: {props.approved?.name}
              </td>
            </tr>
            <tr>
              <td className={cell}>{t("Date")}:</td>
              <td className={cell}>
                {t("Date")}: {props.checked && formatDateTime(props.checked.at)}
              </td>
              <td className={cell}>
                {t("Date")}:{" "}
                {props.approved && formatDateTime(props.approved.at)}
              </td>
            </tr>
          </tbody>
        </table>
      </PrintLayout>
    </div>
  );
}

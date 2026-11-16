import type { Profile } from "@/lib/auth/current-profile";
import { JobRoleLabel } from "@/lib/auth/job-role";
import { canClaimCommission } from "@/lib/domain/claim-eligibility";
import {
  CAPPED_EXPENSE_TYPES,
  type ClaimSettings,
  claimCapsOn,
  claimFlags,
  claimPeriod,
  claimTotals,
} from "@/lib/domain/monthly-claim";
import { formatDate, formatMonth, todayMyt } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { loadCommissionSettings } from "../commission/commission-settings-data";
import { loadMofOptions } from "../overtime/overtime-data";
import { ClaimBanner } from "./claim-banner";
import { loadOwnClaimCaps } from "./claim-caps-data";
import { loadCommissionOptions } from "./claim-commission-options";
import { commissionRows } from "./claim-commission-rows";
import { loadLoggedDays } from "./claim-itinerary-data";
import { loadClaimOvertime } from "./claim-ot-data";
import { ClaimPrintButton } from "./claim-print-button";
import { ClaimPrintSheet } from "./claim-print-sheet";
import { loadClaimSignoffs } from "./claim-signoffs-data";
import { ClaimStatusBadge } from "./claim-status-badge";
import { ClaimSubmitBar } from "./claim-submit-bar";
import { CommissionSection } from "./commission-section";
import type { ExpenseRules } from "./expense-dialog";
import { ExpenseSection } from "./expense-section";
import { loadMyClaim } from "./my-claim-data";
import { OvertimeSection } from "./overtime-section";

/** The person's own claim for a month: sections A to C, where it stands, and Submit while it is still theirs. */
export async function MyClaim({
  me,
  month,
  settings,
  t,
}: {
  me: Profile;
  month: string;
  settings: ClaimSettings;
  t: Translate;
}) {
  const today = todayMyt();
  const period = claimPeriod(month, settings.cutOffDay);
  const claimsCommission = canClaimCommission(me);
  const mine = await loadMyClaim(me.id, month);
  const { head } = mine;
  const status = head?.status ?? "draft";
  const editable = status === "draft" || status === "returned";

  const [caps, loggedDays, options, commissionRules, overtime, mofs, signoffs] =
    await Promise.all([
      loadOwnClaimCaps(me),
      loadLoggedDays(me.id, period),
      claimsCommission ? loadCommissionOptions(me.id) : null,
      claimsCommission ? loadCommissionSettings() : null,
      loadClaimOvertime(me.id, period, head?.id ?? null),
      editable ? loadMofOptions() : [],
      head ? loadClaimSignoffs(head.id) : null,
    ]);

  const rows = options
    ? commissionRows(
        mine.commissions,
        options.claimable,
        options.byMof,
        editable,
      )
    : [];
  const flags = claimFlags({
    month,
    expenses: mine.expenses.map((line) => ({
      id: line.id,
      spentOn: line.spentOn,
      expenseType: line.expenseType,
      amount: line.amount,
      km: line.km,
      nights: line.nights,
    })),
    loggedDays,
    settings,
    basis: caps.basis,
  });
  const { monthlyCap } = claimCapsOn(caps.basis, period.to);
  const rules: ExpenseRules = {
    today,
    cutOffDay: settings.cutOffDay,
    mileageRatePerKm: settings.mileageRatePerKm,
    meals: caps.meals,
    hotelBudget: claimCapsOn(caps.basis, today).hotelBudget,
  };

  const otOriginal = head?.otOriginalAmount ?? overtime.amount ?? 0;
  const otFinal = head?.otAmount ?? overtime.amount ?? 0;
  const totals = claimTotals({
    commissions: rows.filter((row) => row.ticked),
    expenses: mine.expenses,
    ot: { originalAmount: otOriginal, amount: otFinal },
  });
  const adjusted =
    rows.some((row) => row.originalAmount !== row.amount) ||
    mine.expenses.some((line) => line.originalAmount !== line.amount) ||
    otOriginal !== otFinal;
  const receiptCount = mine.expenses.filter((line) => line.hasReceipt).length;
  const monthLabel = formatMonth(month);
  const showOvertime = editable || overtime.entries.length > 0;
  let section = 0;
  const heading = (title: string) => `${++section} · ${title}`;

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        <ClaimBanner tone="info">
          <b>
            {monthLabel} {t("claim")}
          </b>{" "}
          · {t("expenses")} {formatDate(period.from)} – {formatDate(period.to)}
          {head && head.status !== "draft" && (
            <>
              {" "}
              · <ClaimStatusBadge status={head.status} t={t} />
              {head.status !== "paid" && head.status !== "returned" && (
                <> {t("can't be changed now")}</>
              )}
            </>
          )}
          {head?.status === "returned" && head.returnReason && (
            <p className="mt-1">
              {t("Returned")}: <i>{head.returnReason}</i> –{" "}
              {t("fix and submit again.")}
            </p>
          )}
          {head?.remark && (
            <p className="mt-1">
              <b>{t("HR & Accounts")}:</b> {head.remark}
            </p>
          )}
          {adjusted && (
            <p className="mt-1">
              {t(
                "Some amounts were adjusted by HR & Accounts. See the lines below.",
              )}
            </p>
          )}
        </ClaimBanner>

        {claimsCommission && commissionRules && (
          <CommissionSection
            rows={rows}
            month={month}
            editable={editable}
            personId={me.id}
            rules={commissionRules}
            heading={heading(t("Commission"))}
            t={t}
          />
        )}
        <ExpenseSection
          expenses={mine.expenses}
          flags={flags.byExpense}
          monthlyFlag={flags.monthly}
          cap={
            monthlyCap === null
              ? null
              : {
                  used: sumRm(
                    mine.expenses
                      .filter((line) =>
                        CAPPED_EXPENSE_TYPES.includes(line.expenseType),
                      )
                      .map((line) => line.amount),
                  ),
                  max: monthlyCap,
                }
          }
          editable={editable}
          rules={rules}
          heading={heading(`${t("Travelling expense")} · ${monthLabel}`)}
          t={t}
        />
        {showOvertime && (
          <OvertimeSection
            overtime={overtime}
            amount={otFinal}
            editable={editable}
            mofs={mofs}
            today={today}
            heading={heading(
              `${t("Overtime / replacement leave")} · ${monthLabel}`,
            )}
            t={t}
          />
        )}

        <p className="text-right text-sm font-semibold">
          {t("Total claim")}{" "}
          <span className="font-mono tabular-nums">
            {formatRm(totals.final)}
          </span>
        </p>
        {adjusted && (
          <ClaimBanner tone="warn">
            {t("Original claim")} <b>{formatRm(totals.original)}</b> →{" "}
            {t("final approved amount")} <b>{formatRm(totals.final)}</b> (
            {totals.difference < 0 ? "−" : "+"}
            {formatRm(Math.abs(totals.difference))})
          </ClaimBanner>
        )}

        {editable ? (
          <ClaimSubmitBar
            month={month}
            monthLabel={monthLabel}
            initialNote={head?.note ?? ""}
            cutOffLabel={formatDate(period.to)}
          />
        ) : (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {head?.note && (
              <p>
                {t("Your note to HR & Accounts")}: {head.note}
              </p>
            )}
            {receiptCount > 0 && (
              <p>
                {head?.originalReceiptsReceived
                  ? t("HR & Accounts has your original receipts.")
                  : t(
                      "Write R1, R2... on each original receipt, staple them behind the claim form and hand them to HR & Accounts.",
                    )}
              </p>
            )}
          </div>
        )}
        {head && (
          <div className="flex">
            <ClaimPrintButton
              label={editable ? t("Print draft") : t("Print claim form")}
            />
          </div>
        )}
      </div>
      {head && signoffs && (
        <ClaimPrintSheet
          personName={me.fullName ?? "Unnamed"}
          position={t(JobRoleLabel[me.jobRole])}
          monthLabel={monthLabel}
          submittedAt={signoffs.submittedAt}
          commissions={mine.commissions}
          expenses={mine.expenses}
          overtime={overtime.entries}
          otAmount={head.otAmount}
          totals={totals}
          note={head.note}
          remark={head.remark}
          checked={signoffs.checked}
          approved={signoffs.approved}
          t={t}
        />
      )}
    </>
  );
}

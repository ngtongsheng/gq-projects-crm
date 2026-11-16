import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { canDecideOvertime } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import {
  canAdjustClaim,
  canManageClaims,
  payReportBlock,
  stepsFor,
} from "@/lib/domain/claim-flow";
import { CAPPED_EXPENSE_TYPES, claimTotals } from "@/lib/domain/monthly-claim";
import { reportKindFor } from "@/lib/domain/report-stats";
import { formatDate, formatMonth, todayMyt } from "@/lib/format/date";
import { sumRm } from "@/lib/format/money";
import { getT } from "@/lib/i18n/server-t";
import { loadCommissionSettings } from "../../commission/commission-settings-data";
import { AdjustedNote } from "../adjusted-note";
import { ClaimBanner } from "../claim-banner";
import { commissionRows } from "../claim-commission-rows";
import { loadClaimReview } from "../claim-review-data";
import { ClaimReviewFooter } from "../claim-review-footer";
import {
  ClaimAmountInput,
  ClaimReviewProvider,
  reviewKey,
} from "../claim-review-state";
import { ClaimStatusBadge } from "../claim-status-badge";
import { WaiveLateCutButton } from "../claim-waive-button";
import { CommissionSection } from "../commission-section";
import { ExpenseSection } from "../expense-section";
import { OvertimeSection } from "../overtime-section";

export const metadata: Metadata = { title: "Claim" };

const ALL_CLAIMS = "/claims?view=all";

export default async function ClaimReviewPage({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  const me = await requirePage("claims");
  if (!canManageClaims(me.jobRole)) redirect("/claims");
  const id = z.uuid().safeParse((await params).claimId);
  if (!id.success) notFound();
  const review = await loadClaimReview(id.data);
  if (!review) notFound();

  const t = await getT(me.language);
  const { head, month, settings, personName } = review;
  const flow = { profileId: review.personId, status: head.status };
  const adjustable = canAdjustClaim(me, flow);
  const steps = stepsFor(me, flow);
  const monthLabel = formatMonth(month);
  const commissionRules = review.commissions.length
    ? await loadCommissionSettings()
    : null;

  const rows = commissionRows(review.commissions, [], new Map(), false);
  const otStored = head.otAmount ?? 0;
  const otOriginal = head.otOriginalAmount ?? otStored;
  const totals = claimTotals({
    commissions: rows,
    expenses: review.expenses,
    ot: { originalAmount: otOriginal, amount: otStored },
  });
  const stored: Record<string, number> = {
    ...Object.fromEntries(
      rows.map((row) => [reviewKey("commission", row.mofId), row.amount]),
    ),
    ...Object.fromEntries(
      review.expenses.map((line) => [
        reviewKey("expense", line.id),
        line.amount,
      ]),
    ),
    ...(head.otAmount !== null
      ? { [reviewKey("ot", head.id)]: head.otAmount }
      : {}),
  };
  const receiptCount = review.expenses.filter((line) => line.hasReceipt).length;
  const pendingOt = review.overtime.hours.pending;
  const filer = reportKindFor(review.jobRole);
  const payBlock =
    head.status === "approved"
      ? payReportBlock({
          claimMonth: month,
          reportKind: filer,
          claimMonthReport: review.claimMonthReport,
        })
      : null;
  const lastMonthDone =
    review.lastMonthReport !== null && review.lastMonthReport !== "draft";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${personName} · ${monthLabel} ${t("claim")}`}
        actions={
          <Button asChild variant="outline">
            <Link href={ALL_CLAIMS}>
              <ArrowLeft data-icon="inline-start" />
              {t("All claims")}
            </Link>
          </Button>
        }
      />
      <ClaimBanner tone="info">
        {review.submittedAt && (
          <>
            {t("Submitted")}{" "}
            {formatDate(todayMyt(new Date(review.submittedAt)))} ·{" "}
          </>
        )}
        <ClaimStatusBadge status={head.status} t={t} />
        {review.filesReport && (
          <>
            {" "}
            · {t("Last month's monthly report")}{" "}
            {lastMonthDone ? (
              t("submitted")
            ) : (
              <b className="text-bad">{t("not submitted")}</b>
            )}
          </>
        )}
        {adjustable && (
          <>
            {" "}
            ·{" "}
            {t(
              "Change any amount if it needs adjusting, give the reason, then Save.",
            )}
          </>
        )}
        {head.status === "returned" && head.returnReason && (
          <p className="mt-1">
            {t("Returned")}: <i>{head.returnReason}</i>
          </p>
        )}
        {head.note && (
          <p className="mt-1">
            <b>
              {t("Note from")} {personName}:
            </b>{" "}
            {head.note}
          </p>
        )}
      </ClaimBanner>
      {review.flags.count > 0 && (
        <ClaimBanner tone="warn">
          <b>
            {review.flags.count}{" "}
            {review.flags.count > 1 ? t("items") : t("item")} {t("to check")}
          </b>{" "}
          –{" "}
          {t(
            "nothing logged that day or over the standard. If justified, approve and write the reason in the remark.",
          )}
        </ClaimBanner>
      )}
      <ClaimReviewProvider
        key={`${Object.values(stored).join("|")}|${head.remark}|${head.originalReceiptsReceived}`}
        stored={stored}
        remark={head.remark}
        originalReceiptsReceived={head.originalReceiptsReceived}
      >
        {commissionRules && rows.length > 0 && (
          <CommissionSection
            rows={rows}
            month={month}
            editable={false}
            personId={review.personId}
            rules={commissionRules}
            heading={`1 · ${t("Commission")}`}
            amountCell={
              adjustable
                ? (row) => (
                    <div className="flex flex-col items-end gap-1">
                      <ClaimAmountInput
                        kind="commission"
                        id={row.mofId}
                        label={`${t("Amount")} ${row.mofNo}`}
                      />
                      <AdjustedNote
                        originalAmount={row.originalAmount}
                        amount={row.amount}
                        reason={row.adjustmentReason}
                        t={t}
                      />
                      {row.lateCut > 0 &&
                        review.approvedAppealMofIds.has(row.mofId) && (
                          <WaiveLateCutButton
                            claimId={head.id}
                            mofId={row.mofId}
                          />
                        )}
                    </div>
                  )
                : undefined
            }
            t={t}
          />
        )}
        <ExpenseSection
          expenses={review.expenses}
          flags={review.flags.byExpense}
          monthlyFlag={review.flags.monthly}
          cap={
            review.flags.monthlyCap === null
              ? null
              : {
                  used: sumRm(
                    review.expenses
                      .filter((line) =>
                        CAPPED_EXPENSE_TYPES.includes(line.expenseType),
                      )
                      .map((line) => line.amount),
                  ),
                  max: review.flags.monthlyCap,
                }
          }
          editable={false}
          rules={{
            today: todayMyt(),
            cutOffDay: settings.cutOffDay,
            mileageRatePerKm: settings.mileageRatePerKm,
            meals: null,
            hotelBudget: null,
          }}
          heading={`${rows.length > 0 ? "2 · " : ""}${t("Travelling expense")} · ${monthLabel}`}
          amountCell={
            adjustable
              ? (line) => (
                  <ClaimAmountInput
                    kind="expense"
                    id={line.id}
                    label={`${t("Amount")} ${formatDate(line.spentOn)}`}
                  />
                )
              : undefined
          }
          t={t}
        />
        {(review.overtime.entries.length > 0 || head.otAmount !== null) && (
          <OvertimeSection
            overtime={review.overtime}
            amount={otStored}
            editable={false}
            canDecide={
              canDecideOvertime(me.jobRole) && review.personId !== me.id
            }
            mofs={[]}
            today={todayMyt()}
            heading={`${rows.length > 0 ? "3" : "2"} · ${t("Overtime / replacement leave")} · ${monthLabel}`}
            t={t}
          />
        )}
        {pendingOt > 0 && (
          <p className="text-sm text-warn">
            {pendingOt} {t("hrs of OT still waiting.")}
            {canDecideOvertime(me.jobRole) && review.personId !== me.id
              ? ` ${t("Approve or reject each entry above.")}`
              : ""}
          </p>
        )}
        <ClaimReviewFooter
          claimId={head.id}
          personName={personName}
          adjustable={adjustable}
          steps={steps}
          originalTotal={totals.original}
          existingRemark={head.remark}
          receiptCount={receiptCount}
          ot={
            head.otAmount !== null
              ? {
                  hours: review.overtime.hours.ot,
                  estimate: review.overtime.amount,
                }
              : null
          }
          payBlock={payBlock}
          backHref={ALL_CLAIMS}
        />
      </ClaimReviewProvider>
    </div>
  );
}

import { FileText } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import type { Profile } from "@/lib/auth/current-profile";
import { JobRoleLabel } from "@/lib/auth/job-role";
import { canFileClaim } from "@/lib/domain/claim-eligibility";
import { claimCapsOn, claimPeriod } from "@/lib/domain/monthly-claim";
import { formatDate, formatMonth, todayMyt } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { ClaimBanner } from "./claim-banner";
import { loadOwnClaimCaps } from "./claim-caps-data";
import { travelClaimMonthLabel, travelClaimMonths } from "./claim-month";
import { loadMonthReportStatus, loadTravelClaim } from "./travel-claim-data";
import { TravelClaimForm } from "./travel-claim-form";
import { travelClaimTotal } from "./travel-claim-input";
import { TravelClaimMonthSelect } from "./travel-claim-month-select";
import { TravelClaimPrint } from "./travel-claim-print";
import {
  REPORT_STATUS_TEXT,
  reportIsIn,
  travelClaimPill,
} from "./travel-claim-status";

/** The person's travel claim for one claim month: month picker, where it stands, the form and the print sheet. */
export async function MyTravelClaim({
  me,
  cutOffDay,
  requestedMonth,
  hrefFor,
  t,
}: {
  me: Profile;
  cutOffDay: number;
  /** The claim month asked for in the link (first of the month), or null. */
  requestedMonth: string | null;
  /** The link to a claim month (YYYY-MM), so the manager's tab keeps its place. */
  hrefFor: (month: string) => string;
  t: Translate;
}) {
  if (!canFileClaim(me)) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={FileText}
          title={t("Your role does not file a travel claim.")}
        />
      </div>
    );
  }

  const months = travelClaimMonths(todayMyt(), cutOffDay);
  const month =
    requestedMonth && months.includes(requestedMonth)
      ? requestedMonth
      : months[0];
  const period = claimPeriod(month, cutOffDay);
  const [claim, caps, report] = await Promise.all([
    loadTravelClaim(me.id, month),
    loadOwnClaimCaps(me),
    loadMonthReportStatus(me, month),
  ]);
  const { monthlyCap, hotelBudget } = claimCapsOn(caps.basis, period.to);
  const pill = travelClaimPill(claim, report);
  const total = claim ? travelClaimTotal(claim) : 0;
  const reportText = report
    ? REPORT_STATUS_TEXT[report]
    : REPORT_STATUS_TEXT.draft;

  return (
    <>
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-base font-semibold">
            {t("Claim month")}
          </h2>
          <TravelClaimMonthSelect
            value={month}
            months={months.map((option) => ({
              month: option,
              label: travelClaimMonthLabel(option, cutOffDay),
              href: hrefFor(option.slice(0, 7)),
            }))}
          />
          <span className="ml-auto">
            <StatusBadge tone={pill.tone}>
              {t(pill.label)}
              {pill.date && ` ${formatDate(pill.date)}`}
            </StatusBadge>
          </span>
        </div>

        <TravelClaimForm
          key={month}
          month={month}
          claim={claim}
          claimsOvertime={me.jobRole === "site"}
          hints={{ monthlyCap, meals: caps.meals, hotelBudget }}
        >
          {claim &&
          claim.finalAmount !== null &&
          claim.finalAmount !== total ? (
            <ClaimBanner tone="warn">
              {t("Final amount after Jany's check:")}{" "}
              <b>{formatRm(claim.finalAmount)}</b>
              {claim.finalNote && ` – ${claim.finalNote}`}
            </ClaimBanner>
          ) : (
            claim?.finalNote && (
              <p className="text-sm text-muted-foreground">
                Jany: {claim.finalNote}
              </p>
            )
          )}
          <p className="text-sm text-muted-foreground">
            {t("Monthly report")} {formatMonth(month)}: <b>{t(reportText)}</b>
            {!reportIsIn(report) &&
              ` – ${t("Jany releases the claim only after it is submitted.")}`}
          </p>
        </TravelClaimForm>
      </section>

      {claim && (
        <TravelClaimPrint
          claim={claim}
          personName={me.fullName ?? "Unnamed"}
          position={t(JobRoleLabel[me.jobRole])}
          monthLabel={formatMonth(month)}
          periodLabel={`${formatDate(period.from).slice(0, -5)} – ${formatDate(period.to)}`}
          monthlyCap={monthlyCap}
          t={t}
        />
      )}
    </>
  );
}

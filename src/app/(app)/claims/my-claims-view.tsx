import { FileText } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import type { Profile } from "@/lib/auth/current-profile";
import { canFileClaim } from "@/lib/domain/claim-eligibility";
import { lastMonthOf } from "@/lib/domain/claim-flow";
import { openClaimMonth } from "@/lib/domain/claim-open-month";
import { type ClaimSettings, claimMonthOf } from "@/lib/domain/monthly-claim";
import { formatMonth, todayMyt } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { ClaimTabs } from "./claim-tabs";
import { EarlierClaims } from "./earlier-claims";
import { MyClaim } from "./my-claim";
import { loadMyClaimList } from "./my-claim-data";

/** The person's own claim: the open month, a switch to last month while it is still open, and their earlier claims. */
export async function MyClaimsView({
  me,
  settings,
  requestedMonth,
  hrefFor,
  t,
}: {
  me: Profile;
  settings: ClaimSettings;
  requestedMonth: string | null;
  /** The link to a month, so the manager's tab keeps its place. */
  hrefFor: (month: string) => string;
  t: Translate;
}) {
  if (!canFileClaim(me)) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={FileText}
          title={t("Your role does not file a monthly claim.")}
        />
      </div>
    );
  }

  const today = todayMyt();
  const claims = await loadMyClaimList(me.id);
  const current = claimMonthOf(today, settings.cutOffDay);
  const previous = claims.find((claim) => claim.month === lastMonthOf(current));
  // Claims for months that have not begun do not exist yet.
  const month =
    requestedMonth && requestedMonth <= current
      ? requestedMonth
      : openClaimMonth({
          today,
          cutOffDay: settings.cutOffDay,
          previous: previous
            ? { status: previous.status, lineCount: previous.lineCount }
            : null,
        });

  const switcher = [lastMonthOf(current), current].filter(
    (candidate) =>
      candidate === month ||
      candidate === current ||
      claims.some((claim) => claim.month === candidate),
  );
  const tabs = [...new Set([...switcher, month])].sort();

  return (
    <>
      {tabs.length > 1 && (
        <ClaimTabs
          label={t("Claim month")}
          active={month}
          tabs={tabs.map((tab) => ({
            id: tab,
            label: `${formatMonth(tab)} ${t("claim")}`,
            href: hrefFor(tab.slice(0, 7)),
          }))}
        />
      )}
      <MyClaim me={me} month={month} settings={settings} t={t} />
      <EarlierClaims
        claims={claims.filter((claim) => claim.month !== month)}
        t={t}
      />
    </>
  );
}

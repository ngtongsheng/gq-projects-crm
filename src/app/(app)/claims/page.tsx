import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { pageLabel } from "@/lib/auth/pages";
import { requirePage } from "@/lib/auth/require-page";
import { canFileClaim } from "@/lib/domain/claim-eligibility";
import { lastMonthOf } from "@/lib/domain/claim-flow";
import { openClaimMonth } from "@/lib/domain/claim-open-month";
import { claimMonthOf } from "@/lib/domain/monthly-claim";
import { formatMonth, todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { cn } from "@/lib/utils";
import { loadClaimSettings } from "./claim-settings-data";
import { EarlierClaims } from "./earlier-claims";
import { MyClaim } from "./my-claim";
import { loadMyClaimList } from "./my-claim-data";

export const metadata: Metadata = { title: "Claims" };

const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("claims");
  const t = await getT(me.language);
  const title = t(pageLabel("claims", me));

  if (!canFileClaim(me)) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={title} />
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={FileText}
            title={t("Your role does not file a monthly claim.")}
          />
        </div>
      </div>
    );
  }

  const today = todayMyt();
  const [settings, claims] = await Promise.all([
    loadClaimSettings(),
    loadMyClaimList(me.id),
  ]);
  const current = claimMonthOf(today, settings.cutOffDay);
  const previous = claims.find((claim) => claim.month === lastMonthOf(current));
  const asked = monthParam.safeParse((await searchParams).month);
  const requested = asked.success ? `${asked.data}-01` : null;
  // Claims for months that have not begun do not exist yet.
  const month =
    requested && requested <= current
      ? requested
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
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        description={`${t("One claim a month for commission, travelling expense and overtime. Submit by day")} ${settings.cutOffDay}. ${t("Expenses dated after that go into next month's claim.")}`}
      />
      {tabs.length > 1 && (
        <div
          role="tablist"
          aria-label={t("Claim month")}
          className="flex gap-2"
        >
          {tabs.map((tab) => (
            <Link
              key={tab}
              role="tab"
              aria-selected={tab === month}
              href={`/claims?month=${tab.slice(0, 7)}`}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50",
                tab === month && "border-primary bg-muted",
              )}
            >
              {formatMonth(tab)} {t("claim")}
            </Link>
          ))}
        </div>
      )}
      <MyClaim me={me} month={month} settings={settings} t={t} />
      <EarlierClaims
        claims={claims.filter((claim) => claim.month !== month)}
        t={t}
      />
    </div>
  );
}

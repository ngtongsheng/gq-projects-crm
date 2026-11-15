import { Package, Plus } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/auth/current-profile";
import { canEditSite } from "@/lib/auth/job-role";
import { canOpen } from "@/lib/auth/page-access";
import { stockReturnEntries } from "@/lib/domain/site-stock-returns";
import { formatDate, todayMyt } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { recordHref } from "../today/record-link";
import { loadStockReturnLogs } from "./stock-return-data";
import { SubText } from "./sub-text";

/**
 * Balance stock the site supervisors reported after a job, from their logs (demo: siteReturns).
 * Where the stock went afterwards (supplier, Best Link, transport) is not tracked until
 * Installation & stock arrives.
 */
export async function StockReturnsTab({
  me,
  nameOf,
  t,
}: {
  me: Profile;
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  const [logs, canRecord] = await Promise.all([
    loadStockReturnLogs(),
    // The Log work wizard is the Site Supervisor's own page.
    canEditSite(me.jobRole) ? canOpen(me, "today") : false,
  ]);
  const entries = stockReturnEntries(logs);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-heading text-lg font-semibold">
          {t("Balance stock after completion")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {`${entries.length} ${t("visits in the last 3 months")}`}
        </span>
        {canRecord && (
          <Button asChild size="sm" className="ml-auto">
            <Link href={recordHref(todayMyt(), { activity: "stock_return" })}>
              <Plus data-icon="inline-start" />
              {t("Record balance stock")}
            </Link>
          </Button>
        )}
      </div>
      <DataTable
        rows={entries}
        getRowKey={(entry) => entry.key}
        empty={
          <EmptyState icon={Package} title={t("No balance stock recorded.")} />
        }
        columns={[
          {
            key: "date",
            header: t("Date"),
            className: "whitespace-nowrap",
            cell: (entry) => (
              <span className="font-mono">{formatDate(entry.visitedOn)}</span>
            ),
          },
          {
            key: "site",
            header: t("MOF · Project"),
            cell: (entry) => (
              <>
                {entry.mofId ? (
                  <Link
                    href={`/site-work/${entry.mofId}`}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {entry.mofNo}
                  </Link>
                ) : (
                  <span className="font-semibold">–</span>
                )}
                <SubText>{entry.siteLabel}</SubText>
              </>
            ),
          },
          {
            key: "items",
            header: t("Item"),
            cell: (entry) => entry.items || "–",
          },
          {
            key: "kind",
            header: t("Status"),
            cell: (entry) => (
              <StatusBadge tone={entry.sentBack ? "good" : "warn"}>
                {t(entry.sentBack ? "Sent back" : "To return")}
              </StatusBadge>
            ),
          },
          {
            key: "by",
            header: t("By"),
            className: "max-sm:hidden",
            cell: (entry) => nameOf(entry.supervisorId),
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        {t(
          "After a job, the site supervisor records every leftover item. Purchasing decides whether it goes back to the supplier or GQ keeps it at Best Link. Tracking where it went comes with Installation & stock.",
        )}
      </p>
    </div>
  );
}

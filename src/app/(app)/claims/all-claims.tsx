import { FileText } from "lucide-react";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/auth/current-profile";
import { JobRoleLabel } from "@/lib/auth/job-role";
import { submittedAfterCutOff } from "@/lib/domain/claim-flow";
import { type ClaimSettings, claimPeriod } from "@/lib/domain/monthly-claim";
import {
  type CalendarDate,
  formatDate,
  formatMonth,
  todayMyt,
} from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import {
  type ClaimListRow,
  loadClaimMonths,
  loadClaimsForMonth,
  loadMissingClaimants,
} from "./all-claims-data";
import { ClaimBanner } from "./claim-banner";
import { ClaimStatusBadge } from "./claim-status-badge";
import { ClaimTabs } from "./claim-tabs";

/** The MD's and HR & Accounts' list: one month's submitted claims, what waits for whom, and who has not submitted. */
export async function AllClaims({
  me,
  settings,
  requestedMonth,
  t,
}: {
  me: Profile;
  settings: ClaimSettings;
  requestedMonth: CalendarDate | null;
  t: Translate;
}) {
  const months = await loadClaimMonths(settings);
  const month =
    requestedMonth && months.includes(requestedMonth)
      ? requestedMonth
      : months[0];
  const viewerIsMd = me.jobRole === "md";
  const rows = await loadClaimsForMonth(month, settings, viewerIsMd);
  const currentMonth = months[0];
  const missing =
    month === currentMonth
      ? await loadMissingClaimants(new Set(rows.map((row) => row.personId)))
      : [];
  const toCheck = rows.filter((row) => row.status === "submitted").length;
  const withMd = rows.filter((row) => row.status === "checked").length;
  const cutOff = claimPeriod(month, settings.cutOffDay).to;

  const columns: DataTableColumn<ClaimListRow>[] = [
    {
      key: "name",
      header: t("Name"),
      cell: (row) => (
        <div className="min-w-32">
          <Link
            href={`/claims/${row.id}`}
            className="font-medium hover:underline"
          >
            {row.name}
          </Link>
          <span className="block text-xs text-muted-foreground">
            {t(JobRoleLabel[row.jobRole])}
          </span>
        </div>
      ),
    },
    {
      key: "commission",
      header: t("Commission"),
      numeric: true,
      className: "max-sm:hidden",
      cell: (row) => (row.commission > 0 ? formatRm(row.commission) : "—"),
    },
    {
      key: "travel",
      header: t("Travel expense"),
      numeric: true,
      cell: (row) => (
        <div className="flex flex-col items-end">
          {formatRm(row.expenses)}
          {row.otAmount > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              + {t("OT")} {formatRm(row.otAmount)}
            </span>
          )}
          <span className="text-xs font-normal text-muted-foreground">
            {row.expenseCount} {t("items")}
            {row.receiptCount > 0 && (
              <>
                {" · "}
                {row.originalReceiptsReceived ? (
                  t("receipts in")
                ) : (
                  <b className="text-bad">{t("receipts not in")}</b>
                )}
              </>
            )}
          </span>
        </div>
      ),
    },
    {
      key: "submitted",
      header: t("Submitted"),
      className: "max-sm:hidden",
      cell: (row) =>
        row.submittedAt ? (
          <div className="flex flex-col">
            <span className="font-mono whitespace-nowrap tabular-nums">
              {formatDate(todayMyt(new Date(row.submittedAt)))}
            </span>
            {submittedAfterCutOff(
              month,
              settings.cutOffDay,
              todayMyt(new Date(row.submittedAt)),
            ) && (
              <span className="text-xs text-warn">{t("after cut-off")}</span>
            )}
          </div>
        ) : null,
    },
    {
      key: "status",
      header: t("Status"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-0.5">
          <ClaimStatusBadge status={row.status} t={t} />
          {row.adjusted && (
            <span className="text-xs text-warn">{t("adjusted")}</span>
          )}
          {row.hasRemark && (
            <span className="text-xs text-muted-foreground">
              {t("has a remark")}
            </span>
          )}
          {row.status === "submitted" && row.flagCount > 0 && (
            <span className="text-xs text-warn">
              {row.flagCount} {t("to check")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "open",
      header: "",
      cell: (row) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/claims/${row.id}`}>{t("Open")}</Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ClaimTabs
        label={t("Claim month")}
        active={month}
        tabs={months.slice(0, 6).map((id) => ({
          id,
          label: `${formatMonth(id)} ${t("claim")}`,
          href: `/claims?view=all&month=${id.slice(0, 7)}`,
        }))}
      />
      <p className="text-sm text-muted-foreground">
        {rows.length} {t("submitted")} · {t("commission")}{" "}
        {formatRm(sumRm(rows.map((row) => row.commission)))} · {t("expense")}{" "}
        {formatRm(sumRm(rows.map((row) => row.expenses)))} · {t("cut-off")}{" "}
        {formatDate(cutOff)}
      </p>
      <ClaimBanner tone="info">
        <b>{t("How claims flow:")}</b>{" "}
        {t(
          "HR & Accounts checks (receipts, itinerary, adjust, remark), then HR & Accounts or the MD approves, then HR & Accounts pays.",
        )}{" "}
        {viewerIsMd ? (
          withMd > 0 ? (
            <b>
              {withMd} {t("waiting for your approval.")}
            </b>
          ) : (
            t("Nothing waiting for you.")
          )
        ) : (
          <>
            {toCheck > 0 && (
              <b>
                {toCheck} {t("to check.")}
              </b>
            )}
            {withMd > 0 && (
              <>
                {" "}
                {withMd} {t("with the MD.")}
              </>
            )}
          </>
        )}
      </ClaimBanner>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={FileText}
            title={`${t("No claims submitted for")} ${formatMonth(month)} ${t("yet.")}`}
          />
        }
      />
      {missing.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("Not submitted yet:")} {missing.join(", ")} · {t("cut-off")}{" "}
          {formatDate(cutOff)}
        </p>
      )}
    </div>
  );
}

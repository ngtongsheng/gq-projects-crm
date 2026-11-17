import { Check, FileText } from "lucide-react";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { JobRoleLabel } from "@/lib/auth/job-role";
import { claimPeriod } from "@/lib/domain/monthly-claim";
import {
  type CalendarDate,
  formatDate,
  formatMonth,
  todayMyt,
} from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import {
  loadTravelClaimRows,
  type TravelClaimListRow,
} from "./all-claims-data";
import { travelClaimMonthLabel, travelClaimMonths } from "./claim-month";
import { TravelClaimCheckSheet } from "./travel-claim-check-sheet";
import { travelClaimTotal } from "./travel-claim-input";
import { TravelClaimMonthSelect } from "./travel-claim-month-select";
import { TravelClaimPrint } from "./travel-claim-print";
import { REPORT_STATUS_TEXT, travelClaimPill } from "./travel-claim-status";

const amount = (value: number | null | undefined) =>
  value ? formatRm(value) : "—";

/** What is paid: the final amount Jany set, else what was claimed (demo tcPay). */
const payable = (row: TravelClaimListRow) =>
  row.claim ? (row.claim.finalAmount ?? travelClaimTotal(row.claim)) : null;

/**
 * The MD's and HR & Accounts' list: every person who files a travel claim for one claim month,
 * with a blank row for those who have not started, and the check and release sheet for a
 * submitted claim (opened by `?claim=`).
 */
export async function AllClaims({
  cutOffDay,
  requestedMonth,
  openClaimId,
  t,
}: {
  cutOffDay: number;
  /** The claim month asked for in the link (first of the month), or null. */
  requestedMonth: CalendarDate | null;
  openClaimId: string | null;
  t: Translate;
}) {
  const months = travelClaimMonths(todayMyt(), cutOffDay);
  const month =
    requestedMonth && months.includes(requestedMonth)
      ? requestedMonth
      : months[0];
  const rows = await loadTravelClaimRows(month, cutOffDay);
  const ready = rows.filter(
    (row) => row.claim?.status === "submitted" && row.reportIsIn,
  ).length;
  const listHref = `/claims?view=all&month=${month.slice(0, 7)}`;
  const opened = rows.find(
    (row) => row.claim?.id === openClaimId && row.claim.status !== "draft",
  );
  const period = claimPeriod(month, cutOffDay);

  const columns: DataTableColumn<TravelClaimListRow>[] = [
    {
      key: "name",
      header: t("Name"),
      cell: (row) => (
        <div className="min-w-32">
          <span className="font-medium">{row.name}</span>
          <span className="block text-xs text-muted-foreground">
            {t(JobRoleLabel[row.jobRole])}
          </span>
        </div>
      ),
    },
    {
      key: "petrol",
      header: t("Petrol + toll"),
      numeric: true,
      cell: (row) => amount(row.claim?.petrolParkingToll),
    },
    {
      key: "limit",
      header: t("Limit"),
      numeric: true,
      className: "max-md:hidden",
      cell: (row) =>
        row.monthlyLimit === null ? (
          "—"
        ) : (
          <span
            className={
              (row.claim?.petrolParkingToll ?? 0) > row.monthlyLimit
                ? "font-bold text-bad"
                : undefined
            }
          >
            {formatRm(row.monthlyLimit)}
          </span>
        ),
    },
    {
      key: "outstation",
      header: t("Outstation"),
      numeric: true,
      className: "max-md:hidden",
      cell: (row) => amount(row.claim?.outstation),
    },
    {
      key: "hotel",
      header: t("Hotel"),
      numeric: true,
      className: "max-md:hidden",
      cell: (row) => amount(row.claim?.hotel),
    },
    {
      key: "others",
      header: t("Others"),
      numeric: true,
      className: "max-md:hidden",
      cell: (row) => amount(row.claim?.others),
    },
    {
      key: "total",
      header: t("Total"),
      numeric: true,
      cell: (row) => (
        <span className="font-semibold">{amount(payable(row))}</span>
      ),
    },
    {
      key: "vicky",
      header: t("Vicky ok"),
      className: "max-lg:hidden",
      cell: (row) =>
        row.claim?.verifiedWithVickyOn ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-good">
            <Check aria-hidden className="size-3.5" />
            {formatDate(row.claim.verifiedWithVickyOn)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "report",
      header: t("Report"),
      className: "max-lg:hidden",
      cell: (row) =>
        !row.filesReport ? (
          "—"
        ) : row.report && row.report !== "draft" ? (
          <StatusBadge tone="good">
            {t(REPORT_STATUS_TEXT[row.report])}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">{t("Not yet")}</StatusBadge>
        ),
    },
    {
      key: "claim",
      header: t("Claim"),
      cell: (row) => {
        const pill = travelClaimPill(row.claim, row.reportIsIn);
        return (
          <StatusBadge tone={pill.tone}>
            {t(pill.label)}
            {pill.date && ` ${formatDate(pill.date)}`}
          </StatusBadge>
        );
      },
    },
    {
      key: "open",
      header: "",
      cell: (row) =>
        row.claim && row.claim.status !== "draft" ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`${listHref}&claim=${row.claim.id}`} scroll={false}>
              {t("Open")}
            </Link>
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <TravelClaimMonthSelect
            value={month}
            months={months.map((option) => ({
              month: option,
              label: travelClaimMonthLabel(option, cutOffDay),
              href: `/claims?view=all&month=${option.slice(0, 7)}`,
            }))}
          />
          <span className="ml-auto text-sm text-muted-foreground">
            <b className="text-foreground">{ready}</b> {t("ready to release")}
          </span>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.personId}
          empty={
            <EmptyState
              icon={FileText}
              title={t("Nobody files a travel claim yet.")}
            />
          }
        />
        <p className="text-sm text-muted-foreground">
          {t(
            "Open a submitted claim to check it against the printed form and the receipts.",
          )}
        </p>
      </div>
      {opened?.claim && (
        <>
          <TravelClaimCheckSheet
            key={opened.claim.id}
            row={{ ...opened, claim: opened.claim }}
            monthLabel={formatMonth(month)}
            closeHref={listHref}
          />
          <TravelClaimPrint
            claim={opened.claim}
            personName={opened.name}
            position={t(JobRoleLabel[opened.jobRole])}
            monthLabel={formatMonth(month)}
            periodLabel={`${formatDate(period.from).slice(0, -5)} – ${formatDate(period.to)}`}
            monthlyCap={opened.monthlyLimit}
            t={t}
          />
        </>
      )}
    </>
  );
}

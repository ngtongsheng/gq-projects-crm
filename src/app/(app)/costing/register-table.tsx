import { FileText } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { marginBand } from "@/lib/domain/costing";
import { formatDateTime } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { QUOTE_STATUS_TONE, QuoteStatusLabel } from "./quote-status";
import type { QuoteRegisterRow } from "./quote-view";

const BAND_TONE: Record<"red" | "amber" | "green", StatusTone> = {
  red: "bad",
  amber: "warn",
  green: "good",
};

/** The margin with the demo's colours, or only Low / High for people without the margin flag. */
function MarginCell({ row, t }: { row: QuoteRegisterRow; t: Translate }) {
  if (row.costShown) {
    if (row.lowestMargin === null) return "–";
    const band = marginBand(row.lowestMargin);
    return (
      <StatusBadge tone={band ? BAND_TONE[band] : "neutral"}>
        {(row.lowestMargin * 100).toFixed(1)}%
      </StatusBadge>
    );
  }
  if (row.marginLevel === null) return "–";
  return (
    <StatusBadge tone={row.marginLevel === "low" ? "bad" : "good"}>
      {row.marginLevel === "low" ? t("Low margin") : t("High margin")}
    </StatusBadge>
  );
}

export function RegisterTable({
  rows,
  filtered,
  canStart,
  t,
}: {
  rows: QuoteRegisterRow[];
  /** A search or status filter is on, so an empty list means "no match" rather than "no quotes". */
  filtered: boolean;
  canStart: boolean;
  t: Translate;
}) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      empty={
        <EmptyState
          icon={FileText}
          title={filtered ? t("No costings match") : t("No costings yet")}
          description={
            filtered
              ? t("Try a different search or status, or show everything.")
              : canStart
                ? t("Click New costing and key in a quotation number to start.")
                : t("Costings appear here once salespeople start them.")
          }
        />
      }
      columns={[
        {
          key: "quoteNo",
          header: t("Quotation No."),
          cell: (row) => (
            <Link
              href={`/costing/${row.id}`}
              className="font-mono font-medium hover:underline"
            >
              {row.quoteNo}
            </Link>
          ),
        },
        {
          key: "project",
          header: t("Project"),
          cell: (row) => row.projectName,
        },
        {
          key: "customer",
          header: t("Customer"),
          cell: (row) => row.customerName,
        },
        {
          key: "salesperson",
          header: t("Salesperson"),
          cell: (row) => row.salespersonName,
        },
        {
          key: "revision",
          header: t("Revision"),
          cell: (row) => (
            <div className="flex flex-col">
              <span className="font-mono">
                {row.rev > 0 ? `${row.quoteNo}-R${row.rev}` : row.quoteNo}
              </span>
              {row.revisionCount > 1 && (
                <span className="text-xs text-muted-foreground">
                  {row.revisionCount} {t("versions")}
                </span>
              )}
            </div>
          ),
        },
        {
          key: "options",
          header: t("Options"),
          cell: (row) =>
            row.optionKeys.length > 1 ? row.optionKeys.join(" / ") : "–",
        },
        {
          key: "amount",
          header: t("Quote amount"),
          numeric: true,
          cell: (row) => formatRm(row.amount),
        },
        {
          key: "margin",
          header: t("Margin"),
          cell: (row) => <MarginCell row={row} t={t} />,
        },
        {
          key: "status",
          header: t("Status"),
          cell: (row) => (
            <StatusBadge tone={QUOTE_STATUS_TONE[row.status]}>
              {t(QuoteStatusLabel[row.status])}
            </StatusBadge>
          ),
        },
        {
          key: "updated",
          header: t("Updated"),
          numeric: true,
          cell: (row) => formatDateTime(row.updatedAt),
        },
      ]}
    />
  );
}

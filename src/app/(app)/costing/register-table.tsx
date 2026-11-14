import { FileText } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { marginBand } from "@/lib/domain/costing";
import { formatDateTime } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { QUOTE_STATUS_TONE, QuoteStatusLabel } from "./quote-status";
import type { QuoteRegisterRow } from "./quote-view";

const BAND_TONE: Record<"red" | "amber" | "green", StatusTone> = {
  red: "bad",
  amber: "warn",
  green: "good",
};

/** The margin with the demo's colours, or only Low / High for people without the margin flag. */
function MarginCell({ row }: { row: QuoteRegisterRow }) {
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
      {row.marginLevel === "low" ? "Low margin" : "High margin"}
    </StatusBadge>
  );
}

export function RegisterTable({
  rows,
  filtered,
  canStart,
}: {
  rows: QuoteRegisterRow[];
  /** A search or status filter is on, so an empty list means "no match" rather than "no quotes". */
  filtered: boolean;
  canStart: boolean;
}) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      empty={
        <EmptyState
          icon={FileText}
          title={filtered ? "No costings match" : "No costings yet"}
          description={
            filtered
              ? "Try a different search or status, or show everything."
              : canStart
                ? "Click New costing and key in a quotation number to start."
                : "Costings appear here once salespeople start them."
          }
        />
      }
      columns={[
        {
          key: "quoteNo",
          header: "Quotation No.",
          cell: (row) => (
            <Link
              href={`/costing/${row.id}`}
              className="font-mono font-medium hover:underline"
            >
              {row.quoteNo}
            </Link>
          ),
        },
        { key: "project", header: "Project", cell: (row) => row.projectName },
        {
          key: "customer",
          header: "Customer",
          cell: (row) => row.customerName,
        },
        {
          key: "salesperson",
          header: "Salesperson",
          cell: (row) => row.salespersonName,
        },
        {
          key: "revision",
          header: "Revision",
          cell: (row) => (
            <div className="flex flex-col">
              <span className="font-mono">
                {row.rev > 0 ? `${row.quoteNo}-R${row.rev}` : row.quoteNo}
              </span>
              {row.revisionCount > 1 && (
                <span className="text-xs text-muted-foreground">
                  {row.revisionCount} versions
                </span>
              )}
            </div>
          ),
        },
        {
          key: "options",
          header: "Options",
          cell: (row) =>
            row.optionKeys.length > 1 ? row.optionKeys.join(" / ") : "–",
        },
        {
          key: "amount",
          header: "Quote amount",
          numeric: true,
          cell: (row) => formatRm(row.amount),
        },
        {
          key: "margin",
          header: "Margin",
          cell: (row) => <MarginCell row={row} />,
        },
        {
          key: "status",
          header: "Status",
          cell: (row) => (
            <StatusBadge tone={QUOTE_STATUS_TONE[row.status]}>
              {QuoteStatusLabel[row.status]}
            </StatusBadge>
          ),
        },
        {
          key: "updated",
          header: "Updated",
          numeric: true,
          cell: (row) => formatDateTime(row.updatedAt),
        },
      ]}
    />
  );
}

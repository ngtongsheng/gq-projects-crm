import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { formatQuantity } from "@/lib/format/quantity";
import type { Translate } from "@/lib/i18n/translate";
import { EnquiryDialog, type SalespersonChoice } from "./enquiry-dialog";
import { sizesTotal } from "./enquiry-sizes";
import { EnquiryUnitLabel, type EnquiryView } from "./enquiry-view";

type EnquiryTableProps = {
  enquiries: EnquiryView[];
  /** The global table shows which quotation and salesperson each row is for. */
  showQuote: boolean;
  /** Whether the viewer may change a row (their own, or any for the enquiry desk). */
  canEdit: boolean;
  canReply: boolean;
  today: string;
  salespeople: SalespersonChoice[];
  emptyTitle: string;
  emptyDescription: string;
  t: Translate;
};

export function EnquiryTable({
  enquiries,
  showQuote,
  canEdit,
  canReply,
  today,
  salespeople,
  emptyTitle,
  emptyDescription,
  t,
}: EnquiryTableProps) {
  const columns: DataTableColumn<EnquiryView>[] = [
    {
      key: "date",
      header: t("Date"),
      numeric: true,
      cell: (row) => formatDate(row.date),
    },
    ...(showQuote
      ? [
          {
            key: "quote",
            header: t("Quotation"),
            cell: (row: EnquiryView) => (
              <div className="flex flex-col gap-0.5">
                <span className="font-mono font-medium">
                  {row.quoteNo || "–"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.salespersonName}
                </span>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "product",
      header: t("Product / spec"),
      cell: (row) => {
        const sizes = sizesTotal(row.sizes);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{row.product}</span>
            {sizes && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatQuantity(sizes.pieces)} {t("pcs")}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "qty",
      header: t("Qty"),
      numeric: true,
      cell: (row) =>
        row.qty === null
          ? "–"
          : `${formatQuantity(row.qty)} ${EnquiryUnitLabel[row.unit]}`,
    },
    {
      key: "supplier",
      header: t("Supplier"),
      cell: (row) => row.supplier || "–",
    },
    {
      key: "fob",
      header: t("FOB"),
      numeric: true,
      cell: (row) =>
        row.fob === null ? "–" : `${row.currency} ${formatQuantity(row.fob)}`,
    },
    {
      key: "fx",
      header: t("Rate"),
      numeric: true,
      cell: (row) => (row.fob === null ? "–" : (row.fx ?? "–")),
    },
    {
      key: "shipping",
      header: t("Shipping"),
      numeric: true,
      cell: (row) => (row.fob === null ? "–" : formatRm(row.shipping ?? 0)),
    },
    {
      key: "landed",
      header: t("Landed cost"),
      numeric: true,
      cell: (row) =>
        row.landed ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-medium">
              {formatRm(row.landed.perUnit)} / {EnquiryUnitLabel[row.unit]}
            </span>
            {row.landed.total !== null && (
              <span className="text-xs text-muted-foreground">
                {t("Total")} {formatRm(row.landed.total)}
              </span>
            )}
          </div>
        ) : (
          "–"
        ),
    },
    { key: "notes", header: t("Notes"), cell: (row) => row.notes || "–" },
    {
      key: "status",
      header: t("Status"),
      cell: (row) =>
        row.status === "replied" ? (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge tone="good">{t("Replied")}</StatusBadge>
            <span className="text-xs text-muted-foreground">
              {row.repliedByName}
              {row.repliedAt && (
                <>
                  {" · "}
                  <span className="font-mono tabular-nums">
                    {formatDateTime(row.repliedAt)}
                  </span>
                </>
              )}
            </span>
          </div>
        ) : (
          <StatusBadge tone="warn">{t("Waiting for FOB")}</StatusBadge>
        ),
    },
    ...(canEdit
      ? [
          {
            key: "edit",
            header: "",
            cell: (row: EnquiryView) => (
              <EnquiryDialog
                enquiry={row}
                today={today}
                canReply={canReply}
                salespeople={salespeople}
                // On a costing the salesperson is the costing's, not a choice.
                salespersonId={
                  showQuote ? undefined : (row.salespersonId ?? "")
                }
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      rows={enquiries}
      getRowKey={(row) => row.id}
      columns={columns}
      empty={<EmptyState title={emptyTitle} description={emptyDescription} />}
    />
  );
}

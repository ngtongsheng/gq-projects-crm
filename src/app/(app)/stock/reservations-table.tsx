import { Boxes } from "lucide-react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import {
  isLive,
  STOCK_UNIT_LABEL,
  supplierMailto,
} from "@/lib/domain/reservation";
import { formatDate } from "@/lib/format/date";
import { formatQuantity } from "@/lib/format/quantity";
import { ReservationActions } from "./reservation-actions";
import { ReservationBadges } from "./reservation-badges";
import { type HeldReservation, reservedOnLabel } from "./reservation-filters";

/** The reservation lines the filter shows, with the hold actions for those who arrange stock. */
export function ReservationsTable({
  rows,
  nameOf,
  holdDays,
  arranges,
  canRequest,
}: {
  rows: HeldReservation[];
  nameOf: ReadonlyMap<string, string>;
  holdDays: number;
  arranges: boolean;
  canRequest: boolean;
}) {
  return (
    <DataTable
      rows={rows}
      getRowKey={({ line }) => line.id}
      empty={
        <EmptyState
          icon={Boxes}
          title="No reservations in this view"
          description={
            canRequest
              ? "Use the button above to hold stock for a project."
              : "Salespeople request a hold on stock for their projects."
          }
        />
      }
      columns={[
        {
          key: "when",
          header: "Reserved",
          numeric: true,
          cell: ({ line }) => reservedOnLabel(line),
        },
        {
          key: "who",
          header: "Salesperson",
          cell: ({ line }) => nameOf.get(line.reservedBy) ?? "Unnamed",
        },
        {
          key: "project",
          header: "Client · project",
          cell: ({ line }) => (
            <div className="flex min-w-40 flex-col">
              <span className="font-medium">{line.companyName}</span>
              <span className="text-xs text-muted-foreground">
                {line.projectName}
                {line.mofNo ? ` · ${line.mofNo}` : ""}
              </span>
            </div>
          ),
        },
        {
          key: "sku",
          header: "SKU",
          cell: ({ line }) => (
            <div className="flex min-w-36 flex-col">
              <span className="font-mono text-sm font-medium">{line.sku}</span>
              <span className="text-xs text-muted-foreground">
                {[line.collection, line.supplier].filter(Boolean).join(" · ")}
              </span>
              {line.note && (
                <span className="text-xs text-muted-foreground">
                  {line.note}
                </span>
              )}
            </div>
          ),
        },
        {
          key: "qty",
          header: "Qty",
          numeric: true,
          cell: ({ line }) =>
            `${formatQuantity(line.qty)} ${STOCK_UNIT_LABEL[line.unit]}`,
        },
        {
          key: "status",
          header: "Status",
          cell: ({ line, hold }) => (
            <ReservationBadges status={line.status} hold={hold} />
          ),
        },
        {
          key: "until",
          header: "Hold until",
          numeric: true,
          cell: ({ line }) =>
            line.expiresOn && isLive(line.status)
              ? formatDate(line.expiresOn)
              : "",
        },
        {
          key: "actions",
          header: "",
          cell: ({ line }) =>
            arranges ? (
              <ReservationActions
                reservationId={line.id}
                status={line.status}
                holdDays={holdDays}
                mailto={supplierMailto(line)}
              />
            ) : null,
        },
      ]}
    />
  );
}

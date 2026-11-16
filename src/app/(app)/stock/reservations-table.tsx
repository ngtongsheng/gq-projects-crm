import { Boxes } from "lucide-react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import {
  isLive,
  STOCK_UNIT_LABEL,
  supplierMailto,
} from "@/lib/domain/reservation";
import {
  pendingNotices,
  SUPPLIER_NOTICE_LABEL,
} from "@/lib/domain/supplier-notice";
import { formatDate, todayMyt } from "@/lib/format/date";
import { formatQuantity } from "@/lib/format/quantity";
import type { Translate } from "@/lib/i18n/translate";
import { ReservationActions } from "./reservation-actions";
import { ReservationBadges } from "./reservation-badges";
import { type HeldReservation, reservedOnLabel } from "./reservation-filters";
import type { Reservation } from "./stock-data";

/** The reservation lines the filter shows, with the hold actions for those who arrange stock. */
export function ReservationsTable({
  t,
  rows,
  nameOf,
  holdDays,
  arranges,
  canRequest,
}: {
  t: Translate;
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
          title={t("No reservations in this view")}
          description={
            canRequest
              ? t("Use the button above to hold stock for a project.")
              : t("Salespeople request a hold on stock for their projects.")
          }
        />
      }
      columns={[
        {
          key: "when",
          header: t("Reserved"),
          numeric: true,
          cell: ({ line }) => (
            <span className="whitespace-normal">{reservedOnLabel(line)}</span>
          ),
        },
        {
          key: "who",
          header: t("Salesperson"),
          cell: ({ line }) => nameOf.get(line.reservedBy) ?? t("Unnamed"),
        },
        {
          key: "project",
          header: t("Client · project"),
          cell: ({ line }) => (
            <div className="flex max-w-52 min-w-40 flex-col whitespace-normal">
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
          header: t("SKU"),
          cell: ({ line }) => (
            <div className="flex max-w-48 min-w-36 flex-col whitespace-normal">
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
          header: t("Qty"),
          numeric: true,
          cell: ({ line }) =>
            `${formatQuantity(line.qty)} ${STOCK_UNIT_LABEL[line.unit]}`,
        },
        {
          key: "status",
          header: t("Status"),
          cell: ({ line, hold }) => (
            <div className="flex flex-col items-start gap-1">
              <ReservationBadges t={t} status={line.status} hold={hold} />
              <SupplierNoticeNote t={t} line={line} />
            </div>
          ),
        },
        {
          key: "until",
          header: t("Hold until"),
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

/** Whether the supplier still has to be emailed about this line, or was told and when. */
function SupplierNoticeNote({ t, line }: { t: Translate; line: Reservation }) {
  if (!line.supplierNotice) return null;
  const label = t(SUPPLIER_NOTICE_LABEL[line.supplierNotice]);
  if (pendingNotices([line]).length > 0) {
    return (
      <span className="text-xs text-warn">
        {t("Email supplier:")} {label}
      </span>
    );
  }
  if (!line.supplierNotifiedAt) return null;
  return (
    <span className="text-xs text-muted-foreground">
      {t("Supplier told")} ({label}){" "}
      {formatDate(todayMyt(new Date(line.supplierNotifiedAt)))}
    </span>
  );
}

import { DataTable } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import {
  BOOKING_PURPOSE_LABEL,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
} from "@/lib/domain/site-booking";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { AnswerButtons } from "./booking-card";
import type { CalendarBooking } from "./booking-data";

type SupervisorBookingTableProps = {
  t: Translate;
  bookings: CalendarBooking[];
  /** Person id to name. */
  nameOf: Record<string, string>;
  meId: string;
  /** The person answers bookings; they still only answer their own. */
  canAnswer: boolean;
};

/** The bookings coming up with their status and the supervisor's reply (demo: the bookings panel in supSchedule). */
export function SupervisorBookingTable({
  t,
  bookings,
  nameOf,
  meId,
  canAnswer,
}: SupervisorBookingTableProps) {
  const name = (id: string) => nameOf[id] ?? t("Unnamed");
  return (
    <DataTable
      rows={bookings}
      getRowKey={(row) => row.id}
      columns={[
        {
          key: "date",
          header: t("Date"),
          cell: (row) => (
            <div className="flex flex-col font-mono tabular-nums">
              <span>{formatDate(row.visitOn)}</span>
              <span className="text-sm text-muted-foreground">
                {row.startTime}
              </span>
            </div>
          ),
        },
        {
          key: "supervisor",
          header: t("Supervisor"),
          cell: (row) => name(row.supervisorId),
        },
        {
          key: "purpose",
          header: t("Purpose · site"),
          cell: (row) => (
            <div className="flex max-w-80 flex-col whitespace-normal">
              <span className="font-medium">
                {t(BOOKING_PURPOSE_LABEL[row.purpose])}
              </span>
              <span className="text-sm text-muted-foreground">
                {[row.siteLabel, row.notes].filter(Boolean).join(" · ")}
              </span>
            </div>
          ),
        },
        {
          key: "by",
          header: t("Booked by"),
          className: "max-sm:hidden",
          cell: (row) => name(row.requestedBy),
        },
        {
          key: "status",
          header: t("Status"),
          cell: (row) => (
            <div className="flex max-w-64 flex-col items-start gap-1 whitespace-normal">
              <StatusBadge tone={BOOKING_STATUS_TONE[row.status]}>
                {t(BOOKING_STATUS_LABEL[row.status])}
              </StatusBadge>
              {row.declineReason && (
                <span className="text-sm text-muted-foreground">
                  {t("Reply:")} {row.declineReason}
                </span>
              )}
              {canAnswer &&
                row.status === "requested" &&
                row.supervisorId === meId && (
                  <AnswerButtons bookingId={row.id} />
                )}
            </div>
          ),
        },
      ]}
    />
  );
}

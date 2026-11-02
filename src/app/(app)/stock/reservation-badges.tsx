import { StatusBadge } from "@/components/app/status-badge";
import {
  type HoldState,
  RESERVATION_STATUS_LABEL,
  RESERVATION_STATUS_TONE,
  type ReservationStatus,
} from "@/lib/domain/reservation";

const holdText = (hold: HoldState) => {
  switch (hold.kind) {
    case "waiting":
      return "Waiting for confirmation";
    case "expiring":
      return hold.daysLeft === 0
        ? "Last day today"
        : `Expiring in ${hold.daysLeft}d`;
    case "expired":
      return `Expired ${hold.daysAgo}d, extend or release`;
  }
};

/** The line's status, plus what to do about its hold when it needs attention. */
export function ReservationBadges({
  status,
  hold,
}: {
  status: ReservationStatus;
  hold: HoldState | null;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <StatusBadge tone={RESERVATION_STATUS_TONE[status]}>
        {RESERVATION_STATUS_LABEL[status]}
      </StatusBadge>
      {hold && (
        <StatusBadge
          tone={
            hold.kind === "expired"
              ? "bad"
              : hold.kind === "expiring"
                ? "warn"
                : "info"
          }
        >
          {holdText(hold)}
        </StatusBadge>
      )}
    </div>
  );
}

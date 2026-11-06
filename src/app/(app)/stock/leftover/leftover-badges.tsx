import { StatusBadge } from "@/components/app/status-badge";
import {
  creditNoteState,
  daysWaiting,
  LEFTOVER_STATUS_LABEL,
  LEFTOVER_STATUS_TONE,
  PICKUP_LATE_AFTER_DAYS,
} from "@/lib/domain/leftover";
import type { Leftover } from "./leftover-data";

/**
 * The item's status, how long it has waited if it is still waiting for pickup (red after a few
 * days), and its supplier credit note once there is one to show.
 */
export function LeftoverBadges({
  leftover,
  today,
}: {
  leftover: Leftover;
  today: string;
}) {
  const creditNote = creditNoteState(leftover);
  const waited =
    leftover.status === "pending_pickup"
      ? daysWaiting(leftover.recordedOn, today)
      : 0;
  const late = waited > PICKUP_LATE_AFTER_DAYS;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone={late ? "bad" : LEFTOVER_STATUS_TONE[leftover.status]}>
        {LEFTOVER_STATUS_LABEL[leftover.status]}
        {late ? ` · ${waited} days` : ""}
      </StatusBadge>
      {creditNote?.kind === "received" && (
        <StatusBadge tone="good">{creditNote.label}</StatusBadge>
      )}
      {creditNote?.kind === "pending" && (
        <StatusBadge tone="warn">Credit note pending</StatusBadge>
      )}
    </div>
  );
}

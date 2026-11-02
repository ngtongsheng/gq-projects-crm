import { StatusBadge } from "@/components/app/status-badge";
import {
  creditNoteState,
  LEFTOVER_STATUS_LABEL,
  LEFTOVER_STATUS_TONE,
} from "@/lib/domain/leftover";
import type { Leftover } from "./leftover-data";

/** The item's status, plus its supplier credit note once there is one to show. */
export function LeftoverBadges({ leftover }: { leftover: Leftover }) {
  const creditNote = creditNoteState(leftover);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone={LEFTOVER_STATUS_TONE[leftover.status]}>
        {LEFTOVER_STATUS_LABEL[leftover.status]}
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

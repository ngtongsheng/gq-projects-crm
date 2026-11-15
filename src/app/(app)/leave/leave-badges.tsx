import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import type { LeaveStatus } from "@/lib/domain/leave-balance";
import { LEAVE_STATUS_LABEL } from "@/lib/domain/leave-labels";

const STATUS_TONE: Record<LeaveStatus, StatusTone> = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
  cancelled: "neutral",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <StatusBadge tone={STATUS_TONE[status]}>
      {LEAVE_STATUS_LABEL[status]}
    </StatusBadge>
  );
}

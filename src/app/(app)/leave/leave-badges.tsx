import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import type { LeaveStatus } from "@/lib/domain/leave-balance";
import { LEAVE_STATUS_LABEL } from "@/lib/domain/leave-labels";
import type { Translate } from "@/lib/i18n/translate";

const STATUS_TONE: Record<LeaveStatus, StatusTone> = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
  cancelled: "neutral",
};

export function LeaveStatusBadge({
  status,
  t,
}: {
  status: LeaveStatus;
  t: Translate;
}) {
  return (
    <StatusBadge tone={STATUS_TONE[status]}>
      {t(LEAVE_STATUS_LABEL[status])}
    </StatusBadge>
  );
}

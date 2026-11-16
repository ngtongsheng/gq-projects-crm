import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import type { ClaimStatus } from "@/lib/domain/claim-flow";
import type { Translate } from "@/lib/i18n/translate";

const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  checked: { label: "Checked", tone: "warn" },
  returned: { label: "Returned", tone: "bad" },
  approved: { label: "Approved", tone: "good" },
  paid: { label: "Paid", tone: "good" },
};

export function ClaimStatusBadge({
  status,
  t,
}: {
  status: ClaimStatus;
  t: Translate;
}) {
  const { label, tone } = CLAIM_STATUS[status];
  return <StatusBadge tone={tone}>{t(label)}</StatusBadge>;
}

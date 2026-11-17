import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import type { Translate } from "@/lib/i18n/translate";
import {
  CUSTOM_SAMPLE_STATUS_LABEL,
  type CustomSampleStatus,
} from "./custom-sample-status";

const TONE: Record<CustomSampleStatus, StatusTone> = {
  given: "neutral",
  "to-confirm": "warn",
  "on-loan": "info",
  available: "good",
};

/** The status pill; a sample past its due date reads "Overdue 2d" in red instead of "On loan". */
export function CustomSampleStatusBadge({
  status,
  overdueDays,
  t,
}: {
  status: CustomSampleStatus;
  overdueDays: number;
  t: Translate;
}) {
  if (overdueDays > 0) {
    return (
      <StatusBadge tone="bad">{`${t("Overdue")} ${overdueDays}d`}</StatusBadge>
    );
  }
  return (
    <StatusBadge tone={TONE[status]}>
      {t(CUSTOM_SAMPLE_STATUS_LABEL[status])}
    </StatusBadge>
  );
}

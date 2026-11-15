import {
  canConfirmOriginalSlip,
  canUploadSlip,
  type LeaveViewer,
  needsSlip,
} from "@/lib/domain/leave-approval";
import type { Translate } from "@/lib/i18n/translate";
import {
  OriginalSlipCheck,
  UploadSlipButton,
  ViewSlipButton,
} from "./leave-slip-controls";
import type { LeaveRow } from "./leave-view";

/** Under an MC or hospitalisation reason: the slip, or the way to add it, and the "original given to HR" tick. */
export function LeaveSlipCell({
  row,
  viewer,
  t,
}: {
  t: Translate;
  row: LeaveRow;
  viewer: LeaveViewer;
}) {
  if (!needsSlip(row.leaveType)) return null;
  return (
    <div className="mt-1 flex flex-col items-start gap-1">
      {row.hasSlip ? (
        <ViewSlipButton leaveId={row.id} />
      ) : (
        <>
          <span className="text-xs font-medium text-bad">
            {t("MC not uploaded")}
          </span>
          {canUploadSlip(row, viewer) && <UploadSlipButton leaveId={row.id} />}
        </>
      )}
      {canConfirmOriginalSlip(row, viewer) ? (
        <OriginalSlipCheck leaveId={row.id} given={row.originalGivenToHr} />
      ) : (
        row.originalGivenToHr && (
          <span className="text-xs text-muted-foreground">
            {t("Original given to HR")}
          </span>
        )
      )}
    </div>
  );
}

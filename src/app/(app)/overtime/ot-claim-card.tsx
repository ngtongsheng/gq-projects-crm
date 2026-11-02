import { StatusBadge } from "@/components/app/status-badge";
import {
  OT_CLAIM_TYPE_LABEL,
  OT_STATUS_LABEL,
  OT_STATUS_TONE,
} from "@/lib/domain/ot-claim";
import { formatDate } from "@/lib/format/date";
import { DecisionButtons } from "./decision-buttons";
import type { OtClaim } from "./overtime-data";

type OtClaimCardProps = {
  claim: OtClaim;
  /** Shown on the team list, where claims belong to different people. */
  personName?: string;
  /** The viewer may approve or reject this pending claim. */
  canDecide?: boolean;
  decidedByName?: string;
};

/** One overtime claim, laid out to read on a phone. */
export function OtClaimCard({
  claim,
  personName,
  canDecide = false,
  decidedByName,
}: OtClaimCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-heading font-semibold">
            {personName ? `${personName} · ` : ""}
            <span className="font-mono tabular-nums">
              {formatDate(claim.workDate)}
            </span>
          </span>
          <span className="font-mono text-sm tabular-nums">
            {claim.fromTime} to {claim.toTime} · {claim.hours} hrs
          </span>
        </div>
        <StatusBadge tone={OT_STATUS_TONE[claim.status]}>
          {claim.status === "approved" && claim.approvedAs
            ? `Approved · ${OT_CLAIM_TYPE_LABEL[claim.approvedAs]}`
            : OT_STATUS_LABEL[claim.status]}
        </StatusBadge>
      </div>
      <span className="text-sm text-muted-foreground">
        <span className="font-mono">{claim.mofNo}</span> · {claim.projectName}
      </span>
      <span className="text-sm">{claim.reason}</span>
      <span className="text-xs text-muted-foreground">
        Asked for {OT_CLAIM_TYPE_LABEL[claim.claimAs]}
        {claim.status !== "pending" &&
          decidedByName &&
          ` · decided by ${decidedByName}`}
      </span>
      {canDecide && claim.status === "pending" && (
        <DecisionButtons claimId={claim.id} />
      )}
    </div>
  );
}

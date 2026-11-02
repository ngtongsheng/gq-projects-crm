import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INSTALLER_CLAIM_TYPE_LABEL } from "@/lib/domain/installer-claim";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { VerifyButton } from "../mofs/[id]/installer-claims";
import type { PendingClaim } from "./site-work-data";

/**
 * Installer claims waiting for the supervisor to confirm the work is done. Supervisors cannot
 * open the MOF register, so this is where they verify.
 */
export function PendingClaims({ claims }: { claims: PendingClaim[] }) {
  if (claims.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">
          Installer claims to verify
        </CardTitle>
        <span className="text-sm text-muted-foreground">
          Check the work on site, then verify. Accounts pays only verified
          claims.
        </span>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {claims.map((claim) => (
          <div
            key={claim.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">
                {claim.installer} ·{" "}
                {INSTALLER_CLAIM_TYPE_LABEL[claim.claimType]}{" "}
                <span className="font-mono tabular-nums">
                  {formatRm(claim.amount)}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                <Link
                  href={`/site-work/${claim.mofId}`}
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {claim.mofNo}
                </Link>{" "}
                · {claim.projectName} · PO{" "}
                <span className="font-mono">{claim.poNo}</span>
                {claim.claimNo ? ` · claim ${claim.claimNo}` : ""} · claimed{" "}
                {formatDate(claim.claimedOn)}
              </span>
            </div>
            <VerifyButton mofId={claim.mofId} claimId={claim.id} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

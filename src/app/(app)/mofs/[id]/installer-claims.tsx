"use client";

import { BadgeCheck } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  claimState,
  INSTALLER_CLAIM_STATE_LABEL,
  INSTALLER_CLAIM_STATE_TONE,
  INSTALLER_CLAIM_TYPE_LABEL,
  type InstallerClaimType,
  summariseInstallerPo,
} from "@/lib/domain/installer-claim";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { verifyInstallerClaim } from "../installer-actions";
import {
  InstallerClaimDialog,
  InstallerPaymentDialog,
  InstallerPoDialog,
} from "./installer-forms";

export type InstallerClaimRow = {
  id: string;
  type: InstallerClaimType;
  claimNo: string;
  amount: number;
  claimedOn: string;
  verified: boolean;
  verifiedBy: string;
  paidOn: string | null;
  paidAmount: number;
};

export type InstallerPoRow = {
  id: string;
  poNo: string;
  poDate: string;
  installer: string;
  amount: number;
  scope: string;
  retentionPct: number;
  claims: InstallerClaimRow[];
};

type InstallerClaimsProps = {
  mofId: string;
  pos: InstallerPoRow[];
  /** The installer named on the MOF, offered when adding the first PO. */
  mofInstaller: string;
  /** MD, Purchasing and HR & Accounts keep POs and claim details. */
  canEdit: boolean;
  canVerify: boolean;
  canPay: boolean;
  /** Malaysia date, so defaults match the server. */
  today: string;
};

export function VerifyButton({
  mofId,
  claimId,
}: {
  mofId: string;
  claimId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await verifyInstallerClaim(mofId, claimId);
          if (result.error) toast.error(result.error);
          else toast.success("Claim verified.");
        })
      }
    >
      <BadgeCheck data-icon="inline-start" />
      {pending ? "Verifying..." : "Verify work"}
    </Button>
  );
}

/** The MOF's installer POs, what each is owed, and the claims against them. */
export function InstallerClaims({
  mofId,
  pos,
  mofInstaller,
  canEdit,
  canVerify,
  canPay,
  today,
}: InstallerClaimsProps) {
  const rows = pos.map((po) => ({
    po,
    ...summariseInstallerPo(po, po.claims),
  }));
  const claimRows = pos
    .flatMap((po) => po.claims.map((claim) => ({ po, claim })))
    .sort((a, b) => b.claim.claimedOn.localeCompare(a.claim.claimedOn));

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="font-heading">
            Installer POs and claims
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            Due = claimed - deductions - retention - paid. The site supervisor
            verifies the work; Accounts records the payment.
          </span>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <InstallerPoDialog mofId={mofId} defaultInstaller={mofInstaller} />
            {pos.length > 0 && (
              <InstallerClaimDialog mofId={mofId} pos={pos} today={today} />
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <DataTable
          rows={rows}
          getRowKey={(row) => row.po.id}
          empty={
            <EmptyState
              title="No installer appointed yet"
              description="Add the installer PO once the installer is appointed."
            />
          }
          columns={[
            {
              key: "installer",
              header: "Installer",
              cell: ({ po }) => (
                <div className="flex max-w-72 flex-col whitespace-normal">
                  <span className="font-medium">{po.installer}</span>
                  <span className="text-xs text-muted-foreground">
                    PO <span className="font-mono">{po.poNo}</span> ·{" "}
                    {formatDate(po.poDate)} · retention {po.retentionPct}%
                    {po.scope ? ` · ${po.scope}` : ""}
                  </span>
                </div>
              ),
            },
            {
              key: "po",
              header: "PO amount",
              numeric: true,
              cell: (row) => (
                <div className="flex flex-col items-end">
                  {formatRm(row.po.amount)}
                  <span className="text-xs text-muted-foreground">
                    {formatRm(row.leftToClaim)} left to claim
                  </span>
                </div>
              ),
            },
            {
              key: "claimed",
              header: "Claimed",
              numeric: true,
              cell: (row) => (
                <div className="flex flex-col items-end">
                  {formatRm(row.claimed)}
                  {row.deducted > 0 && (
                    <span className="text-xs text-muted-foreground">
                      - {formatRm(row.deducted)} deducted
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: "paid",
              header: "Paid",
              numeric: true,
              cell: (row) => formatRm(row.paid),
            },
            {
              key: "due",
              header: "Payable now",
              numeric: true,
              cell: (row) => (
                <div className="flex flex-col items-end">
                  <span className="font-medium">{formatRm(row.due)}</span>
                  {row.retention > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formatRm(row.retention)} retention held
                    </span>
                  )}
                  {row.unverifiedCount > 0 && (
                    <span className="text-xs text-warn">
                      {row.unverifiedCount} not verified yet
                    </span>
                  )}
                </div>
              ),
            },
            ...(canEdit
              ? [
                  {
                    key: "edit",
                    header: "",
                    cell: ({ po }: (typeof rows)[number]) => (
                      <InstallerPoDialog
                        mofId={mofId}
                        po={po}
                        defaultInstaller={mofInstaller}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
        {claimRows.length > 0 && (
          <DataTable
            rows={claimRows}
            getRowKey={(row) => row.claim.id}
            columns={[
              {
                key: "date",
                header: "Date",
                numeric: true,
                cell: ({ claim }) => formatDate(claim.claimedOn),
              },
              {
                key: "installer",
                header: "Installer",
                cell: ({ po }) => po.installer,
              },
              {
                key: "type",
                header: "Claim",
                cell: ({ claim }) => (
                  <div className="flex flex-col">
                    {INSTALLER_CLAIM_TYPE_LABEL[claim.type]}
                    {claim.claimNo && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {claim.claimNo}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "amount",
                header: "Amount",
                numeric: true,
                cell: ({ claim }) =>
                  claim.type === "deduction"
                    ? `- ${formatRm(claim.amount)}`
                    : formatRm(claim.amount),
              },
              {
                key: "state",
                header: "Status",
                cell: ({ claim }) => {
                  const state = claimState(claim);
                  return (
                    <div className="flex flex-col gap-0.5">
                      <StatusBadge tone={INSTALLER_CLAIM_STATE_TONE[state]}>
                        {INSTALLER_CLAIM_STATE_LABEL[state]}
                      </StatusBadge>
                      {claim.verified && (
                        <span className="text-xs text-muted-foreground">
                          Verified by {claim.verifiedBy}
                        </span>
                      )}
                      {claim.paidOn && (
                        <span className="text-xs text-muted-foreground">
                          {formatRm(claim.paidAmount)} paid{" "}
                          {formatDate(claim.paidOn)}
                        </span>
                      )}
                    </div>
                  );
                },
              },
              ...(canEdit || canVerify || canPay
                ? [
                    {
                      key: "actions",
                      header: "",
                      cell: ({ po, claim }: (typeof claimRows)[number]) => (
                        <div className="flex flex-wrap justify-end gap-2">
                          {canVerify &&
                            claim.type !== "deduction" &&
                            !claim.verified && (
                              <VerifyButton mofId={mofId} claimId={claim.id} />
                            )}
                          {canPay &&
                            claim.type !== "deduction" &&
                            claim.verified && (
                              <InstallerPaymentDialog
                                mofId={mofId}
                                po={po}
                                claim={claim}
                                today={today}
                              />
                            )}
                          {canEdit && !claim.paidOn && (
                            <InstallerClaimDialog
                              mofId={mofId}
                              pos={pos}
                              po={po}
                              claim={claim}
                              today={today}
                            />
                          )}
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

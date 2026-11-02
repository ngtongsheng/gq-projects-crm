import { z } from "zod";
import { INSTALLER_CLAIM_TYPES } from "@/lib/domain/installer-claim";
import type { createClient } from "@/lib/supabase/server";
import type { InstallerPoRow } from "./installer-claims";

const installerPoRows = z.array(
  z.object({
    id: z.string(),
    po_no: z.string(),
    po_date: z.string(),
    installer: z.string(),
    amount: z.number(),
    scope: z.string().nullable(),
    retention_pct: z.number(),
    installer_claims: z.array(
      z.object({
        id: z.string(),
        claim_type: z.enum(INSTALLER_CLAIM_TYPES),
        claim_no: z.string().nullable(),
        amount: z.number(),
        claimed_on: z.string(),
        verified_by: z.string().nullable(),
        verified_at: z.string().nullable(),
        paid_on: z.string().nullable(),
        paid_amount: z.number().nullable(),
      }),
    ),
  }),
);

/** The MOF's installer POs with their claims. `nameOf` turns a verifier's id into a name. */
export async function loadInstallerPos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mofId: string,
  nameOf: ReadonlyMap<string, string>,
): Promise<InstallerPoRow[]> {
  const { data, error } = await supabase
    .from("installer_pos")
    .select(
      "id, po_no, po_date, installer, amount, scope, retention_pct, installer_claims(id, claim_type, claim_no, amount, claimed_on, verified_by, verified_at, paid_on, paid_amount)",
    )
    .eq("mof_id", mofId)
    .order("po_date");
  if (error) {
    throw new Error(`Could not load installer POs: ${error.message}`);
  }

  return installerPoRows.parse(data).map((po) => ({
    id: po.id,
    poNo: po.po_no,
    poDate: po.po_date,
    installer: po.installer,
    amount: po.amount,
    scope: po.scope ?? "",
    retentionPct: po.retention_pct,
    claims: po.installer_claims
      .map((claim) => ({
        id: claim.id,
        type: claim.claim_type,
        claimNo: claim.claim_no ?? "",
        amount: claim.amount,
        claimedOn: claim.claimed_on,
        verified: claim.verified_by !== null,
        verifiedBy: claim.verified_by
          ? (nameOf.get(claim.verified_by) ?? "Unnamed")
          : "",
        paidOn: claim.paid_on,
        paidAmount: claim.paid_amount ?? 0,
      }))
      .sort((a, b) => b.claimedOn.localeCompare(a.claimedOn)),
  }));
}

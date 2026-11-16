"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { canClaimCommission } from "@/lib/domain/claim-eligibility";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { loadCommissionOptions } from "./claim-commission-options";
import {
  CLAIM_LOCKED,
  isNotAllowed,
  openOwnClaim,
  TRY_AGAIN,
} from "./own-claim";

export type CommissionLineResult = { error: string | null };

const NOT_CLAIMANT = "Your role does not claim commission.";

const request = z.object({
  month: z.iso.date(),
  mofIds: z.array(z.uuid()).min(1).max(200),
});

/**
 * Ticks or unticks commission lines in the person's claim for a month. A line is the person's
 * share of one order that is at 90%+ paid; its amount is worked out by the database (payable
 * now), and the late cut shown with it comes from the commission rules.
 */
export async function setCommissionLines(
  month: string,
  mofIds: string[],
  ticked: boolean,
): Promise<CommissionLineResult> {
  const me = await requirePage("claims");
  if (!canClaimCommission(me)) return { error: NOT_CLAIMANT };
  const parsed = request.safeParse({ month, mofIds });
  if (!parsed.success) return { error: TRY_AGAIN };

  const supabase = await createClient();
  const opened = await openOwnClaim(supabase, me, parsed.data.month);
  if (opened.error !== null) return { error: opened.error };

  if (!ticked) {
    const { error } = await supabase
      .from("monthly_claim_commissions")
      .delete()
      .eq("claim_id", opened.claimId)
      .in("mof_id", parsed.data.mofIds);
    if (error) {
      logServerError("Could not untick commission lines", error, {
        profileId: me.id,
        recordId: opened.claimId,
      });
      return { error: TRY_AGAIN };
    }
    revalidatePath("/claims");
    return { error: null };
  }

  const { claimable } = await loadCommissionOptions(me.id);
  const rows = claimable
    .filter((line) => parsed.data.mofIds.includes(line.mofId))
    .map((line) => ({
      claim_id: opened.claimId,
      mof_id: line.mofId,
      late_cut_amount: line.lateCut,
      late_cut_waived: line.lateCutWaived,
    }));
  if (rows.length === 0) {
    return { error: "That order has nothing payable now. Reload the page." };
  }

  // A line already ticked is left as it is.
  const { error } = await supabase
    .from("monthly_claim_commissions")
    .upsert(rows, { onConflict: "claim_id,mof_id", ignoreDuplicates: true });
  if (error) {
    if (isNotAllowed(error)) return { error: CLAIM_LOCKED };
    logServerError("Could not tick commission lines", error, {
      profileId: me.id,
      recordId: opened.claimId,
    });
    return { error: TRY_AGAIN };
  }
  revalidatePath("/claims");
  return { error: null };
}

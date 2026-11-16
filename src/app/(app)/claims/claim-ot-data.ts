import { z } from "zod";
import { otTotals } from "@/lib/domain/ot-claim";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { loadOtClaims, type OtClaim } from "../overtime/overtime-data";

/** Section C (D3): the person's overtime and replacement leave in the claim period, and what the approved OT is worth. */
export async function loadClaimOvertime(
  personId: string,
  period: { from: CalendarDate; to: CalendarDate },
  claimId: string | null,
): Promise<{
  entries: OtClaim[];
  hours: ReturnType<typeof otTotals>;
  /** In ringgit, worked out by the database from the HR package; null until the claim exists. */
  amount: number | null;
}> {
  const entries = (await loadOtClaims())
    .filter(
      (claim) =>
        claim.profileId === personId &&
        claim.workDate >= period.from &&
        claim.workDate <= period.to,
    )
    .sort((a, b) => a.workDate.localeCompare(b.workDate));

  let amount: number | null = null;
  if (claimId) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("monthly_claim_ot_amount", {
      claim: claimId,
    });
    if (error) {
      throw new Error(`Could not work out your OT amount: ${error.message}`);
    }
    amount = z.coerce.number().nonnegative().parse(data);
  }
  return { entries, hours: otTotals(entries), amount };
}

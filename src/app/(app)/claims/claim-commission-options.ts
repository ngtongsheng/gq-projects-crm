import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { appealKey } from "../commission/appeal-rules";
import {
  type CommissionAppeal,
  latestAppealByLine,
  loadCommissionAppeals,
} from "../commission/appeals-data";
import { loadCommissionLines } from "../commission/commission-data";

/** One of the person's orders as it stands for a claim. */
export type CommissionOption = {
  mofId: string;
  mofNo: string;
  companyName: string;
  projectName: string;
  pctPaid: number;
  /** What the late-collection cut takes off so far; zero once an appeal is approved. */
  lateCut: number;
  lateCutWaived: boolean;
  payableNow: number;
  appeal: CommissionAppeal | undefined;
};

const pendingRows = z.array(z.object({ mof_id: z.uuid() }));

/**
 * The person's own commission lines (demo: commLines of the person). Claimable ones are at 90%+
 * paid with RM 1 or more payable now, and not already waiting in a submitted, checked or
 * approved claim (D2); the database enforces that last rule too. Row-level security limits
 * the pending lines to the person's own claims.
 */
export async function loadCommissionOptions(personId: string) {
  const supabase = await createClient();
  const [lines, appeals, pending] = await Promise.all([
    loadCommissionLines(),
    loadCommissionAppeals(),
    supabase
      .from("monthly_claim_commissions")
      .select("mof_id")
      .eq("profile_id", personId)
      .eq("pending", true),
  ]);
  if (pending.error) {
    throw new Error(
      `Could not load your pending claims: ${pending.error.message}`,
    );
  }
  const waiting = new Set(pendingRows.parse(pending.data).map((r) => r.mof_id));
  const appealByLine = latestAppealByLine(appeals);

  const mine = lines
    .filter((line) => line.personId === personId)
    .map((line): CommissionOption => {
      const appeal = appealByLine.get(appealKey(line.mofId, personId));
      return {
        mofId: line.mofId,
        mofNo: line.mofNo,
        companyName: line.companyName,
        projectName: line.projectName,
        pctPaid: line.pctPaid,
        lateCut: line.commission.lateCut,
        lateCutWaived: appeal?.status === "approved",
        payableNow: line.balance.payableNow,
        appeal,
      };
    });
  return {
    byMof: new Map(mine.map((line) => [line.mofId, line])),
    claimable: mine.filter(
      (line) => line.payableNow >= 1 && !waiting.has(line.mofId),
    ),
  };
}

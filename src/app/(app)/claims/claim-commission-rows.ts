import type { CommissionOption } from "./claim-commission-options";
import type { StoredCommissionLine } from "./my-claim-data";

/** A commission line as section A shows it. */
export type CommissionRow = {
  mofId: string;
  mofNo: string;
  companyName: string;
  projectName: string;
  ticked: boolean;
  lateCut: number;
  originalAmount: number;
  amount: number;
  adjustmentReason: string | null;
  /** Where the order stands now, for the received % and the appeal. */
  option: CommissionOption | undefined;
};

/**
 * Section A: the lines in the claim, plus, while the claim is still the person's, the lines
 * they could tick (D2). Once submitted only what was claimed is shown, as it was claimed.
 */
export function commissionRows(
  stored: readonly StoredCommissionLine[],
  claimable: readonly CommissionOption[],
  byMof: ReadonlyMap<string, CommissionOption>,
  editable: boolean,
): CommissionRow[] {
  const ticked = stored.map(
    (line): CommissionRow => ({
      mofId: line.mofId,
      mofNo: line.mofNo,
      companyName: line.companyName,
      projectName: line.projectName,
      ticked: true,
      lateCut: line.lateCut,
      originalAmount: line.originalAmount,
      amount: line.amount,
      adjustmentReason: line.adjustmentReason,
      option: byMof.get(line.mofId),
    }),
  );
  if (!editable) return ticked;

  const inClaim = new Set(stored.map((line) => line.mofId));
  const offered = claimable
    .filter((line) => !inClaim.has(line.mofId))
    .map(
      (line): CommissionRow => ({
        mofId: line.mofId,
        mofNo: line.mofNo,
        companyName: line.companyName,
        projectName: line.projectName,
        ticked: false,
        lateCut: line.lateCut,
        originalAmount: line.payableNow,
        amount: line.payableNow,
        adjustmentReason: null,
        option: line,
      }),
    );
  return [...ticked, ...offered].sort((a, b) => a.mofNo.localeCompare(b.mofNo));
}

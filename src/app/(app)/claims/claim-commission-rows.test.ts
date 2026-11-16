import { describe, expect, it } from "vitest";
import type { CommissionOption } from "./claim-commission-options";
import { commissionRows } from "./claim-commission-rows";
import type { StoredCommissionLine } from "./my-claim-data";

const MOF_A = "11111111-1111-4111-8111-111111111111";
const MOF_B = "22222222-2222-4222-8222-222222222222";

const stored = (mofId: string, mofNo: string): StoredCommissionLine => ({
  mofId,
  mofNo,
  companyName: "Acme",
  projectName: "Lobby",
  lateCut: 0,
  lateCutWaived: false,
  originalAmount: 500,
  amount: 450,
  adjustmentReason: "Cut by HR",
});

const option = (mofId: string, mofNo: string): CommissionOption => ({
  mofId,
  mofNo,
  companyName: "Acme",
  projectName: "Lobby",
  pctPaid: 95,
  lateCut: 40,
  lateCutWaived: false,
  payableNow: 300,
  appeal: undefined,
});

describe("commissionRows", () => {
  const claimable = [option(MOF_A, "MOF-1"), option(MOF_B, "MOF-2")];
  const byMof = new Map(claimable.map((line) => [line.mofId, line]));

  it("offers the lines not yet in the claim, ticked ones keeping their stored amounts", () => {
    const rows = commissionRows(
      [stored(MOF_A, "MOF-1")],
      claimable,
      byMof,
      true,
    );
    expect(rows.map((row) => [row.mofNo, row.ticked, row.amount])).toEqual([
      ["MOF-1", true, 450],
      ["MOF-2", false, 300],
    ]);
    expect(rows[1]?.lateCut).toBe(40);
  });

  it("shows only what was claimed once the claim is with HR & Accounts", () => {
    const rows = commissionRows(
      [stored(MOF_A, "MOF-1")],
      claimable,
      byMof,
      false,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.adjustmentReason).toBe("Cut by HR");
  });
});

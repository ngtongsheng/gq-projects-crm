import { describe, expect, it } from "vitest";
import { leftoverKey, planLeftoverImport } from "./leftover-import";

const MOF = "33333333-3333-4333-8333-333333333333";

describe("planLeftoverImport", () => {
  it("skips an item already recorded when the pasted quantity has extra decimals", () => {
    // The database keeps 2.135 as 2.14, so the pasted row has to match that.
    const recorded = new Map([
      [
        leftoverKey({
          mofId: MOF,
          item: "Carpet tile",
          qty: 2.14,
          unit: "box",
          condition: "good",
          destination: "supplier",
        }),
        "existing-id",
      ],
    ]);
    const plan = planLeftoverImport(
      "MOF no\tItem\tQty\tUnit\tCondition\tDestination\r\nMOF-100\tCarpet tile\t2.135\tbox\tgood\tsupplier",
      { mofs: new Map([["MOF-100", MOF]]), recorded },
    );
    expect(plan.rows.map((row) => row.action)).toEqual(["skip"]);
  });
});

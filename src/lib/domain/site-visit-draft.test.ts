import { describe, expect, it } from "vitest";
import {
  asksBalanceStock,
  balanceStockAnswer,
  detailsProblem,
  emptyDraft,
  needsMof,
  type VisitDraft,
  visitInput,
} from "./site-visit-draft";

const MOF = "11111111-1111-4111-8111-111111111111";

const draft = (changes: Partial<VisitDraft>): VisitDraft => ({
  ...emptyDraft(),
  mofId: MOF,
  hasProblem: false,
  ...changes,
});

describe("needsMof", () => {
  it("lets a new site be inspected, measured or shot only", () => {
    expect(needsMof("inspection")).toBe(false);
    expect(needsMof("measurement")).toBe(false);
    expect(needsMof("shooting")).toBe(false);
    expect(needsMof("installation")).toBe(true);
    expect(needsMof("stock_return")).toBe(true);
  });
});

describe("asksBalanceStock", () => {
  it("asks after installation, handover, touch up and stock return on a MOF", () => {
    expect(asksBalanceStock(draft({ activities: ["installation"] }))).toBe(
      true,
    );
    expect(asksBalanceStock(draft({ activities: ["touch_up"] }))).toBe(true);
    expect(asksBalanceStock(draft({ activities: ["inspection"] }))).toBe(false);
  });

  it("does not ask on a site with no MOF", () => {
    expect(
      asksBalanceStock(draft({ mofId: null, activities: ["installation"] })),
    ).toBe(false);
  });
});

describe("balanceStockAnswer", () => {
  it("is empty when nothing was asked", () => {
    expect(balanceStockAnswer(draft({ activities: ["delivery"] }))).toBeNull();
  });

  it("records that there is none", () => {
    expect(
      balanceStockAnswer(
        draft({ activities: ["installation"], anyBalanceStock: false }),
      ),
    ).toBe("No balance stock");
  });

  it("lists the items and how they go back, skipping a blank row", () => {
    expect(
      balanceStockAnswer(
        draft({
          activities: ["handover"],
          anyBalanceStock: true,
          returnWay: "installer",
          returnItems: [
            { id: "r1", item: " Grey tile ", qty: "5", unit: "box" },
            { id: "r2", item: "", qty: "", unit: "box" },
          ],
        }),
      ),
    ).toBe("Balance stock: 5 box Grey tile (Installer brings back)");
  });

  it("labels a stock return as one", () => {
    expect(
      balanceStockAnswer(
        draft({
          activities: ["stock_return"],
          returnWay: "supervisor",
          returnItems: [{ id: "r3", item: "Offcut", qty: "2", unit: "roll" }],
        }),
      ),
    ).toBe("Stock return: 2 roll Offcut (I bring it back myself)");
  });
});

describe("detailsProblem", () => {
  it("asks for the installed share when installation is ticked", () => {
    expect(
      detailsProblem(
        draft({ activities: ["installation"], anyBalanceStock: false }),
      ),
    ).toBe("Choose how much of the whole job is installed.");
  });

  it("needs the handover form and the completed photos answered", () => {
    expect(
      detailsProblem(draft({ activities: ["handover"], handoverSigned: true })),
    ).toBe("Say whether the completed photos are posted.");
  });

  it("needs each balance stock item to have a quantity and a way back", () => {
    const listed = draft({
      activities: ["installation"],
      installedPct: 50,
      anyBalanceStock: true,
      returnItems: [{ id: "r4", item: "Tile", qty: "0", unit: "box" }],
      returnWay: null,
    });
    expect(detailsProblem(listed)).toBe(
      "Key in each balance stock item and quantity.",
    );
    expect(
      detailsProblem({
        ...listed,
        returnItems: [{ id: "r5", item: "Tile", qty: "3", unit: "box" }],
      }),
    ).toBe("Choose how the balance stock will go back.");
  });

  it("needs the problem written, owned and dated when there is one", () => {
    const base = draft({ activities: ["inspection"], hasProblem: true });
    expect(detailsProblem(base)).toBe("Choose what kind of problem it is.");
    expect(detailsProblem({ ...base, problemOwner: "purchasing" })).toBe(
      "Write the problem in one line.",
    );
    expect(
      detailsProblem({
        ...base,
        problemOwner: "purchasing",
        problemAction: "3 boxes missing",
      }),
    ).toBe("Choose the follow-up date.");
  });

  it("passes when every question is answered", () => {
    expect(
      detailsProblem(
        draft({
          activities: ["delivery", "measurement"],
          deliveryOk: true,
          measurementSent: false,
        }),
      ),
    ).toBeNull();
  });
});

describe("visitInput", () => {
  it("sends only the answers for the ticked activities", () => {
    const input = visitInput(
      draft({
        activities: ["installation"],
        installedPct: 40,
        measurementSent: true,
        deliveryOk: false,
        anyBalanceStock: false,
        note: "  Level 3 done ",
      }),
      "2026-11-14",
    );
    expect(input).toMatchObject({
      mofId: MOF,
      siteName: null,
      visitedOn: "2026-11-14",
      installedPct: 40,
      measurementSent: null,
      deliveryOk: null,
      note: "Level 3 done",
      returnAnswer: "No balance stock",
      followUp: null,
    });
  });

  it("names a new site and its salesperson instead of a MOF", () => {
    const input = visitInput(
      draft({
        mofId: null,
        siteName: " Menara ABC ",
        salespersonId: "22222222-2222-4222-8222-222222222222",
        projectId: "33333333-3333-4333-8333-333333333333",
        activities: ["measurement"],
        measurementSent: true,
      }),
      "2026-11-14",
    );
    expect(input).toMatchObject({
      mofId: null,
      siteName: "Menara ABC",
      salespersonId: "22222222-2222-4222-8222-222222222222",
      measurementSent: true,
    });
  });

  it("carries the follow-up when there is a problem", () => {
    const input = visitInput(
      draft({
        activities: ["delivery"],
        deliveryOk: false,
        hasProblem: true,
        problemOwner: "purchasing",
        problemAction: " 3 boxes missing ",
        problemDueOn: "2026-11-17",
      }),
      "2026-11-14",
    );
    expect(input.followUp).toEqual({
      action: "3 boxes missing",
      ownerGroup: "purchasing",
      dueOn: "2026-11-17",
    });
  });
});

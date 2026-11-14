import { describe, expect, it } from "vitest";
import {
  type CostingItem,
  itemTotals,
  landedPerM2,
  marginBand,
  optionTotals,
  quoteAmount,
} from "./costing";

describe("landedPerM2", () => {
  it("converts FOB at the rate, adds SST, then adds shipping", () => {
    // 13 USD x 4.5 x 1.10 + 6 = 70.35
    expect(
      landedPerM2({ fob: 13, fx: 4.5, sstPct: 10, shipping: 6 }),
    ).toBeCloseTo(70.35, 10);
  });

  it("counts missing fields as 0", () => {
    expect(landedPerM2({ fob: 10, fx: 2, sstPct: null })).toBe(20);
  });
});

describe("itemTotals: local", () => {
  const local: CostingItem = {
    type: "local",
    supplyOnly: false,
    material: 38,
    wastagePct: 5,
    underlay: 2,
    accessories: 1,
    install: 9,
    qty: 100,
    rate: 80,
  };

  it("adds wastage to material only, then underlay, accessories and install", () => {
    // 38 x 1.05 + 2 + 1 + 9 = 51.9 per unit
    const totals = itemTotals(local);
    expect(totals.unitCost).toBeCloseTo(51.9, 10);
    expect(totals.cost).toBe(5190);
    expect(totals.sell).toBe(8000);
    expect(totals.profit).toBe(2810);
    expect(totals.margin).toBeCloseTo(0.35125, 10);
  });

  it("drops underlay, accessories and install when supply only", () => {
    const totals = itemTotals({ ...local, supplyOnly: true });
    expect(totals.unitCost).toBeCloseTo(39.9, 10);
    expect(totals.cost).toBe(3990);
  });
});

describe("itemTotals: import", () => {
  const imported: CostingItem = {
    type: "import",
    supplyOnly: false,
    unit: "m2",
    fob: 13,
    fx: 4.5,
    sstPct: 10,
    shipping: 6,
    wastagePct: 3,
    underlay: 0,
    install: 14,
    qty: 300,
    rate: 149,
  };

  it("applies wastage to the landed cost, then adds install", () => {
    // 70.35 x 1.03 + 14 = 86.4605 per m2
    const totals = itemTotals(imported);
    expect(totals.unitCost).toBeCloseTo(86.4605, 10);
    expect(totals.cost).toBe(25938.15);
    expect(totals.sell).toBe(44700);
  });

  it("divides the landed cost by 10.764 when quoted per sqft", () => {
    const totals = itemTotals({
      ...imported,
      unit: "sqft",
      install: 0,
      wastagePct: 0,
      qty: 1000,
    });
    // 70.35 / 10.764 = 6.53567...
    expect(totals.unitCost).toBeCloseTo(70.35 / 10.764, 10);
    expect(totals.cost).toBe(6535.67);
  });

  it("drops install and underlay when supply only", () => {
    const totals = itemTotals({
      ...imported,
      supplyOnly: true,
      underlay: 3,
    });
    expect(totals.unitCost).toBeCloseTo(70.35 * 1.03, 10);
  });
});

describe("itemTotals: rug", () => {
  const rug: CostingItem = {
    type: "rug",
    supplyOnly: false,
    mode: "area",
    length: 3,
    width: 2,
    fob: 20,
    fx: 4.5,
    sstPct: 10,
    shipping: 5,
    wastagePct: 0,
    edging: 40,
    install: 25,
    qty: 2,
    rate: 1500,
  };

  it("costs an area rug as length x width x landed, plus edging and install", () => {
    // landed 20 x 4.5 x 1.1 + 5 = 104; 6 m2 x 104 = 624; + 40 + 25 = 689 per piece
    const totals = itemTotals(rug);
    expect(totals.unitCost).toBeCloseTo(689, 10);
    expect(totals.cost).toBe(1378);
    expect(totals.sell).toBe(3000);
  });

  it("uses the supplier's piece price in piece mode", () => {
    const totals = itemTotals({
      ...rug,
      mode: "piece",
      pieceCost: 500,
      wastagePct: 10,
    });
    // 500 x 1.1 + 40 + 25
    expect(totals.unitCost).toBeCloseTo(615, 10);
  });

  it("drops install when supply only", () => {
    expect(itemTotals({ ...rug, supplyOnly: true }).unitCost).toBeCloseTo(
      664,
      10,
    );
  });
});

describe("itemTotals: labour, simple, lump", () => {
  it("costs labour as install + underlay + accessories", () => {
    const totals = itemTotals({
      type: "labour",
      install: 12,
      underlay: 3,
      accessories: 1.5,
      qty: 100,
      rate: 20,
    });
    expect(totals.cost).toBe(1650);
    expect(totals.sell).toBe(2000);
    expect(totals.margin).toBeCloseTo(0.175, 10);
  });

  it("costs a simple item as material + install", () => {
    const totals = itemTotals({
      type: "simple",
      material: 4,
      install: 1,
      qty: 10,
      rate: 8,
    });
    expect(totals.cost).toBe(50);
    expect(totals.sell).toBe(80);
  });

  it("takes a lump cost as given and defaults the quantity to 1", () => {
    const totals = itemTotals({ type: "lump", cost: 350, qty: 0, rate: 547 });
    expect(totals.qty).toBe(1);
    expect(totals.cost).toBe(350);
    expect(totals.sell).toBe(547);
    expect(totals.profit).toBe(197);
  });

  it("multiplies a lump by a quantity when one is keyed in", () => {
    expect(
      itemTotals({ type: "lump", cost: 350, qty: 3, rate: 500 }).cost,
    ).toBe(1050);
  });
});

describe("itemTotals: discount", () => {
  it("is a negative sell with zero cost and no margin", () => {
    const totals = itemTotals({ type: "discount", rate: 500 });
    expect(totals).toEqual({
      qty: 1,
      unitCost: 0,
      cost: 0,
      sell: -500,
      profit: -500,
      margin: null,
    });
  });

  it("stays negative when the rate is keyed in as negative", () => {
    expect(itemTotals({ type: "discount", rate: -500 }).sell).toBe(-500);
  });
});

describe("itemTotals: rounding", () => {
  it("rounds cost and sell to cents per line", () => {
    // 1/3 per unit x 10 = 3.3333..; rate 0.335 x 10 = 3.35 (not 3.3499999)
    const totals = itemTotals({
      type: "simple",
      material: 1 / 3,
      qty: 10,
      rate: 0.335,
    });
    expect(totals.cost).toBe(3.33);
    expect(totals.sell).toBe(3.35);
    expect(totals.profit).toBe(0.02);
  });

  it("has no margin when a line sells nothing", () => {
    const totals = itemTotals({ type: "lump", cost: 100, qty: 1, rate: 0 });
    expect(totals.margin).toBeNull();
    expect(totals.profit).toBe(-100);
  });
});

describe("optionTotals", () => {
  it("sums line cost and sell, with discount lowering sell only", () => {
    const totals = optionTotals([
      { type: "lump", cost: 600, qty: 1, rate: 1000 },
      { type: "discount", rate: 200 },
    ]);
    expect(totals.cost).toBe(600);
    expect(totals.sell).toBe(800);
    expect(totals.profit).toBe(200);
    expect(totals.margin).toBeCloseTo(0.25, 10);
  });

  it("is zero with no items", () => {
    expect(optionTotals([])).toEqual({
      cost: 0,
      sell: 0,
      profit: 0,
      margin: null,
    });
  });
});

describe("marginBand", () => {
  it("is red under 20%, amber from 20% to under 30%, green from 30%", () => {
    expect(marginBand(0.1999)).toBe("red");
    expect(marginBand(0.2)).toBe("amber");
    expect(marginBand(0.2999)).toBe("amber");
    expect(marginBand(0.3)).toBe("green");
    expect(marginBand(0.55)).toBe("green");
  });

  it("reads an exact 20% and 30% from real sums, not float noise", () => {
    expect(
      marginBand(
        optionTotals([{ type: "lump", cost: 80, qty: 1, rate: 100 }]).margin,
      ),
    ).toBe("amber");
    expect(
      marginBand(
        optionTotals([{ type: "lump", cost: 70, qty: 1, rate: 100 }]).margin,
      ),
    ).toBe("green");
  });

  it("is red for a loss and has no band without a margin", () => {
    expect(marginBand(-0.1)).toBe("red");
    expect(marginBand(null)).toBeNull();
  });
});

describe("quoteAmount", () => {
  it("is the highest option sell", () => {
    expect(quoteAmount([{ sell: 20103 }, { sell: 45303 }, { sell: 100 }])).toBe(
      45303,
    );
  });

  it("is zero with no options", () => {
    expect(quoteAmount([])).toBe(0);
  });
});

// Demo seed quote GQ5153 (two options), figures recomputed with the demo's own maths:
// A: Axminster import 300 m2 at 149 + transport; B: carpet tile local 300 m2 at 65 + transport.
describe("demo seed quote with two options", () => {
  const transport: CostingItem = { type: "lump", cost: 350, qty: 1, rate: 603 };
  const optionA: CostingItem[] = [
    {
      type: "import",
      supplyOnly: false,
      unit: "m2",
      fob: 13,
      fx: 4.5,
      sstPct: 10,
      shipping: 6,
      wastagePct: 3,
      install: 14,
      qty: 300,
      rate: 149,
    },
    transport,
  ];
  const optionB: CostingItem[] = [
    {
      type: "local",
      supplyOnly: false,
      material: 32,
      wastagePct: 5,
      install: 9,
      qty: 300,
      rate: 65,
    },
    transport,
  ];

  it("matches the demo option totals to the sen", () => {
    const a = optionTotals(optionA);
    expect(a.cost).toBe(26288.15);
    expect(a.sell).toBe(45303);
    expect(a.margin).toBeCloseTo(0.4197260667, 9);
    const b = optionTotals(optionB);
    expect(b.cost).toBe(13130);
    expect(b.sell).toBe(20103);
    expect(b.margin).toBeCloseTo(0.3468636522, 9);
  });

  it("quotes the highest option and bands each margin", () => {
    const options = [optionA, optionB].map(optionTotals);
    expect(quoteAmount(options)).toBe(45303);
    expect(options.map((option) => marginBand(option.margin))).toEqual([
      "green",
      "green",
    ]);
  });
});

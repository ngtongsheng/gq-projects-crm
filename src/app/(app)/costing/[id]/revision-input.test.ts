import { describe, expect, it } from "vitest";
import { itemTotals } from "@/lib/domain/costing";
import { costingItemOf } from "../quote-view";
import {
  type ItemInput,
  itemColumns,
  RevisionInput,
  sellSideColumns,
  withoutCost,
} from "./revision-input";

const line = (overrides: Partial<ItemInput>): ItemInput => ({
  id: null,
  ref: "a",
  linkRef: null,
  category: "si",
  type: "local",
  area: null,
  product: null,
  supplier: null,
  description: null,
  remark: null,
  unit: "m2",
  qty: null,
  rate: null,
  material: null,
  wastagePct: null,
  underlay: null,
  accessories: null,
  install: null,
  currency: null,
  fob: null,
  fx: null,
  sstPct: null,
  shipping: null,
  rugMode: null,
  length: null,
  width: null,
  pieceCost: null,
  edging: null,
  lumpCost: null,
  ...overrides,
});

const everything = {
  material: 1,
  wastagePct: 2,
  underlay: 3,
  accessories: 4,
  install: 5,
  currency: "RMB",
  fob: 6,
  fx: 0.6,
  sstPct: 10,
  shipping: 7,
  rugMode: "piece",
  length: 2,
  width: 3,
  pieceCost: 8,
  edging: 9,
  lumpCost: 10,
} as const;

/** The cost columns a line of this kind may keep; anything else is null. */
const filled = (columns: ReturnType<typeof itemColumns>) =>
  Object.entries(columns)
    .filter(
      ([key, value]) =>
        value !== null &&
        ![
          "category",
          "type",
          "unit",
          "qty",
          "rate",
          "area",
          "product",
          "supplier",
          "description",
          "remark",
        ].includes(key),
    )
    .map(([key]) => key)
    .sort();

describe("itemColumns", () => {
  it.each([
    [
      "local",
      { category: "si", type: "local" },
      ["accessories", "install", "material", "underlay", "wastage_pct"],
    ],
    [
      "import",
      { category: "si", type: "import" },
      [
        "currency",
        "fob",
        "fx",
        "install",
        "shipping",
        "sst_pct",
        "underlay",
        "wastage_pct",
      ],
    ],
    [
      "rug priced by the piece",
      { category: "si", type: "rug", rugMode: "piece" },
      [
        "edging",
        "install",
        "length",
        "piece_cost",
        "rug_mode",
        "wastage_pct",
        "width",
      ],
    ],
    [
      "rug priced by area",
      { category: "si", type: "rug", rugMode: "area" },
      [
        "currency",
        "edging",
        "fob",
        "fx",
        "install",
        "length",
        "rug_mode",
        "shipping",
        "sst_pct",
        "wastage_pct",
        "width",
      ],
    ],
    [
      "installation",
      { category: "install", type: "labour" },
      ["accessories", "install", "underlay"],
    ],
    ["transport", { category: "transport", type: "lump" }, ["cost"]],
    ["accessory", { category: "acc", type: "simple" }, ["install", "material"]],
    ["discount", { category: "disc", type: "discount" }, []],
  ] as const)("keeps only the cost columns a %s line may have", (_name, kind, expected) => {
    const columns = itemColumns(line({ ...everything, ...kind }));

    expect(filled(columns)).toEqual([...expected].sort());
  });

  it("drops installation, underlay and accessories from a supply-only line", () => {
    const columns = itemColumns(
      line({ category: "supply", type: "local", ...everything }),
    );

    expect(filled(columns)).toEqual(["material", "wastage_pct"]);
  });

  it("makes a discount one lump sum", () => {
    const columns = itemColumns(
      line({
        category: "disc",
        type: "discount",
        qty: 7,
        unit: "m2",
        rate: 500,
      }),
    );

    expect(columns).toMatchObject({ qty: 1, unit: "ls", rate: 500 });
  });

  it("gives the same totals as the saved line will have once loaded", () => {
    const columns = itemColumns(
      line({
        category: "supply",
        type: "local",
        material: 10,
        wastagePct: 10,
        qty: 5,
        rate: 20,
      }),
    );

    const totals = itemTotals(
      costingItemOf({ ...columns, id: "i", position: 0, linked_item_id: null }),
    );

    expect(totals).toMatchObject({ sell: 100, cost: 55, profit: 45 });
  });
});

describe("withoutCost and sellSideColumns", () => {
  it("clear every cost-side field", () => {
    const stripped = withoutCost(
      line({
        type: "import",
        qty: 2,
        rate: 30,
        product: "Tile",
        ...everything,
      }),
    );

    expect(stripped).toMatchObject({ qty: 2, rate: 30, product: "Tile" });
    expect(stripped).toMatchObject({
      material: null,
      fob: null,
      fx: null,
      sstPct: null,
      lumpCost: null,
      rugMode: null,
    });
  });

  it("keep what the customer sees and nothing of the cost", () => {
    const sell = sellSideColumns(
      itemColumns(
        line({ type: "import", qty: 2, rate: 30, fob: 5, supplier: "Acme" }),
      ),
    );

    expect(Object.keys(sell).sort()).toEqual([
      "area",
      "category",
      "description",
      "length",
      "product",
      "qty",
      "rate",
      "remark",
      "supplier",
      "unit",
      "width",
    ]);
  });
});

describe("RevisionInput", () => {
  const base = {
    revisionId: "55555555-5555-4555-8555-555555555555",
    fxUsd: 4.5,
    fxRmb: 0.6,
    sstPct: 10,
    targetMarginPct: 30,
    options: [],
  };

  it("refuses a kind of line its category cannot have", () => {
    const result = RevisionInput.safeParse({
      ...base,
      options: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          label: "",
          items: [line({ category: "transport", type: "local" })],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("trims text and turns blanks into null", () => {
    const result = RevisionInput.parse({
      ...base,
      options: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          label: "  Axminster ",
          items: [line({ product: "   " })],
        },
      ],
    });

    expect(result.options[0].label).toBe("Axminster");
    expect(result.options[0].items[0].product).toBeNull();
  });
});

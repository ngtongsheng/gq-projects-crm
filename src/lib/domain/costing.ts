import { fromCents, sumRm, toCents } from "@/lib/format/money";

const SQFT_PER_M2 = 10.764;

export type MarginBand = "red" | "amber" | "green";

/** Cost fields come from nullable database columns; a missing one counts as 0. */
type Amount = number | null | undefined;

type Priced = { qty: Amount; rate: Amount };

/** Fields shared by the three supply types: supply-only drops install, underlay and accessories. */
type Supplied = Priced & { supplyOnly: boolean; wastagePct?: Amount };

type Landed = {
  fob?: Amount;
  fx?: Amount;
  sstPct?: Amount;
  shipping?: Amount;
};

export type CostingItem =
  | (Supplied & {
      type: "local";
      material?: Amount;
      underlay?: Amount;
      accessories?: Amount;
      install?: Amount;
    })
  | (Supplied &
      Landed & {
        type: "import";
        /** The unit the item is quoted in; FOB and shipping are always per m2. */
        unit: "m2" | "sqft";
        underlay?: Amount;
        install?: Amount;
      })
  | (Supplied &
      Landed & {
        type: "rug";
        /** "area": length x width x landed per m2. "piece": the supplier's price per piece. */
        mode: "area" | "piece";
        length?: Amount;
        width?: Amount;
        pieceCost?: Amount;
        edging?: Amount;
        install?: Amount;
      })
  | (Priced & {
      type: "labour";
      install?: Amount;
      underlay?: Amount;
      accessories?: Amount;
    })
  | (Priced & { type: "simple"; material?: Amount; install?: Amount })
  | (Priced & { type: "lump"; cost?: Amount })
  | { type: "discount"; rate: Amount };

export type ItemTotals = {
  qty: number;
  unitCost: number;
  cost: number;
  sell: number;
  profit: number;
  /** Profit as a fraction of sell (0.3 is 30%); null when nothing is sold. */
  margin: number | null;
};

export type OptionTotals = Omit<ItemTotals, "qty" | "unitCost">;

const n = (value: Amount): number => value ?? 0;

/** Landed cost per m2 in RM: FOB in foreign currency at the quote's rate, plus SST, plus shipping. */
export function landedPerM2(item: Landed): number {
  return (
    n(item.fob) * n(item.fx) * (1 + n(item.sstPct) / 100) + n(item.shipping)
  );
}

function unitCostOf(item: CostingItem): number {
  switch (item.type) {
    case "local": {
      const base = n(item.material) * (1 + n(item.wastagePct) / 100);
      if (item.supplyOnly) return base;
      return base + n(item.underlay) + n(item.accessories) + n(item.install);
    }
    case "import": {
      const landed =
        item.unit === "sqft"
          ? landedPerM2(item) / SQFT_PER_M2
          : landedPerM2(item);
      const base = landed * (1 + n(item.wastagePct) / 100);
      if (item.supplyOnly) return base;
      return base + n(item.underlay) + n(item.install);
    }
    case "rug": {
      const material =
        item.mode === "piece"
          ? n(item.pieceCost)
          : n(item.length) * n(item.width) * landedPerM2(item);
      const base = material * (1 + n(item.wastagePct) / 100) + n(item.edging);
      return item.supplyOnly ? base : base + n(item.install);
    }
    case "labour":
      return n(item.install) + n(item.underlay) + n(item.accessories);
    case "simple":
      return n(item.material) + n(item.install);
    case "lump":
      return n(item.cost);
    case "discount":
      return 0;
  }
}

function marginOf(sell: number, profit: number): number | null {
  return sell === 0 ? null : profit / sell;
}

/** One line's numbers. Cost and sell are rounded to cents here so totals add up to what is printed. */
export function itemTotals(item: CostingItem): ItemTotals {
  if (item.type === "discount") {
    const sell = fromCents(toCents(-Math.abs(n(item.rate))));
    return { qty: 1, unitCost: 0, cost: 0, sell, profit: sell, margin: null };
  }
  // A lump sum with no quantity keyed in is one lump.
  const qty = item.type === "lump" ? n(item.qty) || 1 : n(item.qty);
  const unitCost = unitCostOf(item);
  const cost = fromCents(toCents(unitCost * qty));
  const sell = fromCents(toCents(n(item.rate) * qty));
  const profit = sumRm([sell, -cost]);
  return { qty, unitCost, cost, sell, profit, margin: marginOf(sell, profit) };
}

export function optionTotals(items: readonly CostingItem[]): OptionTotals {
  const lines = items.map(itemTotals);
  const cost = sumRm(lines.map((line) => line.cost));
  const sell = sumRm(lines.map((line) => line.sell));
  const profit = sumRm([sell, -cost]);
  return { cost, sell, profit, margin: marginOf(sell, profit) };
}

/** Below 20% red, 20 to under 30% amber, 30% and over green; no band when nothing is sold. */
export function marginBand(margin: number | null): MarginBand | null {
  if (margin === null) return null;
  // toPrecision drops binary noise so a margin of exactly 20% is not read as 19.999...
  const percent = Number((margin * 100).toPrecision(12));
  if (percent < 20) return "red";
  if (percent < 30) return "amber";
  return "green";
}

/** What the customer is quoted: the highest option. */
export function quoteAmount(options: readonly { sell: number }[]): number {
  return options.reduce((highest, option) => Math.max(highest, option.sell), 0);
}

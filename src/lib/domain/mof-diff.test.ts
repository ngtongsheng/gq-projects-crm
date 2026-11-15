import { describe, expect, it } from "vitest";
import {
  changeNeedsReason,
  linesSummary,
  type MofSnapshot,
  mofDiff,
} from "./mof-diff";

const saved: MofSnapshot = {
  contractSum: 12500,
  cost: 8000,
  installerName: "Leong",
  scope: "s_and_l",
  salespersonId: "sales-1",
  secondSalespersonId: null,
  commissionType: "own",
  loaDate: "2026-11-02",
  lines: [{ product: "Carpet Tile", qty: 250, unit: "m²" }],
};

describe("mofDiff", () => {
  it("finds nothing when nothing changed", () => {
    expect(mofDiff(saved, { ...saved })).toEqual([]);
  });

  it.each([
    ["contract_sum", { contractSum: 12100 }, "12500", "12100"],
    ["cost", { cost: 7500 }, "8000", "7500"],
    ["installer_name", { installerName: "Ah Seng" }, "Leong", "Ah Seng"],
    ["scope", { scope: "supply" }, "s_and_l", "supply"],
    ["salesperson_id", { salespersonId: "sales-2" }, "sales-1", "sales-2"],
    [
      "second_salesperson_id",
      { secondSalespersonId: "sales-3" },
      null,
      "sales-3",
    ],
    ["commission_type", { commissionType: "company" }, "own", "company"],
    ["loa_date", { loaDate: "2026-11-05" }, "2026-11-02", "2026-11-05"],
    [
      "lines",
      { lines: [{ product: "Carpet Tile", qty: 210, unit: "m²" }] },
      "Carpet Tile 250 m²",
      "Carpet Tile 210 m²",
    ],
  ] as const)("records a change to %s", (field, change, from, to) => {
    expect(mofDiff(saved, { ...saved, ...change })).toEqual([
      { field, from, to },
    ]);
  });

  it("treats blank and missing text as the same", () => {
    expect(
      mofDiff(
        { ...saved, installerName: null },
        { ...saved, installerName: "  " },
      ),
    ).toEqual([]);
  });

  it("ignores amounts that round to the same cent", () => {
    expect(mofDiff(saved, { ...saved, contractSum: 12500.001 })).toEqual([]);
  });

  it("leaves the cost out when none is posted", () => {
    expect(mofDiff(saved, { ...saved, cost: undefined })).toEqual([]);
    expect(mofDiff(saved, { ...saved, cost: null })).toEqual([]);
  });

  it("records a first cost from blank", () => {
    expect(mofDiff({ ...saved, cost: null }, saved)).toEqual([
      { field: "cost", from: null, to: "8000" },
    ]);
  });

  it("records an added product line", () => {
    const [change] = mofDiff(saved, {
      ...saved,
      lines: [...saved.lines, { product: "Carpet Roll", qty: 3, unit: "roll" }],
    });
    expect(change).toEqual({
      field: "lines",
      from: "Carpet Tile 250 m²",
      to: "Carpet Tile 250 m², Carpet Roll 3 roll",
    });
  });
});

describe("linesSummary", () => {
  it("is blank without lines", () => {
    expect(linesSummary([])).toBeNull();
  });
});

describe("changeNeedsReason", () => {
  const installer = { field: "installer_name", from: "A", to: "B" } as const;

  it("needs no reason for an open job's ordinary change", () => {
    expect(changeNeedsReason([installer], false)).toBe(false);
  });

  it("needs a reason for any change to a completed job", () => {
    expect(changeNeedsReason([installer], true)).toBe(true);
  });

  it("needs none for a completed job saved without changes", () => {
    expect(changeNeedsReason([], true)).toBe(false);
  });

  it("needs a reason when the contract sum changes", () => {
    expect(
      changeNeedsReason([{ field: "contract_sum", from: "1", to: "2" }], false),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { filterMofs, parseMofFilters, visibleMofs } from "./mof-filters";

const MEI = "11111111-1111-4111-8111-111111111111";
const ARIF = "22222222-2222-4222-8222-222222222222";
const LIM = "33333333-3333-4333-8333-333333333333";

const mof = (
  mofNo: string,
  stage: "ordered" | "closed",
  salespersonId: string,
  secondSalespersonId: string | null = null,
) => ({ mofNo, stage, salespersonId, secondSalespersonId });

const rows = [
  mof("A1", "ordered", MEI),
  mof("A2", "closed", ARIF, MEI),
  mof("A3", "ordered", LIM),
];
const numbers = (list: typeof rows) => list.map((row) => row.mofNo);

describe("parseMofFilters", () => {
  it("reads a stage and a person", () => {
    expect(parseMofFilters({ stage: "closed", person: MEI })).toEqual({
      stage: "closed",
      person: MEI,
    });
  });

  it("drops anything unrecognised", () => {
    expect(parseMofFilters({ stage: "won", person: "x" })).toEqual({
      stage: undefined,
      person: undefined,
    });
  });
});

describe("filterMofs", () => {
  it("filters by stage", () => {
    expect(numbers(filterMofs(rows, { stage: "ordered" }))).toEqual([
      "A1",
      "A3",
    ]);
  });

  it("counts a second salesperson as on the MOF", () => {
    expect(numbers(filterMofs(rows, { person: MEI }))).toEqual(["A1", "A2"]);
  });
});

describe("visibleMofs", () => {
  it("shows a salesperson only their own, even when they ask for someone else", () => {
    const mine = visibleMofs(
      rows,
      { id: MEI, jobRole: "sales" },
      {
        person: LIM,
      },
    );
    expect(mine).toEqual([]);
    expect(numbers(visibleMofs(rows, { id: MEI, jobRole: "bd" }, {}))).toEqual([
      "A1",
      "A2",
    ]);
  });

  it("shows the whole register to the MD, Purchasing and HR & Accounts", () => {
    for (const jobRole of ["md", "support", "accounts"] as const) {
      expect(visibleMofs(rows, { id: MEI, jobRole }, {})).toHaveLength(3);
    }
  });
});

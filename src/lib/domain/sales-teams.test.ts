import { describe, expect, it } from "vitest";
import { salesTeams, type TeamPerson } from "./sales-teams";

const person = (fields: Partial<TeamPerson> & { id: string }): TeamPerson => ({
  name: fields.id,
  title: null,
  jobRole: "sales",
  active: true,
  reportsTo: null,
  salesTarget: null,
  ...fields,
});

describe("salesTeams", () => {
  it("groups people under the lead they report to and totals the targets, lead included", () => {
    const teams = salesTeams([
      person({
        id: "eddie",
        jobRole: "director",
        title: "Sales Director",
        salesTarget: 2_000_000,
      }),
      person({ id: "amy", reportsTo: "eddie", salesTarget: 960_000 }),
      person({ id: "ben", reportsTo: "eddie", salesTarget: 1_000_000.5 }),
      person({ id: "cara", reportsTo: "vera", salesTarget: 500_000 }),
      person({ id: "vera", jobRole: "bd" }),
    ]);

    expect(teams).toEqual([
      {
        leadId: "eddie",
        leadName: "eddie",
        leadTitle: "Sales Director",
        members: [
          { id: "amy", name: "amy" },
          { id: "ben", name: "ben" },
        ],
        targetTotal: 3_960_000.5,
      },
      {
        leadId: "vera",
        leadName: "vera",
        leadTitle: null,
        members: [{ id: "cara", name: "cara" }],
        targetTotal: 500_000,
      },
    ]);
  });

  it("lists a lead with nobody under them, with no total when nobody has a target", () => {
    expect(salesTeams([person({ id: "eddie", jobRole: "director" })])).toEqual([
      {
        leadId: "eddie",
        leadName: "eddie",
        leadTitle: null,
        members: [],
        targetTotal: null,
      },
    ]);
  });

  it("leaves out people who have left, as members and as leads", () => {
    const teams = salesTeams([
      person({ id: "eddie", jobRole: "director" }),
      person({ id: "old", jobRole: "director", active: false }),
      person({
        id: "gone",
        reportsTo: "eddie",
        active: false,
        salesTarget: 1_000_000,
      }),
    ]);
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ members: [], targetTotal: null });
  });

  it("does not count someone who is not a lead as a team", () => {
    expect(salesTeams([person({ id: "amy" })])).toEqual([]);
  });
});

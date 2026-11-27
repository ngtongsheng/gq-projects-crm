import { describe, expect, it } from "vitest";
import { mofPeople } from "./mof-people";

const nameOf = new Map([
  ["aina", "Aina"],
  ["ben", "Ben"],
  ["blank", ""],
]);

describe("mofPeople", () => {
  it("names the salesperson alone", () => {
    const mof = { salespersonId: "aina", secondSalespersonId: null };
    expect(mofPeople(mof, nameOf)).toBe("Aina");
  });

  it("puts the second salesperson after the first", () => {
    const mof = { salespersonId: "ben", secondSalespersonId: "aina" };
    expect(mofPeople(mof, nameOf)).toBe("Ben + Aina");
  });

  it("says Unnamed for a person it has no name for", () => {
    const mof = { salespersonId: "gone", secondSalespersonId: "left" };
    expect(mofPeople(mof, nameOf)).toBe("Unnamed + Unnamed");
  });

  it("leaves out a blank name", () => {
    const mof = { salespersonId: "blank", secondSalespersonId: "ben" };
    expect(mofPeople(mof, nameOf)).toBe("Ben");
  });

  it("keeps the place of a blank name when asked to", () => {
    const mof = { salespersonId: "blank", secondSalespersonId: "ben" };
    expect(mofPeople(mof, nameOf, { keepBlankNames: true })).toBe(" + Ben");
  });
});

import { describe, expect, it } from "vitest";
import { inMyTeam, myTeam, type TeamPerson } from "./team";

const people: TeamPerson[] = [
  { id: "vicky", jobRole: "md", reportsTo: null },
  { id: "eddie", jobRole: "director", reportsTo: null },
  { id: "vanessa", jobRole: "bd", reportsTo: null },
  { id: "ali", jobRole: "sales", reportsTo: "eddie" },
  { id: "bee", jobRole: "sales", reportsTo: "vanessa" },
  { id: "chong", jobRole: "sales", reportsTo: null },
  { id: "sam", jobRole: "site", reportsTo: "eddie" },
  { id: "hana", jobRole: "accounts", reportsTo: null },
];
const person = (id: string) => {
  const found = people.find((p) => p.id === id);
  if (!found) throw new Error(id);
  return found;
};
const teamOf = (id: string) => myTeam(person(id), people);

describe("myTeam", () => {
  it("is the director and the salespeople who report to them", () => {
    expect(teamOf("eddie")).toEqual(["eddie", "ali"]);
    expect(teamOf("vanessa")).toEqual(["vanessa", "bee"]);
  });

  it("is everyone for the MD and HR & Accounts", () => {
    expect(teamOf("vicky")).toBeNull();
    expect(teamOf("hana")).toBeNull();
  });

  it("is only themself for a salesperson or site supervisor", () => {
    expect(teamOf("ali")).toEqual(["ali"]);
    expect(teamOf("sam")).toEqual(["sam"]);
  });

  it("leaves out a salesperson with no lead", () => {
    expect(teamOf("eddie")).not.toContain("chong");
  });
});

describe("inMyTeam", () => {
  it("keeps another team's records out", () => {
    expect(inMyTeam(teamOf("eddie"), "bee")).toBe(false);
    expect(inMyTeam(teamOf("eddie"), "ali")).toBe(true);
  });

  it("lets everyone in when the team is everyone", () => {
    expect(inMyTeam(teamOf("vicky"), "bee")).toBe(true);
  });

  it("never matches an empty person", () => {
    expect(inMyTeam(teamOf("eddie"), null)).toBe(false);
    expect(inMyTeam(null, null)).toBe(true);
  });
});

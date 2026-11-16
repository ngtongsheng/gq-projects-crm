import { describe, expect, it } from "vitest";
import {
  inChargeGroups,
  installerChoices,
  installerIdByName,
  parseTeamChoice,
  SUPERVISOR_ONLY,
} from "./job-team";

const ID = "11111111-1111-4111-8111-111111111111";

describe("parseTeamChoice", () => {
  it("reads blank as no team yet, and the supervisor-only choice as no installer", () => {
    expect(parseTeamChoice("")).toEqual({
      installerId: null,
      supervisorOnly: false,
    });
    expect(parseTeamChoice(SUPERVISOR_ONLY)).toEqual({
      installerId: null,
      supervisorOnly: true,
    });
  });

  it("reads an installer id", () => {
    expect(parseTeamChoice(ID)).toEqual({
      installerId: ID,
      supervisorOnly: false,
    });
  });

  it("refuses anything else", () => {
    expect(parseTeamChoice("Leong")).toBeNull();
  });
});

describe("installerChoices", () => {
  const installers = [{ id: ID, name: "Leong" }];

  it("keeps an installer made inactive since on the record that has them", () => {
    expect(installerChoices(installers, { id: "b", name: "Old Hand" })).toEqual(
      [...installers, { id: "b", name: "Old Hand" }],
    );
  });

  it("lists an active installer once", () => {
    expect(installerChoices(installers, { id: ID, name: "Leong" })).toEqual(
      installers,
    );
    expect(installerChoices(installers, null)).toEqual(installers);
  });
});

describe("installerIdByName", () => {
  const installers = [
    { id: ID, name: "Leong" },
    { id: "b", name: "Chua (KV Flooring)" },
  ];

  it("matches the name the MOF carries however it was spaced or cased", () => {
    expect(installerIdByName(installers, "  leong ")).toBe(ID);
  });

  it("finds nobody for a blank or unknown name", () => {
    expect(installerIdByName(installers, "")).toBeUndefined();
    expect(installerIdByName(installers, "Kelvin")).toBeUndefined();
  });
});

describe("inChargeGroups", () => {
  const people = {
    supervisors: [{ id: "s", name: "Awal" }],
    salespeople: [{ id: "p", name: "Vernice" }],
  };

  it("keeps the supervisors and salespeople apart", () => {
    expect(inChargeGroups(people, { id: "s", name: "Awal" })).toEqual({
      ...people,
      others: [],
    });
  });

  it("keeps someone no longer listed pickable while they are on the job", () => {
    expect(inChargeGroups(people, { id: "x", name: "Former" }).others).toEqual([
      { id: "x", name: "Former" },
    ]);
  });

  it("adds no one when the job has nobody in charge", () => {
    expect(inChargeGroups(people, null).others).toEqual([]);
  });
});

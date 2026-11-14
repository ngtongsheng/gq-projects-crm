import { expect, test } from "vitest";
import { teamFilter } from "./team-filter";

const eddie = { id: "e", name: "Eddie" };
const arun = { id: "a", name: "Arun" };
const mei = { id: "m", name: "Mei" };
const members = [arun, eddie, mei];

test("the MD sees everyone and can pick anyone", () => {
  expect(teamFilter({ members, team: null, picked: "m" })).toEqual({
    choices: members,
    allLabel: "Everyone",
    who: "m",
  });
});

test("a team lead is offered only their team, under the name My team", () => {
  expect(teamFilter({ members, team: ["e", "a"], picked: undefined })).toEqual({
    choices: [arun, eddie],
    allLabel: "My team",
    who: undefined,
  });
});

test("a person outside the team falls back to the whole team", () => {
  expect(teamFilter({ members, team: ["e", "a"], picked: "m" }).who).toBe(
    undefined,
  );
  expect(teamFilter({ members, team: ["e"], picked: "nobody" }).who).toBe(
    undefined,
  );
});

test("a lead with no one else on the team still gets the filter for themself", () => {
  expect(teamFilter({ members, team: ["e"], picked: "e" })).toEqual({
    choices: [eddie],
    allLabel: "My team",
    who: "e",
  });
});

import { expect, test } from "vitest";
import {
  filterByPerson,
  parsePipelineFilters,
  peopleOnProjects,
} from "./project-filters";

const ARUN = "22222222-2222-4222-8222-222222222222";
const MEI = "33333333-3333-4333-8333-333333333333";
const SARAH = "44444444-4444-4444-8444-444444444444";

test("defaults to the board for everyone", () => {
  expect(parsePipelineFilters({})).toEqual({
    person: undefined,
    view: "board",
  });
});

test("ignores values it does not recognise", () => {
  expect(parsePipelineFilters({ person: "all", view: "grid" })).toEqual({
    person: undefined,
    view: "board",
  });
  expect(parsePipelineFilters({ person: ARUN, view: "list" })).toEqual({
    person: ARUN,
    view: "list",
  });
});

test("a person's projects include the ones they support", () => {
  const rows = [
    { id: 1, picId: ARUN, supportId: null },
    { id: 2, picId: MEI, supportId: ARUN },
    { id: 3, picId: MEI, supportId: null },
  ];
  expect(filterByPerson(rows, ARUN).map((row) => row.id)).toEqual([1, 2]);
  expect(filterByPerson(rows, undefined)).toHaveLength(3);
});

test("the person filter offers only people on the projects I can read", () => {
  const members = [
    { id: ARUN, name: "Arun" },
    { id: MEI, name: "Mei" },
    { id: SARAH, name: "Sarah" },
  ];
  const rows = [
    { picId: SARAH, supportId: null },
    { picId: MEI, supportId: SARAH },
  ];
  expect(peopleOnProjects(members, rows).map((m) => m.name)).toEqual([
    "Mei",
    "Sarah",
  ]);
  expect(peopleOnProjects(members, [])).toEqual([]);
});

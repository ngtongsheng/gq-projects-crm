import { expect, test } from "vitest";
import { activityTypesToChoose } from "./schemas";

test("a new activity can be a visit, site visit, walk-in or online meeting, not a call", () => {
  expect(activityTypesToChoose()).toEqual([
    "visit",
    "site_visit",
    "walk_in",
    "online_meeting",
  ]);
  expect(activityTypesToChoose("visit")).not.toContain("call");
});

test("an earlier call keeps its type in the list when it is edited", () => {
  expect(activityTypesToChoose("call")).toContain("call");
});

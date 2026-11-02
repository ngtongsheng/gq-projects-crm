import { expect, test } from "vitest";
import { estimatedCommission } from "./project-commission";

test("own effort earns 3%, pass-down and company accounts 1.5%", () => {
  expect(estimatedCommission(65000, "own")).toBe(1950);
  expect(estimatedCommission(65000, "pass_down")).toBe(975);
  expect(estimatedCommission(65000, "company")).toBe(975);
});

test("rounds to the cent", () => {
  expect(estimatedCommission(0.1, "own")).toBe(0);
  expect(estimatedCommission(33.34, "own")).toBe(1);
});

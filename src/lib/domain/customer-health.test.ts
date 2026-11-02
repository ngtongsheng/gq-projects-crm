import { expect, test } from "vitest";
import { addDays } from "@/lib/format/date";
import { customerHealth } from "./customer-health";

const today = "2026-11-02";
const idleFor = (days: number) => customerHealth(addDays(today, -days), today);

test("a customer with no completed activity is new", () => {
  expect(customerHealth(null, today)).toBe("new");
});

test("quiet starts after 60 days", () => {
  expect(idleFor(0)).toBe("active");
  expect(idleFor(60)).toBe("active");
  expect(idleFor(61)).toBe("quiet");
});

test("no activity starts after 90 days", () => {
  expect(idleFor(90)).toBe("quiet");
  expect(idleFor(91)).toBe("no_activity");
});

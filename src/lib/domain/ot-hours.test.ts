import { describe, expect, it } from "vitest";
import { otHours } from "./ot-hours";

describe("otHours", () => {
  it("counts a same-day span", () => {
    expect(otHours("20:00", "23:00")).toBe(3);
  });

  it("carries past midnight", () => {
    expect(otHours("22:00", "02:00")).toBe(4);
    expect(otHours("23:30", "00:15")).toBe(1);
  });

  it("rounds to the nearest half hour, a quarter rounding up", () => {
    expect(otHours("20:00", "20:14")).toBe(0);
    expect(otHours("20:00", "20:15")).toBe(0.5);
    expect(otHours("20:00", "20:44")).toBe(0.5);
    expect(otHours("20:00", "20:45")).toBe(1);
    expect(otHours("20:00", "22:20")).toBe(2.5);
  });

  it("is zero when the start and end are the same", () => {
    expect(otHours("20:00", "20:00")).toBe(0);
  });
});

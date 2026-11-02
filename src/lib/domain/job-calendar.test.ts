import { expect, test } from "vitest";
import { jobsByDay } from "./job-calendar";

const job = (
  id: string,
  scheduledOn: string,
  endsOn: string,
  startTime = "",
) => ({
  id,
  scheduledOn,
  endsOn,
  startTime,
});

test("a one-day job appears on its day only", () => {
  const byDay = jobsByDay(
    [job("a", "2026-11-03", "2026-11-03")],
    "2026-11-01",
    "2026-11-30",
  );
  expect([...byDay.keys()]).toEqual(["2026-11-03"]);
});

test("a multi-day job appears on every day it runs", () => {
  const byDay = jobsByDay(
    [job("a", "2026-11-03", "2026-11-05")],
    "2026-11-01",
    "2026-11-30",
  );
  expect([...byDay.keys()]).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
});

test("a job that starts before or ends after the window is cut to the window", () => {
  const byDay = jobsByDay(
    [job("a", "2026-10-30", "2026-11-03")],
    "2026-11-01",
    "2026-11-30",
  );
  expect([...byDay.keys()]).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
  const late = jobsByDay(
    [job("b", "2026-11-29", "2026-12-02")],
    "2026-11-01",
    "2026-11-30",
  );
  expect([...late.keys()]).toEqual(["2026-11-29", "2026-11-30"]);
});

test("a job outside the window is left out", () => {
  expect(
    jobsByDay(
      [job("a", "2026-12-01", "2026-12-02")],
      "2026-11-01",
      "2026-11-30",
    ).size,
  ).toBe(0);
});

test("timed jobs come first by time, untimed keep their order", () => {
  const byDay = jobsByDay(
    [
      job("none1", "2026-11-03", "2026-11-03"),
      job("late", "2026-11-03", "2026-11-03", "14:00"),
      job("none2", "2026-11-03", "2026-11-03"),
      job("early", "2026-11-03", "2026-11-03", "08:30"),
    ],
    "2026-11-01",
    "2026-11-30",
  );
  expect(byDay.get("2026-11-03")?.map((j) => j.id)).toEqual([
    "early",
    "late",
    "none1",
    "none2",
  ]);
});

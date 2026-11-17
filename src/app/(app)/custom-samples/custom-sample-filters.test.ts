import { describe, expect, it } from "vitest";
import {
  customSampleTiles,
  filterCustomSamples,
} from "./custom-sample-filters";
import type { CustomSample, CustomSampleLoan } from "./custom-sample-types";

const TODAY = "2026-11-17";
const viewer = {
  meId: "vernice",
  today: TODAY,
  nameOf: new Map([
    ["vernice", "Vernice"],
    ["eddie", "Eddie"],
  ]),
};

const loan = (fields: Partial<CustomSampleLoan>): CustomSampleLoan => ({
  id: "l",
  salespersonId: "vernice",
  customer: "Hotel Seri",
  project: null,
  outOn: "2026-11-01",
  dueOn: "2026-11-15",
  returnedMarkedOn: null,
  backOn: null,
  givenAway: false,
  ...fields,
});

const sample = (
  code: string,
  fields: Partial<CustomSample> = {},
): CustomSample => ({
  id: code,
  code,
  receivedOn: "2026-10-01",
  designName: "Botanical swirl",
  designNo: `GQ-${code}`,
  supplier: null,
  size: null,
  qty: 1,
  photoPath: null,
  photoUrl: null,
  notes: null,
  recordedBy: "wai",
  givenOn: null,
  givenTo: null,
  giftReason: null,
  givenBy: null,
  loans: [],
  ...fields,
});

const overdue = sample("TS-001", { loans: [loan({})] });
const lateWorse = sample("TS-002", {
  loans: [loan({ salespersonId: "eddie", dueOn: "2026-11-10" })],
});
const toConfirm = sample("TS-003", {
  loans: [loan({ returnedMarkedOn: "2026-11-16" })],
});
const free = sample("TS-004", { receivedOn: "2026-11-05" });
const freeOlder = sample("TS-005", { receivedOn: "2026-09-01" });
const gone = sample("TS-006", {
  givenOn: "2026-11-01",
  givenTo: "Hotel Seri",
  loans: [loan({ backOn: "2026-11-01", givenAway: true })],
});
const all = [overdue, lateWorse, toConfirm, free, freeOlder, gone];

const codes = (rows: CustomSample[]) => rows.map((row) => row.code);
const show = (filter: Parameters<typeof filterCustomSamples>[1]["filter"]) =>
  codes(filterCustomSamples(all, { query: "", filter }, viewer));

describe("filterCustomSamples", () => {
  it("lists what is in hand, most overdue first, then newest received", () => {
    expect(show("all")).toEqual([
      "TS-002",
      "TS-001",
      "TS-004",
      "TS-003",
      "TS-005",
    ]);
  });

  it("filters by status", () => {
    expect(show("available")).toEqual(["TS-004", "TS-005"]);
    expect(show("on-loan")).toEqual(["TS-002", "TS-001"]);
    expect(show("to-confirm")).toEqual(["TS-003"]);
    expect(show("given")).toEqual(["TS-006"]);
    expect(show("overdue")).toEqual(["TS-002", "TS-001"]);
  });

  it("shows what the viewer borrowed, including one waiting to be confirmed", () => {
    expect(show("mine")).toEqual(["TS-001", "TS-003"]);
  });

  it("searches the code, design, customer and borrower's name", () => {
    const find = (query: string) =>
      codes(filterCustomSamples(all, { query, filter: "all" }, viewer));
    expect(find("ts-004")).toEqual(["TS-004"]);
    expect(find("gq-ts-005")).toEqual(["TS-005"]);
    expect(find("eddie")).toEqual(["TS-002"]);
    expect(find("  seri ")).toEqual(["TS-002", "TS-001", "TS-003"]);
  });
});

describe("customSampleTiles", () => {
  it("counts each status; on loan includes a return waiting to be confirmed", () => {
    expect(customSampleTiles(all, viewer)).toEqual({
      available: 2,
      onLoan: 3,
      withMe: 2,
      overdue: 2,
      toConfirm: 1,
      given: 1,
    });
  });
});

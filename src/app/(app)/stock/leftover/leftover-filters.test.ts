import { describe, expect, it } from "vitest";
import type { Leftover } from "./leftover-data";
import {
  countOnTheWay,
  parseBestLinkFilters,
  returnsInProgress,
  selectBestLinkItems,
} from "./leftover-filters";

const leftover = (over: Partial<Leftover>): Leftover => ({
  id: "1",
  mofId: "m",
  mofNo: "P1001",
  projectName: "Shoplot",
  item: "Carpet roll",
  qty: 10,
  unit: "m2",
  condition: "good",
  destination: "gq",
  status: "at_best_link",
  note: "",
  creditNoteNo: null,
  creditNoteAmount: null,
  recordedOn: "2026-11-01T00:00:00Z",
  recordedBy: null,
  returnMethod: null,
  transportBy: null,
  transportOn: null,
  transportTo: null,
  transportCost: null,
  supplier: null,
  keepReason: "custom_made",
  orderedWrongBy: null,
  whatsappSentAt: null,
  collectedAt: null,
  collectedBy: null,
  collectedTo: null,
  receivedAt: "2026-11-02T00:00:00Z",
  receivedBy: null,
  uses: [],
  available: 10,
  ...over,
});

const none = { q: "", soldOut: false };

describe("selectBestLinkItems", () => {
  it("lists only items at Best Link with some left, newest arrival first", () => {
    const list = selectBestLinkItems(
      [
        leftover({ id: "old", receivedAt: "2026-10-01T00:00:00Z" }),
        leftover({ id: "new", receivedAt: "2026-11-05T00:00:00Z" }),
        leftover({ id: "sold", available: 0 }),
        leftover({ id: "wait", status: "pending_pickup" }),
        leftover({ id: "back", status: "returned_to_supplier" }),
      ],
      none,
    );
    expect(list.map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("shows sold out items when asked", () => {
    const list = selectBestLinkItems(
      [leftover({ id: "a" }), leftover({ id: "sold", available: 0 })],
      { q: "", soldOut: true },
    );
    expect(list.map((item) => item.id).sort()).toEqual(["a", "sold"]);
  });

  it("searches item, note, MOF and project without regard to case", () => {
    const items = [
      leftover({ id: "a", item: "Tile Grey" }),
      leftover({ id: "b", note: "Rack B2" }),
      leftover({ id: "c", mofNo: "P1599", projectName: "Kajang" }),
    ];
    const ids = (q: string) =>
      selectBestLinkItems(items, { q, soldOut: false }).map((item) => item.id);
    expect(ids("grey")).toEqual(["a"]);
    expect(ids("b2")).toEqual(["b"]);
    expect(ids("p1599")).toEqual(["c"]);
    expect(ids("kajang")).toEqual(["c"]);
  });
});

describe("parseBestLinkFilters", () => {
  it("reads the search and the sold out switch from the address", () => {
    expect(parseBestLinkFilters({ q: " tile ", sold: "1" })).toEqual({
      q: "tile",
      soldOut: true,
    });
    expect(parseBestLinkFilters({})).toEqual({ q: "", soldOut: false });
  });
});

describe("countOnTheWay and returnsInProgress", () => {
  const items = [
    leftover({ id: "a", status: "pending_pickup" }),
    leftover({ id: "b", status: "pending_pickup", destination: "supplier" }),
    leftover({ id: "c", status: "at_best_link" }),
  ];

  it("counts only stock GQ keeps that is still to be picked up", () => {
    expect(countOnTheWay(items)).toBe(1);
  });

  it("leaves out what is already at Best Link", () => {
    expect(returnsInProgress(items).map((item) => item.id)).toEqual(["a", "b"]);
  });
});

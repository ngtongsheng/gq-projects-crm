import { describe, expect, it } from "vitest";
import {
  type EnquiryRow,
  type EnquiryView,
  enquiryLanded,
  searchEnquiries,
  splitEnquiries,
  toEnquiryView,
} from "./enquiry-view";

const row = (fields: Partial<EnquiryRow> = {}): EnquiryRow => ({
  id: "e1",
  enquiry_date: "2026-11-10",
  quote_no: "GQ5127",
  salesperson_id: "s1",
  product: "Axminster 42oz",
  sizes: null,
  qty: 100,
  unit: "m2",
  supplier: "Sunrise",
  currency: "USD",
  fob: 3.85,
  fx: 4.5,
  shipping: 0.4,
  notes: null,
  status: "replied",
  replied_by: "p1",
  replied_at: "2026-11-11T02:00:00Z",
  recorded_by: "s1",
  created_at: "2026-11-10T01:00:00Z",
  ...fields,
});

const context = {
  sstPct: 10,
  personName: (id: string) => ({ s1: "Ah Kow", p1: "Wai Mun" })[id] ?? "?",
};

describe("enquiryLanded", () => {
  it("is FOB x rate x (1 + SST) + shipping, with the total for the quantity", () => {
    // 3.85 x 4.5 x 1.1 + 0.4 = 19.4575
    expect(enquiryLanded(row(), 10)).toEqual({ perUnit: 19.46, total: 1946 });
  });

  it("uses the usual rate for the currency when none is keyed in", () => {
    expect(enquiryLanded(row({ currency: "RMB", fx: null }), 10)?.perUnit).toBe(
      // 3.85 x 0.6024 x 1.1 + 0.4 = 2.9513
      2.95,
    );
  });

  it("is nothing until there is a price", () => {
    expect(enquiryLanded(row({ fob: null }), 10)).toBeNull();
  });
});

describe("toEnquiryView", () => {
  it("names who raised it and who replied", () => {
    const view = toEnquiryView(row(), context);

    expect(view).toMatchObject({
      salespersonName: "Ah Kow",
      requestedByName: "Ah Kow",
      repliedByName: "Wai Mun",
      repliedAt: "2026-11-11T02:00:00Z",
    });
  });

  it("has no reply details while waiting", () => {
    const view = toEnquiryView(
      row({ fob: null, status: "pending", replied_by: null, replied_at: null }),
      context,
    );

    expect(view).toMatchObject({
      status: "pending",
      repliedByName: null,
      landed: null,
    });
  });
});

describe("splitEnquiries and searchEnquiries", () => {
  const views: EnquiryView[] = [
    toEnquiryView(
      row({
        id: "a",
        created_at: "2026-11-12T00:00:00Z",
        status: "pending",
        fob: null,
      }),
      context,
    ),
    toEnquiryView(
      row({
        id: "b",
        created_at: "2026-11-11T00:00:00Z",
        status: "pending",
        fob: null,
        product: "Rug",
      }),
      context,
    ),
    toEnquiryView(
      row({ id: "c", replied_at: "2026-11-12T00:00:00Z" }),
      context,
    ),
    toEnquiryView(
      row({ id: "d", replied_at: "2026-11-13T00:00:00Z" }),
      context,
    ),
  ];

  it("lists waiting ones oldest first and replied ones newest first", () => {
    const { pending, replied } = splitEnquiries(views);

    expect(pending.map((e) => e.id)).toEqual(["b", "a"]);
    expect(replied.map((e) => e.id)).toEqual(["d", "c"]);
  });

  it("finds enquiries by every word across product, supplier, quotation and salesperson", () => {
    expect(searchEnquiries(views, "rug sunrise").map((e) => e.id)).toEqual([
      "b",
    ]);
    expect(searchEnquiries(views, "ah kow gq5127")).toHaveLength(4);
    expect(searchEnquiries(views, "nothing")).toEqual([]);
    expect(searchEnquiries(views, "  ")).toHaveLength(4);
  });
});

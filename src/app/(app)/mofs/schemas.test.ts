import { describe, expect, it } from "vitest";
import {
  mofCostSchema,
  mofFormSchema,
  mofLineSchema,
  mofTotalChangeSchema,
} from "./schemas";

const SALES_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const MOF_ID = "33333333-3333-4333-8333-333333333333";

const line = (overrides: Record<string, string> = {}) => ({
  product: "Carpet Tile",
  stockType: "indent",
  supplier: "Unijoy",
  qty: "250",
  unit: "m2",
  areaM2: "",
  ...overrides,
});

const mof = (overrides: Record<string, unknown> = {}) => ({
  mofNo: " mof-2611 ",
  loaDate: "2026-11-02",
  salespersonId: SALES_ID,
  secondSalespersonId: "",
  projectId: "",
  companyName: "Lumen Interior Studio",
  projectName: "Corporate office, Bangsar",
  loaNo: "",
  quoteNo: "",
  siteAddress: "",
  siteContactName: "",
  siteContactMobile: "",
  officePicId: "",
  customerContact: "",
  accountsContact: "",
  scope: "s_and_l",
  installerName: "Leong",
  contractSum: "RM 12,500",
  voAmount: "",
  retentionPct: "5",
  invoiceNo: "",
  invoiceDate: "",
  commissionType: "own",
  deliveryDate: "",
  stage: "pending_order",
  latestUpdate: "",
  paymentChecked: "on",
  lines: [line()],
  ...overrides,
});

const errorPaths = (result: { error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join(".")) ?? [];

describe("mofLineSchema", () => {
  it("stores the area in m2 worked out from sqft", () => {
    const parsed = mofLineSchema.parse(line({ qty: "1000", unit: "sqft" }));
    expect(parsed.areaM2).toBe(92.9);
  });

  it("keeps the keyed-in area for rolls", () => {
    const parsed = mofLineSchema.parse(
      line({ qty: "3", unit: "roll", areaM2: "120.5" }),
    );
    expect(parsed).toMatchObject({ qty: 3, areaM2: 120.5 });
  });

  it("rejects a blank product, a negative quantity and an unknown unit", () => {
    expect(mofLineSchema.safeParse(line({ product: " " })).success).toBe(false);
    expect(mofLineSchema.safeParse(line({ qty: "-1" })).success).toBe(false);
    expect(mofLineSchema.safeParse(line({ unit: "box" })).success).toBe(false);
  });
});

describe("mofFormSchema", () => {
  it("parses a new MOF", () => {
    const parsed = mofFormSchema.parse(mof());
    expect(parsed).toMatchObject({
      mofNo: "MOF-2611",
      contractSum: 12500,
      voAmount: 0,
      retentionPct: 5,
      secondSalespersonId: null,
      invoiceDate: null,
      paymentChecked: true,
      approvalsInWriting: false,
      lines: [{ areaM2: 250 }],
    });
  });

  it("needs a contract sum and at least one line", () => {
    expect(
      errorPaths(mofFormSchema.safeParse(mof({ contractSum: "" }))),
    ).toContain("contractSum");
    expect(errorPaths(mofFormSchema.safeParse(mof({ lines: [] })))).toContain(
      "lines",
    );
  });

  it("allows an omission but not a total of zero or less", () => {
    expect(mofFormSchema.safeParse(mof({ voAmount: "-2500" })).success).toBe(
      true,
    );
    expect(
      errorPaths(mofFormSchema.safeParse(mof({ voAmount: "-12500" }))),
    ).toEqual(["voAmount"]);
  });

  it("rejects the same person as both salespeople", () => {
    expect(
      errorPaths(
        mofFormSchema.safeParse(mof({ secondSalespersonId: SALES_ID })),
      ),
    ).toEqual(["secondSalespersonId"]);
    expect(
      mofFormSchema.safeParse(mof({ secondSalespersonId: SECOND_ID })).success,
    ).toBe(true);
  });

  it("rejects retention above 100% and an unknown stage", () => {
    expect(
      errorPaths(mofFormSchema.safeParse(mof({ retentionPct: "101" }))),
    ).toEqual(["retentionPct"]);
    expect(
      errorPaths(mofFormSchema.safeParse(mof({ stage: "awarded" }))),
    ).toEqual(["stage"]);
  });
});

describe("mofTotalChangeSchema", () => {
  const change = (overrides: Record<string, string> = {}) => ({
    mofId: MOF_ID,
    contractSum: "12500",
    voAmount: "-400",
    reason: "CN-0412: 40 m² returned",
    ...overrides,
  });

  it("parses a change with a reason", () => {
    expect(mofTotalChangeSchema.parse(change())).toMatchObject({
      contractSum: 12500,
      voAmount: -400,
    });
  });

  it("rejects a change without a reason", () => {
    expect(
      errorPaths(mofTotalChangeSchema.safeParse(change({ reason: "  " }))),
    ).toEqual(["reason"]);
  });
});

describe("mofCostSchema", () => {
  it("parses RM and rejects a negative cost", () => {
    expect(mofCostSchema.parse({ mofId: MOF_ID, cost: "RM 8,000" }).cost).toBe(
      8000,
    );
    expect(mofCostSchema.safeParse({ mofId: MOF_ID, cost: "-1" }).success).toBe(
      false,
    );
  });
});

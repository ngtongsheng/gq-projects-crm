import { describe, expect, it } from "vitest";
import { customSampleStatus, daysOverdue } from "./custom-sample-status";
import type { CustomSampleLoan } from "./custom-sample-types";

const loan = (fields: Partial<CustomSampleLoan> = {}): CustomSampleLoan => ({
  id: "l1",
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

const sample = (loans: CustomSampleLoan[], givenOn: string | null = null) => ({
  givenOn,
  loans,
});

describe("customSampleStatus", () => {
  it("is available with no loan, or when every loan came back", () => {
    expect(customSampleStatus(sample([]))).toBe("available");
    expect(customSampleStatus(sample([loan({ backOn: "2026-11-10" })]))).toBe(
      "available",
    );
  });

  it("is on loan while a loan is open", () => {
    expect(customSampleStatus(sample([loan()]))).toBe("on-loan");
  });

  it("waits for the office once the borrower marked it returned", () => {
    expect(
      customSampleStatus(sample([loan({ returnedMarkedOn: "2026-11-12" })])),
    ).toBe("to-confirm");
  });

  it("is given away whatever the loans say", () => {
    expect(
      customSampleStatus(
        sample([loan({ returnedMarkedOn: "2026-11-12" })], "2026-11-13"),
      ),
    ).toBe("given");
  });
});

describe("daysOverdue", () => {
  it("counts the days past the due date", () => {
    expect(daysOverdue(sample([loan()]), "2026-11-17")).toBe(2);
  });

  it("is not overdue on the due date itself", () => {
    expect(daysOverdue(sample([loan()]), "2026-11-15")).toBe(0);
  });

  it("stops once the borrower marked it returned", () => {
    expect(
      daysOverdue(
        sample([loan({ returnedMarkedOn: "2026-11-16" })]),
        "2026-11-17",
      ),
    ).toBe(0);
  });

  it("ignores a loan that is closed and a sample with none", () => {
    expect(
      daysOverdue(sample([loan({ backOn: "2026-11-16" })]), "2026-11-17"),
    ).toBe(0);
    expect(daysOverdue(sample([]), "2026-11-17")).toBe(0);
  });
});

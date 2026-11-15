import { describe, expect, it } from "vitest";
import { needsOutcome, outcomeFormSchema } from "./outcome-schema";

const valid = {
  activityId: "55555555-5555-4555-8555-555555555555",
  result: "presented",
  learnings: "Joyce decides; two offices in Q1.",
  leadName: "",
  leadValue: "",
  leadStart: "",
  nextStep: "",
  nextDate: "",
};

const firstError = (fields: Partial<typeof valid>) => {
  const parsed = outcomeFormSchema.safeParse({ ...valid, ...fields });
  return parsed.success ? null : parsed.error.issues[0]?.message;
};

describe("outcomeFormSchema", () => {
  it("accepts a result and a sentence of learnings, with no lead or follow-up", () => {
    const parsed = outcomeFormSchema.parse(valid);
    expect(parsed).toMatchObject({
      result: "presented",
      leadName: null,
      leadStart: null,
      nextStep: null,
      nextDate: null,
    });
  });

  it("refuses learnings under 15 characters, after trimming", () => {
    expect(firstError({ learnings: "   Met Joyce.   " })).toMatch(
      /what you learned/,
    );
    expect(firstError({ learnings: "Met Joyce today" })).toBeNull();
  });

  it("requires a result", () => {
    expect(firstError({ result: "" })).toBe("Choose the result of the visit.");
  });

  it("asks for a follow-up date when a next step is written", () => {
    expect(firstError({ nextStep: "Send quotation" })).toMatch(
      /follow-up date/,
    );
    expect(
      firstError({ nextStep: "Send quotation", nextDate: "2026-11-20" }),
    ).toBeNull();
  });

  it("takes the expected start as a month", () => {
    expect(firstError({ leadStart: "2027-13" })).toMatch(/month/);
    expect(
      outcomeFormSchema.parse({ ...valid, leadStart: "2027-01" }).leadStart,
    ).toBe("2027-01");
  });
});

describe("needsOutcome", () => {
  const now = new Date("2026-11-15T04:00:00Z");

  it("flags a planned activity whose time has passed", () => {
    expect(
      needsOutcome(
        { status: "planned", startsAt: "2026-11-15T03:00:00Z" },
        now,
      ),
    ).toBe(true);
  });

  it("does not flag a later one, or one already completed or cancelled", () => {
    expect(
      needsOutcome(
        { status: "planned", startsAt: "2026-11-15T05:00:00Z" },
        now,
      ),
    ).toBe(false);
    expect(
      needsOutcome(
        { status: "completed", startsAt: "2026-11-14T03:00:00Z" },
        now,
      ),
    ).toBe(false);
    expect(
      needsOutcome(
        { status: "cancelled", startsAt: "2026-11-14T03:00:00Z" },
        now,
      ),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { projectFormSchema } from "./schemas";

const form = (fields: Record<string, string>) => ({
  contactId: "44444444-4444-4444-8444-444444444444",
  name: "Menara Ilham L12",
  leadSource: "referral",
  stage: "lead",
  qtySqft: "",
  value: "",
  picId: "11111111-1111-4111-8111-111111111111",
  supportId: "",
  commissionType: "own",
  passedBy: "",
  nextAction: "",
  nextActionDate: "",
  notes: "",
  ...fields,
});

describe("projectFormSchema", () => {
  it("rounds a typed quantity to 2 decimals the way the database does", () => {
    const parsed = projectFormSchema.parse(form({ qtySqft: "2.135" }));
    expect(parsed.qtySqft).toBe(2.14);
  });

  it("reads blank value and quantity as 0", () => {
    const parsed = projectFormSchema.parse(form({}));
    expect(parsed.value).toBe(0);
    expect(parsed.qtySqft).toBe(0);
  });

  it("refuses a value the database column cannot hold", () => {
    const result = projectFormSchema.safeParse(
      form({ value: "1,000,000,000,000" }),
    );
    expect(result.error?.issues[0]?.message).toBe("That value is too large.");
  });
});

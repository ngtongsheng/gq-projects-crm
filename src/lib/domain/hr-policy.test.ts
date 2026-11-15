import { describe, expect, it } from "vitest";
import { currentScheme, type PolicyDocument, splitPolicies } from "./hr-policy";

const document = (
  id: string,
  overrides: Partial<PolicyDocument> = {},
): PolicyDocument => ({
  id,
  category: "others",
  title: `Policy ${id}`,
  version: "v1",
  effectiveOn: "2026-01-01",
  isCommissionScheme: false,
  fileName: null,
  link: null,
  replacesId: null,
  note: "",
  ...overrides,
});

describe("splitPolicies", () => {
  it("marks a document Older once another one replaces it", () => {
    const { current, older } = splitPolicies([
      document("a"),
      document("b", { replacesId: "a", effectiveOn: "2026-06-01" }),
      document("c"),
    ]);
    expect(current.map((d) => d.id)).toEqual(["b", "c"]);
    expect(older.map((d) => d.id)).toEqual(["a"]);
  });

  it("keeps a whole chain of replaced versions as Older", () => {
    const { current, older } = splitPolicies([
      document("a", { effectiveOn: "2025-01-01" }),
      document("b", { replacesId: "a", effectiveOn: "2026-01-01" }),
      document("c", { replacesId: "b", effectiveOn: "2026-09-01" }),
    ]);
    expect(current.map((d) => d.id)).toEqual(["c"]);
    expect(older.map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("lists the newest effective date first, then by title", () => {
    const { current } = splitPolicies([
      document("a", { title: "Zebra", effectiveOn: "2026-03-01" }),
      document("b", { title: "Alpha", effectiveOn: "2026-03-01" }),
      document("c", { title: "Middle", effectiveOn: "2026-09-01" }),
    ]);
    expect(current.map((d) => d.id)).toEqual(["c", "b", "a"]);
  });
});

describe("currentScheme", () => {
  it("finds the commission scheme among the current documents", () => {
    const scheme = document("s", { isCommissionScheme: true });
    expect(currentScheme([document("a"), scheme])).toBe(scheme);
    expect(currentScheme([document("a")])).toBeUndefined();
  });
});

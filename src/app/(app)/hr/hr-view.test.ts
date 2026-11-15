import { describe, expect, it } from "vitest";
import { parseHrView } from "./hr-view";

describe("parseHrView", () => {
  it("reads a known view from the address", () => {
    expect(parseHrView("staff")).toBe("staff");
    expect(parseHrView("grades")).toBe("grades");
  });

  it("opens Policies & schemes for anything else", () => {
    expect(parseHrView(undefined)).toBe("policies");
    expect(parseHrView("nonsense")).toBe("policies");
    expect(parseHrView(["staff", "grades"])).toBe("policies");
  });
});

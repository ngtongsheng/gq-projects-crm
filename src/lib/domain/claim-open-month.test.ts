import { describe, expect, it } from "vitest";
import { openClaimMonth } from "./claim-open-month";

describe("openClaimMonth", () => {
  const base = { today: "2026-11-10", cutOffDay: 25 };

  it("opens this claim month when last month has no unfinished claim", () => {
    expect(openClaimMonth({ ...base, previous: null })).toBe("2026-11-01");
    expect(
      openClaimMonth({
        ...base,
        previous: { status: "submitted", lineCount: 3 },
      }),
    ).toBe("2026-11-01");
  });

  it("goes back to last month while its claim is a draft or returned with lines", () => {
    for (const status of ["draft", "returned"] as const) {
      expect(
        openClaimMonth({ ...base, previous: { status, lineCount: 2 } }),
      ).toBe("2026-10-01");
    }
  });

  it("ignores an empty unfinished claim", () => {
    expect(
      openClaimMonth({
        ...base,
        previous: { status: "draft", lineCount: 0 },
      }),
    ).toBe("2026-11-01");
  });

  it("counts days after the cut-off as next month's claim", () => {
    expect(
      openClaimMonth({ ...base, today: "2026-11-27", previous: null }),
    ).toBe("2026-12-01");
  });
});

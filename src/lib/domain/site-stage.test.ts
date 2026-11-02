import { describe, expect, it } from "vitest";
import { SITE_STAGES, siteStagePercent } from "./site-stage";

describe("siteStagePercent", () => {
  it("maps each stage to the prototype's percentage", () => {
    expect(SITE_STAGES.map(siteStagePercent)).toEqual([
      10, 25, 45, 60, 80, 100,
    ]);
  });

  it("only goes up as the site moves along", () => {
    const percents = SITE_STAGES.map(siteStagePercent);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
  });
});

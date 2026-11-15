import { describe, expect, it } from "vitest";
import {
  installationJobPercent,
  SITE_STAGES,
  type SiteStage,
  siteJobPercent,
  siteStagePercent,
  stageAfterVisit,
} from "./site-stage";

const visit = (done: Partial<Parameters<typeof stageAfterVisit>[1]>) => ({
  installation: false,
  handoverSigned: false,
  delivery: false,
  ...done,
});

describe("stageAfterVisit", () => {
  it("moves a site forward by what was done", () => {
    expect(stageAfterVisit("shipment", visit({ delivery: true }))).toBe(
      "delivered",
    );
    expect(stageAfterVisit("delivered", visit({ installation: true }))).toBe(
      "installation",
    );
    expect(
      stageAfterVisit("installation", visit({ handoverSigned: true })),
    ).toBe("completed");
  });

  it("lets a signed handover win over installation and delivery the same day", () => {
    expect(
      stageAfterVisit(
        "start",
        visit({ installation: true, handoverSigned: true, delivery: true }),
      ),
    ).toBe("completed");
    expect(
      stageAfterVisit("ongoing", visit({ installation: true, delivery: true })),
    ).toBe("installation");
  });

  it("never moves a stage backwards", () => {
    expect(stageAfterVisit("completed", visit({ installation: true }))).toBe(
      "completed",
    );
    expect(stageAfterVisit("installation", visit({ delivery: true }))).toBe(
      "installation",
    );
    expect(stageAfterVisit("completed", visit({ delivery: true }))).toBe(
      "completed",
    );
  });

  it("leaves the stage alone for other work", () => {
    for (const stage of SITE_STAGES) {
      expect(stageAfterVisit(stage, visit({}))).toBe(stage);
    }
  });
});

describe("siteJobPercent", () => {
  it("is 60% plus 35% of the installed share while installing, capped at 95%", () => {
    expect(installationJobPercent(0)).toBe(60);
    expect(installationJobPercent(50)).toBe(78);
    expect(installationJobPercent(100)).toBe(95);
    expect(siteJobPercent("installation", 40)).toBe(74);
  });

  it("uses the stage's percentage otherwise", () => {
    const stages: SiteStage[] = ["delivered", "completed"];
    expect(stages.map((stage) => siteJobPercent(stage, 40))).toEqual([60, 100]);
    expect(siteJobPercent("installation", null)).toBe(80);
  });
});

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

import { describe, expect, it } from "vitest";
import type { MofChoice, PipelineProject } from "./log-work-data";
import { wizardStart } from "./wizard-start";

const mof: MofChoice = {
  id: "m1",
  mofNo: "P15915547",
  projectName: "Menara ABC",
  companyName: "ABC Sdn Bhd",
  salespersonId: "s1",
  mine: true,
  lastInstalled: null,
};
const project: PipelineProject = {
  id: "p1",
  name: "Tower B fit-out",
  picId: "s2",
};
const none = {
  mofId: null,
  projectId: null,
  siteName: null,
  activity: null,
};

describe("wizardStart", () => {
  it("opens at the site step when the address names nothing", () => {
    const start = wizardStart(none, [mof], [project]);
    expect(start.step).toBe(1);
    expect(start.mode).toBeNull();
  });

  it("skips to the activities for a known job, with the planned activity ticked", () => {
    const start = wizardStart(
      { ...none, mofId: "m1", activity: "installation" },
      [mof],
      [project],
    );
    expect(start).toMatchObject({ step: 2, mode: "mof" });
    expect(start.draft.mofId).toBe("m1");
    expect(start.draft.activities).toEqual(["installation"]);
  });

  it("ignores a job that is no longer open", () => {
    expect(wizardStart({ ...none, mofId: "gone" }, [mof], []).step).toBe(1);
  });

  it("takes the salesperson and name from a pipeline project", () => {
    const start = wizardStart(
      { ...none, projectId: "p1", activity: "measurement" },
      [mof],
      [project],
    );
    expect(start).toMatchObject({ step: 2, mode: "new" });
    expect(start.draft).toMatchObject({
      projectId: "p1",
      salespersonId: "s2",
      siteName: "Tower B fit-out",
      activities: ["measurement"],
    });
  });

  it("does not tick an activity a site with no MOF cannot do", () => {
    const start = wizardStart(
      { ...none, projectId: "p1", activity: "installation" },
      [],
      [project],
    );
    expect(start.draft.activities).toEqual([]);
  });

  it("keeps a typed site name but still asks who the salesperson is", () => {
    const start = wizardStart({ ...none, siteName: "Menara XYZ" }, [], []);
    expect(start).toMatchObject({ step: 1, mode: "new" });
    expect(start.draft.siteName).toBe("Menara XYZ");
  });

  it("ignores an unknown activity", () => {
    expect(
      wizardStart({ ...none, mofId: "m1", activity: "others" }, [mof], []).draft
        .activities,
    ).toEqual([]);
  });
});

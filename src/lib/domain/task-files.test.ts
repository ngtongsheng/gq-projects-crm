import { describe, expect, it } from "vitest";
import { nextWorkVersion, submitLogBody, taskFileTag } from "./task-files";

describe("nextWorkVersion", () => {
  it("starts at 1 when no work has been sent", () => {
    expect(nextWorkVersion([])).toBe(1);
    expect(nextWorkVersion([{ kind: "reference", version: null }])).toBe(1);
  });

  it("is one above the highest work version, ignoring reference files", () => {
    expect(
      nextWorkVersion([
        { kind: "reference", version: null },
        { kind: "work", version: 1 },
        { kind: "work", version: 1 },
        { kind: "work", version: 2 },
      ]),
    ).toBe(3);
  });
});

describe("taskFileTag", () => {
  it("names reference files and work versions", () => {
    expect(taskFileTag({ kind: "reference", version: null })).toBe("reference");
    expect(taskFileTag({ kind: "work", version: 2 })).toBe("work v2");
  });
});

describe("submitLogBody", () => {
  it("adds the files and the note when there are any", () => {
    expect(submitLogBody("", 0, 1)).toBe("Submitted for review");
    expect(submitLogBody("Final", 1, 1)).toBe(
      "Submitted for review with 1 file (v1) · Final",
    );
    expect(submitLogBody("", 3, 2)).toBe(
      "Submitted for review with 3 files (v2)",
    );
  });
});

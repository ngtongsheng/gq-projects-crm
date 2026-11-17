import { describe, expect, it } from "vitest";
import { customSampleReminderText } from "./custom-sample-reminder";

const sample = {
  code: "TS-001",
  designNo: "GQ-HT-2611",
  designName: "Botanical swirl",
};

describe("customSampleReminderText", () => {
  it("names the sample, the customer and both dates", () => {
    expect(
      customSampleReminderText(
        sample,
        {
          customer: "Hotel Seri",
          project: "Lobby",
          outOn: "2026-11-01",
          dueOn: "2026-11-15",
        },
        "Vernice",
      ),
    ).toBe(
      "Hi Vernice, reminder from GQ office: the custom sample *TS-001 (GQ-HT-2611) Botanical swirl* you borrowed on 1 Nov 2026 for Hotel Seri – Lobby was due back on 15 Nov 2026. Please return it to the office as soon as possible. Thank you!",
    );
  });

  it("leaves out the project when there is none", () => {
    const text = customSampleReminderText(
      sample,
      {
        customer: "Hotel Seri",
        project: null,
        outOn: "2026-11-01",
        dueOn: "2026-11-15",
      },
      "Vernice",
    );
    expect(text).toContain("for Hotel Seri was due back");
  });
});

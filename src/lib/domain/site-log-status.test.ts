import { describe, expect, it } from "vitest";
import { measurementStatus, photosStatus } from "./site-log-status";

describe("measurementStatus", () => {
  const base = { to: "Aina", sentOn: null, received: false, receivedOn: null };

  it("is bad until the measurement is submitted", () => {
    expect(measurementStatus(base)).toMatchObject({
      text: "Not submitted yet",
      tone: "bad",
    });
  });

  it("waits on the salesperson once submitted", () => {
    expect(measurementStatus({ ...base, sentOn: "2026-11-10" })).toEqual({
      text: "Submitted to",
      who: "Aina",
      on: "2026-11-10",
      tone: "warn",
    });
  });

  it("is good once received, even if the send day was never recorded", () => {
    expect(
      measurementStatus({ ...base, received: true, receivedOn: "2026-11-11" }),
    ).toEqual({
      text: "Received by",
      who: "Aina",
      on: "2026-11-11",
      tone: "good",
    });
  });
});

describe("photosStatus", () => {
  const base = {
    activity: "shooting" as const,
    to: null,
    postedOn: null,
    savedBy: null,
    savedOn: null,
  };

  it("asks for the photos to be posted", () => {
    expect(photosStatus(base).text).toBe("Not submitted yet");
    expect(photosStatus({ ...base, activity: "handover" })).toMatchObject({
      text: "Completed photos not posted yet",
      tone: "bad",
    });
  });

  it("waits for sales support once posted", () => {
    expect(photosStatus({ ...base, postedOn: "2026-11-10" })).toMatchObject({
      text: "Posted, to save to Drive",
      tone: "warn",
    });
    expect(
      photosStatus({ ...base, postedOn: "2026-11-10", to: "Jess" }),
    ).toMatchObject({ text: "To save to Drive:", who: "Jess" });
  });

  it("is good once saved to Drive", () => {
    expect(
      photosStatus({
        ...base,
        postedOn: "2026-11-10",
        savedBy: "Jess",
        savedOn: "2026-11-11",
      }),
    ).toEqual({
      text: "Saved to Drive by",
      who: "Jess",
      on: "2026-11-11",
      tone: "good",
    });
  });
});

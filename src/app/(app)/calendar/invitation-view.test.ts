import { describe, expect, it } from "vitest";
import { invitationTag, isAwaitingReply } from "./invitation-view";

const ME = "me";
const ARUN = "arun";

describe("isAwaitingReply", () => {
  it("is true only while my own seat is pending", () => {
    const pending = [{ profile_id: ME, status: "pending" as const }];
    expect(isAwaitingReply(ARUN, pending, ME)).toBe(true);
    expect(
      isAwaitingReply(ARUN, [{ profile_id: ME, status: "declined" }], ME),
    ).toBe(false);
    expect(
      isAwaitingReply(ARUN, [{ profile_id: ME, status: "accepted" }], ME),
    ).toBe(false);
  });

  it("is false when someone else's seat is pending, or I own the activity", () => {
    expect(
      isAwaitingReply(ARUN, [{ profile_id: "siti", status: "pending" }], ME),
    ).toBe(false);
    expect(
      isAwaitingReply(ME, [{ profile_id: ME, status: "pending" }], ME),
    ).toBe(false);
  });
});

describe("invitationTag", () => {
  const base = { ownerName: "Mei", ownerIsMe: true, meId: ME };

  it("marks colleagues who have not replied with a question mark", () => {
    expect(
      invitationTag({
        ...base,
        invitees: [
          { profileId: ARUN, name: "Arun", status: "pending" },
          { profileId: "siti", name: "Siti", status: "accepted" },
        ],
      }),
    ).toBe("+ Arun ?, Siti");
  });

  it("leaves out colleagues who declined", () => {
    expect(
      invitationTag({
        ...base,
        invitees: [{ profileId: ARUN, name: "Arun", status: "declined" }],
      }),
    ).toBeUndefined();
  });

  it("tells an accepted colleague who they are going with", () => {
    expect(
      invitationTag({
        ownerName: "Arun",
        ownerIsMe: false,
        meId: ME,
        invitees: [{ profileId: ME, name: "Mei", status: "accepted" }],
      }),
    ).toBe("with Arun");
  });
});

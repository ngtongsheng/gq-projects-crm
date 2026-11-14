import { describe, expect, it } from "vitest";
import {
  type Impersonation,
  signImpersonation,
  verifyImpersonation,
} from "./impersonation";

const SECRET = "server-secret";
const NOW = Date.UTC(2026, 10, 5, 9, 0, 0);
const value: Impersonation = {
  adminId: "11111111-1111-4111-8111-111111111111",
  adminName: "Vicky",
  targetId: "22222222-2222-4222-8222-222222222222",
  logId: "33333333-3333-4333-8333-333333333333",
};

describe("impersonation cookie", () => {
  it("proves who is really signed in", () => {
    const token = signImpersonation(value, SECRET, NOW);
    expect(verifyImpersonation(token, SECRET, NOW + 1000)).toEqual(value);
  });

  it("rejects a cookie signed with another secret", () => {
    const token = signImpersonation(value, "other-secret", NOW);
    expect(verifyImpersonation(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a cookie whose person was changed", () => {
    const token = signImpersonation(value, SECRET, NOW);
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        ...value,
        adminId: "44444444-4444-4444-8444-444444444444",
        exp: NOW + 60_000,
      }),
    ).toString("base64url");
    expect(
      verifyImpersonation(`${forged}.${signature}`, SECRET, NOW),
    ).toBeNull();
  });

  it("rejects an expired cookie", () => {
    const token = signImpersonation(value, SECRET, NOW);
    const nineHoursLater = NOW + 9 * 60 * 60 * 1000;
    expect(verifyImpersonation(token, SECRET, nineHoursLater)).toBeNull();
  });

  it.each([undefined, "", "abc", "a.b.c", "."])("rejects %j", (token) => {
    expect(verifyImpersonation(token, SECRET, NOW)).toBeNull();
  });

  it("rejects everything when the server has no secret", () => {
    const token = signImpersonation(value, SECRET, NOW);
    expect(verifyImpersonation(token, undefined, NOW)).toBeNull();
  });
});

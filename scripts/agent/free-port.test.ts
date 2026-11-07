import { describe, expect, it } from "vitest";
import { parseLockPid, parseNetstatListeners } from "./free-port.mjs";

const NETSTAT = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1032
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4812
  TCP    [::]:3000              [::]:0                 LISTENING       4812
  TCP    127.0.0.1:3000         127.0.0.1:51234        ESTABLISHED     4812
  TCP    127.0.0.1:51234        127.0.0.1:3000         ESTABLISHED     9001
  TCP    0.0.0.0:30001          0.0.0.0:0              ABHÖREN         7777
  UDP    0.0.0.0:3000           *:*                                    5555
`;

describe("parseNetstatListeners", () => {
  it("returns each process listening on the port once", () => {
    expect(parseNetstatListeners(NETSTAT, 3000)).toEqual([4812]);
  });

  it("ignores connections to the port and longer port numbers", () => {
    expect(parseNetstatListeners(NETSTAT, 51234)).toEqual([]);
    expect(parseNetstatListeners(NETSTAT, 30001)).toEqual([7777]);
  });

  it("handles Windows line endings and empty output", () => {
    expect(
      parseNetstatListeners(NETSTAT.replaceAll("\n", "\r\n"), 135),
    ).toEqual([1032]);
    expect(parseNetstatListeners("", 3000)).toEqual([]);
  });
});

describe("parseLockPid", () => {
  it("reads the pid from the dev server lock", () => {
    expect(parseLockPid('{"pid":4242,"port":3000}')).toBe(4242);
  });

  it("returns null for anything else", () => {
    expect(parseLockPid("")).toBeNull();
    expect(parseLockPid("not json")).toBeNull();
    expect(parseLockPid('{"pid":"x"}')).toBeNull();
  });
});

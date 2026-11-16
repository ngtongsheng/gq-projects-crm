import { describe, expect, it } from "vitest";
import { attachFile, UPLOAD_FAILED_MESSAGE } from "./attach-file";

const pdf = () => new File(["x"], "slip.pdf", { type: "application/pdf" });

describe("attachFile", () => {
  it("reports the file name once it is sent", async () => {
    const result = await attachFile(pdf(), async () => ({ ok: true }));
    expect(result).toEqual({ ok: true, name: "slip.pdf" });
  });

  it("passes on the reason the module gave for refusing the file", async () => {
    const result = await attachFile(pdf(), async () => ({
      ok: false,
      error: "Not yours.",
    }));
    expect(result).toEqual({ ok: false, error: "Not yours." });
  });

  it("turns a rejected upload into a failure message", async () => {
    const result = await attachFile(pdf(), async () => {
      throw new Error("network down");
    });
    expect(result).toEqual({ ok: false, error: UPLOAD_FAILED_MESSAGE });
  });

  it("rejects a file of the wrong type without sending it", async () => {
    let sent = false;
    const result = await attachFile(
      new File(["x"], "a.exe", { type: "application/x-msdownload" }),
      async () => {
        sent = true;
        return { ok: true };
      },
    );
    expect(result.ok).toBe(false);
    expect(sent).toBe(false);
  });
});

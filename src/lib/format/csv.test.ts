import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const body = (csv: string) => csv.replace(/^﻿/, "");

describe("toCsv", () => {
  it("starts with a BOM and ends rows with CRLF", () => {
    const csv = toCsv(["A", "B"], [["x", "y"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(body(csv)).toBe("A,B\r\nx,y\r\n");
  });

  it("quotes cells with commas, quotes and newlines", () => {
    const csv = toCsv(["Note"], [["a, b"], ['say "hi"'], ["line1\nline2"]]);
    expect(body(csv)).toBe(
      'Note\r\n"a, b"\r\n"say ""hi"""\r\n"line1\nline2"\r\n',
    );
  });

  it("writes numbers plain and null as empty", () => {
    expect(body(toCsv(["RM", "Qty", "Note"], [[1234.5, -2, null]]))).toBe(
      "RM,Qty,Note\r\n1234.5,-2,\r\n",
    );
  });

  it.each([
    "=SUM(A1)",
    "+60123",
    "-1+1",
    "@cmd",
    "\tx",
    "\rx",
  ])("defuses a formula start in %j", (cell) => {
    const out = body(toCsv(["A"], [[cell]])).split("\r\n")[1];
    expect(out.replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("leaves ordinary text alone", () => {
    expect(body(toCsv(["A"], [["Carpet m²"]]))).toBe("A\r\nCarpet m²\r\n");
  });
});

import { describe, expect, it } from "vitest";
import { mapPaste, parseTsv } from "./parse-tsv";

describe("parseTsv", () => {
  it("splits tabs and line ends, CRLF included", () => {
    expect(parseTsv("a\tb\r\nc\td\ne\tf\rg\th")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
      ["g", "h"],
    ]);
  });

  it("keeps tabs, line breaks and doubled quotes inside quoted cells", () => {
    expect(
      parseTsv('"one\ttwo"\t"line 1\r\nline 2"\t"say ""hi"""\r\n'),
    ).toEqual([["one\ttwo", "line 1\r\nline 2", 'say "hi"']]);
  });

  it("treats a quote inside an unquoted cell as text", () => {
    expect(parseTsv('12" tile\tx')).toEqual([['12" tile', "x"]]);
  });

  it("drops trailing blank rows, empty-cell rows and a BOM", () => {
    expect(parseTsv("﻿a\tb\r\n\t\r\n\r\n")).toEqual([["a", "b"]]);
  });

  it("keeps empty cells between tabs", () => {
    expect(parseTsv("a\t\tc")).toEqual([["a", "", "c"]]);
  });
});

describe("mapPaste", () => {
  const fields = [
    { key: "name", label: "Name", required: true },
    { key: "mobile", label: "Mobile", aliases: ["HP no"], required: true },
    { key: "notes", label: "Notes" },
  ] as const;

  it("matches headers by label or alias, ignoring case and punctuation", () => {
    const paste = mapPaste("H.P. No\tNAME\tColour\nO12\tAli\tred", fields);
    expect(paste.columns).toEqual(["mobile", "name"]);
    expect(paste.ignored).toEqual(["Colour"]);
    expect(paste.missing).toEqual([]);
    expect(paste.records).toEqual([
      { line: 2, cells: { name: "Ali", mobile: "O12", notes: "" } },
    ]);
  });

  it("reports required fields with no column", () => {
    expect(mapPaste("Name\nAli", fields).missing).toEqual(["Mobile"]);
  });

  it("fills short rows with blanks and trims cells", () => {
    const paste = mapPaste("Name\tMobile\tNotes\n  Ali  ", fields);
    expect(paste.records[0]?.cells).toEqual({
      name: "Ali",
      mobile: "",
      notes: "",
    });
  });
});

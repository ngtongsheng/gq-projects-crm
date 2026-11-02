import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildImportPlan, countActions, toImportPreview } from "./import-plan";
import { mapPaste } from "./parse-tsv";

const fields = [
  { key: "name", label: "Name", required: true },
  { key: "qty", label: "Qty" },
] as const;

const schema = z.object({
  name: z.string().min(1, "Enter the name."),
  qty: z.coerce.number<string>().int("Qty must be a whole number."),
});

const plan = (text: string, onDuplicate: "skip" | "update" = "skip") =>
  buildImportPlan({
    paste: mapPaste(text, fields),
    schema,
    keyOf: (row) => row.name.toLowerCase(),
    existing: new Map([["tile", "id-tile"]]),
    onDuplicate,
  });

describe("buildImportPlan", () => {
  it("adds new rows and marks bad rows with the schema's messages", () => {
    const { rows } = plan("Name\tQty\nRug\t2\n\t1.5");
    expect(rows.map((row) => row.action)).toEqual(["add", "invalid"]);
    expect(rows[0]?.row).toEqual({ name: "Rug", qty: 2 });
    expect(rows[1]?.errors).toEqual([
      "Enter the name.",
      "Qty must be a whole number.",
    ]);
  });

  it("skips or updates rows already in the CRM, per the choice", () => {
    expect(plan("Name\tQty\nTILE\t1").rows[0]).toMatchObject({
      action: "skip",
      existingId: "id-tile",
    });
    expect(plan("Name\tQty\nTILE\t1", "update").rows[0]).toMatchObject({
      action: "update",
      existingId: "id-tile",
    });
  });

  it("rejects a row repeating an earlier pasted row", () => {
    const { rows } = plan("Name\tQty\nRug\t1\nrug\t2");
    expect(rows[1]).toMatchObject({
      action: "invalid",
      errors: ["Same as row 2."],
    });
  });

  it("marks every row invalid when a required column is missing", () => {
    const { rows } = plan("Qty\n1\n2");
    expect(rows.map((row) => row.errors)).toEqual([
      ['Add a "Name" column.'],
      ['Add a "Name" column.'],
    ]);
  });
});

describe("toImportPreview", () => {
  it("lists cells in pasted column order and counts actions", () => {
    const result = plan("Qty\tName\n3\tRug\nx\tTile");
    const preview = toImportPreview(result, fields);
    expect(preview.headers).toEqual(["Qty", "Name"]);
    expect(preview.rows[0]?.cells).toEqual(["3", "Rug"]);
    expect(countActions(preview.rows)).toEqual({
      add: 1,
      update: 0,
      skip: 0,
      invalid: 1,
    });
  });
});

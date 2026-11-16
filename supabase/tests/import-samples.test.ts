import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 18 task 08: "Paste from Excel" on the Samples page.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

const importRows = (rows: object[]) =>
  t.db.query("select public.import_samples($1)", [JSON.stringify(rows)]);

async function sampleBySku(sku: string) {
  const { rows } = await t.db.query<{
    id: string;
    qty: string;
    spec: string | null;
  }>("select id, qty, spec from public.samples where sku = $1", [sku]);
  return rows[0];
}

describe("import_samples", () => {
  it("adds new samples with their history", async () => {
    await t.actAs("support");
    await importRows([
      {
        product: "Carpet Tile",
        brand: "Unijoy",
        sku: "IMP-01",
        name: "Dawn",
        qty: "2",
        unit: "box",
        spec: null,
        notes: null,
      },
    ]);
    const added = await sampleBySku("IMP-01");
    expect(Number(added.qty)).toBe(2);
    const { rows } = await t.db.query<{ kind: string }>(
      "select kind from public.sample_moves where sample_id = $1",
      [added.id],
    );
    expect(rows).toEqual([{ kind: "adjust" }]);
  });

  it("updates the pasted columns and logs a changed quantity", async () => {
    await t.actAs("support");
    const before = await sampleBySku("IMP-01");
    await importRows([{ id: before.id, qty: "5", spec: "50x50cm" }]);
    const after = await sampleBySku("IMP-01");
    expect(Number(after.qty)).toBe(5);
    expect(after.spec).toBe("50x50cm");
    const { rows } = await t.db.query<{ qty_before: string }>(
      "select qty_before from public.sample_moves where sample_id = $1 and qty = 5",
      [before.id],
    );
    expect(rows[0].qty_before).toBe("2.00");
  });

  it("leaves the history alone when the quantity is the same", async () => {
    await t.actAs("support");
    const before = await sampleBySku("IMP-01");
    await importRows([{ id: before.id, qty: "5" }]);
    const { rows } = await t.db.query<{ n: string }>(
      "select count(*) as n from public.sample_moves where sample_id = $1",
      [before.id],
    );
    expect(Number(rows[0].n)).toBe(2);
  });

  it("is refused for people who do not look after samples", async () => {
    await t.actAs("sales");
    await expect(
      importRows([{ product: "SPC", sku: "IMP-02", qty: "1", unit: "pc" }]),
    ).rejects.toThrow();
  });
});

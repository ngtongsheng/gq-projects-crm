import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 18 task 07 (D4): samples at Best Link, their move log and SR-0001 pickup forms.

let t: TestDatabase;

async function addSample(sku: string, qty: number, unit = "pc") {
  await t.actAs("support");
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.samples (product, brand, sku, name, qty, unit)
     values ('Carpet Tile', 'Unijoy', $1, $1, $2, $3) returning id`,
    [sku, qty, unit],
  );
  return rows[0].id;
}

async function atBestLink(sampleId: string) {
  const { rows } = await t.db.query<{ qty: string }>(
    "select qty from public.samples where id = $1",
    [sampleId],
  );
  return Number(rows[0].qty);
}

async function takeOut(sampleId: string, qty: number, kind = "out") {
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.sample_moves (sample_id, kind, qty, taken_by, for_whom)
     values ($1, $2, $3, $4, 'SLA Architects') returning id`,
    [sampleId, kind, qty, t.profileIds.sales],
  );
  return rows[0].id;
}

async function savePickup(lines: object[]) {
  const { rows } = await t.db.query<{ pickup_id: string; running_no: number }>(
    "select * from public.save_sample_pickup($1, $2)",
    [
      {
        person_in_charge: "Wai Mun",
        contact: "012-3723925",
        method: "lalamove",
        appointment_on: "2026-11-20",
      },
      JSON.stringify(lines),
    ],
  );
  return rows[0];
}

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

describe("a sample's quantity at Best Link", () => {
  it("starts its history with the quantity added", async () => {
    const id = await addSample("XCH-03", 3);
    const { rows } = await t.db.query<{
      kind: string;
      qty: string;
      qty_before: string;
    }>(
      "select kind, qty, qty_before from public.sample_moves where sample_id = $1",
      [id],
    );
    expect(rows).toEqual([{ kind: "adjust", qty: "3.00", qty_before: "0.00" }]);
    expect(await atBestLink(id)).toBe(3);
  });

  it("goes down on take out and up again when it is back", async () => {
    const id = await addSample("XCH-04", 3);
    const moveId = await takeOut(id, 2);
    expect(await atBestLink(id)).toBe(1);

    await t.db.query(
      "update public.sample_moves set back_on = current_date where id = $1",
      [moveId],
    );
    expect(await atBestLink(id)).toBe(3);

    const { rows } = await t.db.query<{ back_by: string }>(
      "select back_by from public.sample_moves where id = $1",
      [moveId],
    );
    expect(rows[0].back_by).toBe(t.profileIds.support);
  });

  it("comes back only once", async () => {
    const id = await addSample("XCH-05", 2);
    const moveId = await takeOut(id, 1);
    await t.db.query(
      "update public.sample_moves set back_on = current_date where id = $1",
      [moveId],
    );
    await expect(
      t.db.query(
        "update public.sample_moves set back_on = current_date + 1 where id = $1",
        [moveId],
      ),
    ).rejects.toThrow(/come back, once/);
    expect(await atBestLink(id)).toBe(2);
  });

  it("stays down when the client keeps it", async () => {
    const id = await addSample("XCH-06", 2);
    const moveId = await takeOut(id, 1, "kept");
    expect(await atBestLink(id)).toBe(1);
    await expect(
      t.db.query(
        "update public.sample_moves set back_on = current_date where id = $1",
        [moveId],
      ),
    ).rejects.toThrow(/come back, once/);
  });

  it("cannot go below what is at Best Link", async () => {
    const id = await addSample("XCH-07", 1);
    await expect(takeOut(id, 2)).rejects.toThrow(/Only 1 pc at Best Link/);
    expect(await atBestLink(id)).toBe(1);
  });

  it("is set by an adjust move, which keeps the old quantity", async () => {
    const id = await addSample("XCH-08", 1);
    await t.db.query(
      "insert into public.sample_moves (sample_id, kind, qty) values ($1, 'adjust', 5)",
      [id],
    );
    expect(await atBestLink(id)).toBe(5);
    const { rows } = await t.db.query<{ qty_before: string }>(
      "select qty_before from public.sample_moves where sample_id = $1 and qty = 5",
      [id],
    );
    expect(rows[0].qty_before).toBe("1.00");
  });

  it("cannot be written directly", async () => {
    const id = await addSample("XCH-09", 1);
    await expect(
      t.db.query("update public.samples set qty = 9 where id = $1", [id]),
    ).rejects.toThrow(/permission denied/);
  });

  it("is edited by marketing and accounts, not by sales", async () => {
    await t.actAs("marketing");
    await t.db.query(
      "insert into public.samples (product, name, qty) values ('Vinyl Tile', 'Oak', 1)",
    );
    await t.actAs("accounts");
    await t.db.query(
      "insert into public.samples (product, name, qty) values ('Vinyl Tile', 'Ash', 1)",
    );
    await t.actAs("sales");
    await expect(
      t.db.query(
        "insert into public.samples (product, name, qty) values ('Vinyl Tile', 'Elm', 1)",
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("can be removed with samples still out", async () => {
    const id = await addSample("XCH-10", 2);
    await takeOut(id, 1);
    await t.db.query("delete from public.samples where id = $1", [id]);
    const { rows } = await t.db.query(
      "select 1 from public.sample_moves where sample_id = $1",
      [id],
    );
    expect(rows).toEqual([]);
  });

  it("is one line per SKU and brand", async () => {
    await addSample("DUP-01", 1);
    await expect(addSample("DUP-01", 1)).rejects.toThrow(
      /samples_brand_sku_key/,
    );
  });
});

describe("saving a pickup form", () => {
  it("takes its samples out of Best Link and numbers the form", async () => {
    const tile = await addSample("PRI-04", 4);
    const box = await addSample("STT-04", 2, "box");
    const form = await savePickup([
      { sample_id: tile, product_name: "PRI-04", qty: 3, unit: "pc" },
      { sample_id: box, product_name: "STT-04", qty: 1, unit: "box" },
      { product_name: "Catalogue 2026", qty: 2, unit: "catalogue" },
    ]);
    expect(await atBestLink(tile)).toBe(1);
    expect(await atBestLink(box)).toBe(1);

    const { rows } = await t.db.query<{ n: number }>(
      "select count(*)::int as n from public.sample_moves where pickup_id = $1 and kind = 'out'",
      [form.pickup_id],
    );
    expect(rows[0].n).toBe(2);
    const lines = await t.db.query<{ position: number }>(
      "select position from public.sample_pickup_lines where pickup_id = $1 order by position",
      [form.pickup_id],
    );
    expect(lines.rows.map((line) => line.position)).toEqual([1, 2, 3]);
  });

  it("saves nothing when a row asks for more than is at Best Link", async () => {
    const id = await addSample("PRI-05", 1);
    const before = await t.db.query<{ n: number }>(
      "select public.next_sample_pickup_number() as n",
    );
    await expect(
      savePickup([
        { sample_id: id, product_name: "PRI-05", qty: 2, unit: "pc" },
      ]),
    ).rejects.toThrow(/Only 1 pc at Best Link/);
    expect(await atBestLink(id)).toBe(1);
    const after = await t.db.query<{ n: number }>(
      "select public.next_sample_pickup_number() as n",
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("refuses a row in another unit than the sample", async () => {
    const id = await addSample("PRI-06", 5);
    await expect(
      savePickup([
        { sample_id: id, product_name: "PRI-06", qty: 1, unit: "box" },
      ]),
    ).rejects.toThrow(/counted in pc/);
  });

  it("is refused for sales", async () => {
    await t.actAs("sales");
    await expect(
      savePickup([{ product_name: "Catalogue", qty: 1, unit: "catalogue" }]),
    ).rejects.toThrow(/Only the people who look after samples/);
  });

  it("returns its samples when the form is removed", async () => {
    const id = await addSample("PRI-07", 3);
    const form = await savePickup([
      { sample_id: id, product_name: "PRI-07", qty: 2, unit: "pc" },
    ]);
    expect(await atBestLink(id)).toBe(1);
    await t.db.query("delete from public.sample_pickups where id = $1", [
      form.pickup_id,
    ]);
    expect(await atBestLink(id)).toBe(3);
  });
});

describe("pickup form numbers", () => {
  it("start at SR-0001 and go up by one", async () => {
    const fresh = await createTestDatabase();
    try {
      await fresh.actAs("support");
      const save = async () => {
        const { rows } = await fresh.db.query<{ running_no: number }>(
          "select * from public.save_sample_pickup($1, $2)",
          [
            {
              person_in_charge: "Lisa",
              contact: "012",
              method: "self_pickup",
              appointment_on: "2026-11-20",
            },
            JSON.stringify([
              { product_name: "Catalogue", qty: 1, unit: "catalogue" },
            ]),
          ],
        );
        return rows[0].running_no;
      };
      expect(await save()).toBe(1);
      expect(await save()).toBe(2);
    } finally {
      await fresh.close();
    }
  });

  it("never reuse a removed form's number", async () => {
    await t.actAs("support");
    const form = await savePickup([
      { product_name: "Catalogue", qty: 1, unit: "catalogue" },
    ]);
    await t.db.query("delete from public.sample_pickups where id = $1", [
      form.pickup_id,
    ]);
    const { rows } = await t.db.query<{ running_no: number }>(
      "select running_no from public.cancelled_sample_pickup_numbers",
    );
    expect(rows.map((row) => row.running_no)).toContain(form.running_no);

    const next = await savePickup([
      { product_name: "Catalogue", qty: 1, unit: "catalogue" },
    ]);
    expect(next.running_no).toBe(form.running_no + 1);
  });

  it("serialise savers on the settings row lock", async () => {
    // PGlite has one connection; race-freedom comes from `for update` on the one settings row.
    const { rows } = await t.db.query<{ src: string }>(
      "select prosrc as src from pg_proc where proname = 'save_sample_pickup'",
    );
    expect(rows[0].src).toMatch(
      /from public\.sample_pickup_settings for update/,
    );
  });

  it("can be moved on once, past the last number used", async () => {
    await t.actAs("accounts");
    const { rows } = await t.db.query<{ last: number }>(
      "select public.last_sample_pickup_number() as last",
    );
    const last = rows[0].last;
    await expect(
      t.db.query("select public.set_next_sample_pickup_number($1)", [last]),
    ).rejects.toThrow(/higher than the last number used/);
    await t.db.query("select public.set_next_sample_pickup_number($1)", [
      last + 20,
    ]);
    const next = await savePickup([
      { product_name: "Catalogue", qty: 1, unit: "catalogue" },
    ]);
    expect(next.running_no).toBe(last + 20);
  });

  it("cannot be written directly", async () => {
    await t.actAs("md");
    await expect(
      t.db.query("update public.sample_pickup_settings set next_no = 1"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.db.query(
        "insert into public.cancelled_sample_pickup_numbers (running_no) values (9000)",
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("pickup settings", () => {
  it("keep the Best Link number and Drive folder, set by sample editors", async () => {
    await t.actAs("marketing");
    await t.db.query(
      `update public.sample_pickup_settings
       set best_link_whatsapp = '60123723925', drive_folder_url = 'https://drive.google.com/x'`,
    );
    await t.actAs("sales");
    const { rows } = await t.db.query<{ best_link_whatsapp: string }>(
      "select best_link_whatsapp from public.sample_pickup_settings",
    );
    expect(rows[0].best_link_whatsapp).toBe("60123723925");
    const { affectedRows } = await t.db.query(
      "update public.sample_pickup_settings set drive_folder_url = 'https://evil.example'",
    );
    expect(affectedRows).toBe(0);
  });
});

describe("people who left", () => {
  it("see no samples", async () => {
    await addSample("LEFT-01", 1);
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set active = false where id = $1",
      [t.profileIds.designer],
    );
    await t.actAs("designer");
    const { rows } = await t.db.query("select 1 from public.samples");
    expect(rows).toEqual([]);
  });
});

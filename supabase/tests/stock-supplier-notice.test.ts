import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addProject } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 18 task 06 (D6): the database notes which supplier email a stock line still needs.

let t: TestDatabase;
let itemId: string;
let projectId: string;

beforeAll(async () => {
  t = await createTestDatabase();
  projectId = await addProject(t);
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.stock_items (sku, supplier, qty, unit)
     values ('SKU-N', 'Supplier', 100000, 'box') returning id`,
  );
  itemId = rows[0].id;
});

afterAll(async () => {
  await t.close();
});

async function addLine(status: "requested" | "reserved") {
  await t.actAs(null);
  const held = status === "reserved";
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.stock_reservations
       (item_id, qty, project_id, reserved_by, status, reserved_at, expires_on)
     values ($1, 1, $2, $3, $4, $5, $6) returning id`,
    [
      itemId,
      projectId,
      t.profileIds.sales,
      status,
      held ? "2026-11-01" : null,
      held ? "2026-11-15" : null,
    ],
  );
  await t.actAs("md");
  return rows[0].id;
}

async function notice(id: string) {
  const { rows } = await t.db.query<{
    supplier_notice: string | null;
    sent: boolean;
  }>(
    `select supplier_notice, supplier_notified_at is not null as sent
     from public.stock_reservations where id = $1`,
    [id],
  );
  return rows[0];
}

const markSent = (id: string) =>
  t.db.query(
    "update public.stock_reservations set supplier_notified_at = now() where id = $1",
    [id],
  );

describe("supplier notice", () => {
  it("asks for nothing while a request waits for confirmation", async () => {
    const id = await addLine("requested");
    expect(await notice(id)).toEqual({ supplier_notice: null, sent: false });
  });

  it("asks to reserve when stock is recorded already held", async () => {
    const id = await addLine("reserved");
    expect(await notice(id)).toEqual({
      supplier_notice: "reserve",
      sent: false,
    });
  });

  it("asks to reserve when a request is confirmed", async () => {
    const id = await addLine("requested");
    await t.db.query(
      `update public.stock_reservations
       set status = 'reserved', reserved_at = '2026-11-01', expires_on = '2026-11-15'
       where id = $1`,
      [id],
    );
    expect(await notice(id)).toEqual({
      supplier_notice: "reserve",
      sent: false,
    });
  });

  it("asks to extend after the supplier was told, and again after each extension", async () => {
    const id = await addLine("reserved");
    await markSent(id);
    expect(await notice(id)).toEqual({
      supplier_notice: "reserve",
      sent: true,
    });

    await t.db.query(
      "update public.stock_reservations set expires_on = '2026-11-29' where id = $1",
      [id],
    );
    expect(await notice(id)).toEqual({
      supplier_notice: "extend",
      sent: false,
    });
  });

  it("keeps a reserve email that was never sent when the hold is extended", async () => {
    const id = await addLine("reserved");
    await t.db.query(
      "update public.stock_reservations set expires_on = '2026-11-29' where id = $1",
      [id],
    );
    expect(await notice(id)).toEqual({
      supplier_notice: "reserve",
      sent: false,
    });
  });

  it("asks to release when a hold is released", async () => {
    const id = await addLine("reserved");
    await markSent(id);
    await t.db.query(
      "update public.stock_reservations set status = 'released' where id = $1",
      [id],
    );
    expect(await notice(id)).toEqual({
      supplier_notice: "release",
      sent: false,
    });
  });

  it("does not change the notice when only the status moves to PO issued", async () => {
    const id = await addLine("reserved");
    await markSent(id);
    await t.db.query(
      "update public.stock_reservations set status = 'po_issued' where id = $1",
      [id],
    );
    expect(await notice(id)).toEqual({
      supplier_notice: "reserve",
      sent: true,
    });
  });

  it("lets nobody set the notice by hand", async () => {
    const id = await addLine("requested");
    await expect(
      t.db.query(
        "update public.stock_reservations set supplier_notice = 'release' where id = $1",
        [id],
      ),
    ).rejects.toThrow();
  });
});

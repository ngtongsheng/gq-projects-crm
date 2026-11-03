import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addProject } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 audit: a stock reservation follows requested -> reserved -> PO issued -> delivered,
// or ends released or cancelled. Mirrors MOVES in src/lib/domain/reservation.ts.

let t: TestDatabase;
let itemId: string;
let projectId: string;
let skuCounter = 0;

beforeAll(async () => {
  t = await createTestDatabase();
  projectId = await addProject(t);
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.stock_items (sku, supplier, qty, unit)
     values ('SKU-1', 'Supplier', 100000, 'box') returning id`,
  );
  itemId = rows[0].id;
});

afterAll(async () => {
  await t.close();
});

// The held statuses need their dates; the others take them or not, so one shape fits all.
async function addReservation(status: string) {
  await t.actAs(null);
  const held = status !== "requested" && status !== "cancelled";
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.stock_reservations
       (item_id, qty, project_id, reserved_by, status, reserved_at, expires_on, note)
     values ($1, 1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      itemId,
      projectId,
      t.profileIds.sales,
      status,
      held ? "2026-01-01" : null,
      held ? "2026-02-01" : null,
      `line ${++skuCounter}`,
    ],
  );
  await t.actAs("md");
  return rows[0].id;
}

function moveTo(id: string, status: string) {
  const held = status === "reserved" || status === "po_issued";
  return t.db.query(
    `update public.stock_reservations
     set status = $1, reserved_at = $2, expires_on = $3 where id = $4`,
    [status, held ? "2026-01-01" : null, held ? "2026-02-01" : null, id],
  );
}

describe("allowed moves", () => {
  it.each([
    ["requested", "reserved"],
    ["requested", "cancelled"],
    ["reserved", "po_issued"],
    ["reserved", "delivered"],
    ["reserved", "released"],
    ["po_issued", "delivered"],
    ["po_issued", "released"],
  ])("%s to %s", async (from, to) => {
    const id = await addReservation(from);
    await expect(moveTo(id, to)).resolves.toMatchObject({ affectedRows: 1 });
  });

  it("keeps the same status while extending the hold", async () => {
    const id = await addReservation("reserved");
    await expect(
      t.db.query(
        "update public.stock_reservations set expires_on = '2026-03-01' where id = $1",
        [id],
      ),
    ).resolves.toMatchObject({ affectedRows: 1 });
  });
});

describe("refused moves", () => {
  it.each([
    ["requested", "delivered"],
    ["requested", "po_issued"],
    ["reserved", "requested"],
    ["po_issued", "reserved"],
    ["delivered", "reserved"],
    ["released", "reserved"],
    ["cancelled", "requested"],
  ])("%s to %s", async (from, to) => {
    const id = await addReservation(from);
    await expect(moveTo(id, to)).rejects.toThrow(
      `A reservation cannot move from ${from} to ${to}.`,
    );
  });
});

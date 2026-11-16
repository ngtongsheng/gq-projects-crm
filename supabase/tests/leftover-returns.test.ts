import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMof, addProject } from "./fixtures";
import {
  applyMigrations,
  createTestDatabase,
  type TestDatabase,
} from "./harness";

// Loop 18 task 09 (D5): leftover stock gains "Collected by supervisor", transport, supplier,
// keep reason, credit note audit and uses for other projects that never exceed what is left.

const MIGRATION = "20261118170000_leftover_returns.sql";

let t: TestDatabase;
let mofId: string;
let projectId: string;

async function addLeftover(
  status = "pending_pickup",
  destination = "supplier",
  qty = 10,
) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.leftovers (mof_id, item, qty, unit, condition, destination, status)
     values ($1, 'Carpet tile', $2, 'box', 'good', $3, $4) returning id`,
    [mofId, qty, destination, status],
  );
  return rows[0].id;
}

async function leftover(id: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<Record<string, unknown>>(
    "select * from public.leftovers where id = $1",
    [id],
  );
  return rows[0];
}

function allocate(leftoverId: string, qty: number) {
  return t.db.query(
    `insert into public.leftover_allocations (leftover_id, project_id, qty)
     values ($1, $2, $3)`,
    [leftoverId, projectId, qty],
  );
}

beforeAll(async () => {
  t = await createTestDatabase();
  mofId = await addMof(t);
  projectId = await addProject(t);
});

afterAll(async () => {
  await t.close();
});

describe("existing leftover rows", () => {
  it("keep every value and start the new columns empty", async () => {
    const before = await createTestDatabase({ migrationsBefore: MIGRATION });
    await before.actAs(null);
    const {
      rows: [mof],
    } = await before.db.query<{ id: string }>(
      `insert into public.mofs (mof_no, loa_date, salesperson_id, company_name, project_name,
         contract_sum)
       values ('MOF-OLD', current_date, $1, 'Old Co', 'Old Project', 1000) returning id`,
      [before.profileIds.sales],
    );
    for (const [status, destination, cn] of [
      ["pending_pickup", "supplier", null],
      ["returned_to_supplier", "supplier", "CN-7"],
      ["at_best_link", "gq", null],
      ["left_with_client", "gq", null],
      ["disposed", "supplier", null],
    ]) {
      await before.db.query(
        `insert into public.leftovers (mof_id, item, qty, unit, condition, destination, status,
           credit_note_no, credit_note_amount)
         values ($1, 'Item', 3, 'box', 'good', $2, $3, $4, $5)`,
        [mof.id, destination, status, cn, cn ? 120 : null],
      );
    }
    const columns = `id, mof_id, item, qty, unit, condition, destination, status, note,
      credit_note_no, credit_note_amount, created_at, created_by`;
    const read = (sql: string) =>
      before.db.query<Record<string, unknown>>(
        `select ${sql} from public.leftovers order by id`,
      );
    const rowsBefore = (await read(columns)).rows;

    await applyMigrations(before.db, { from: MIGRATION });

    expect((await read(columns)).rows).toEqual(rowsBefore);
    const added = await read(
      `return_method, supplier, keep_reason, collected_by, received_by, credit_note_at,
       transport_by`,
    );
    for (const row of added.rows) {
      expect(Object.values(row).every((value) => value === null)).toBe(true);
    }
    await before.close();
  });
});

describe("using leftover stock for another project", () => {
  it("is allowed up to what is left at Best Link", async () => {
    const id = await addLeftover("at_best_link", "gq", 10);
    await t.actAs("support");
    await allocate(id, 6);
    await allocate(id, 4);
    const { rows } = await t.db.query<{ total: string }>(
      "select sum(qty) as total from public.leftover_allocations where leftover_id = $1",
      [id],
    );
    expect(Number(rows[0].total)).toBe(10);
  });

  it("is refused over the available balance", async () => {
    const id = await addLeftover("at_best_link", "gq", 10);
    await t.actAs("support");
    await allocate(id, 6);
    await expect(allocate(id, 4.5)).rejects.toThrow(
      "Only 4.00 left at Best Link.",
    );
  });

  it("is refused for stock not at Best Link", async () => {
    const id = await addLeftover("pending_pickup", "gq");
    await t.actAs("support");
    await expect(allocate(id, 1)).rejects.toThrow(
      "Only leftover stock at Best Link can be used for a project.",
    );
  });

  it("is for the people who arrange stock only", async () => {
    const id = await addLeftover("at_best_link", "gq");
    await t.actAs("sales");
    await expect(allocate(id, 1)).rejects.toThrow(/row-level security/);
  });
});

describe("a Site Supervisor", () => {
  it("marks an item collected, and the app records who and when", async () => {
    const id = await addLeftover();
    await t.actAs("site");
    await t.db.query(
      `update public.leftovers set status = 'collected_by_supervisor',
         return_method = 'transport', whatsapp_sent_at = now() where id = $1`,
      [id],
    );
    const row = await leftover(id);
    expect(row.status).toBe("collected_by_supervisor");
    expect(row.collected_by).toBe(t.profileIds.site);
    expect(row.collected_at).not.toBeNull();
  });

  it("cannot move it along further or change anything else", async () => {
    const id = await addLeftover();
    await t.actAs("site");
    await expect(
      t.db.query(
        "update public.leftovers set supplier = 'Floor Place' where id = $1",
        [id],
      ),
    ).rejects.toThrow(
      "A Site Supervisor can only mark leftover stock collected.",
    );
    await expect(
      t.db.query(
        "update public.leftovers set status = 'returned_to_supplier' where id = $1",
        [id],
      ),
    ).rejects.toThrow(
      "A Site Supervisor can only mark leftover stock collected.",
    );
    expect((await leftover(id)).status).toBe("pending_pickup");
  });

  it("cannot touch stock that has already arrived", async () => {
    const id = await addLeftover("at_best_link", "gq");
    await t.actAs("site");
    const { affectedRows } = await t.db.query(
      "update public.leftovers set whatsapp_sent_at = now() where id = $1",
      [id],
    );
    expect(affectedRows).toBe(0);
  });
});

describe("purchasing moving an item along", () => {
  it("records who arranged transport and received it", async () => {
    const id = await addLeftover();
    await t.actAs("support");
    await t.db.query(
      `update public.leftovers set return_method = 'transport', transport_by = 'Lalamove',
         transport_on = current_date, transport_to = 'Floor Place', transport_cost = 80
       where id = $1`,
      [id],
    );
    await t.db.query(
      `update public.leftovers set status = 'returned_to_supplier', supplier = 'Floor Place'
       where id = $1`,
      [id],
    );
    const row = await leftover(id);
    expect(row.transport_arranged_by).toBe(t.profileIds.support);
    expect(row.received_by).toBe(t.profileIds.support);
  });

  it("needs the date with the transport, and transport only when it is arranged", async () => {
    const id = await addLeftover();
    await t.actAs("support");
    await expect(
      t.db.query(
        `update public.leftovers set return_method = 'transport', transport_by = 'GQ lorry'
         where id = $1`,
        [id],
      ),
    ).rejects.toThrow(/leftovers_transport_arranged_check/);
    await expect(
      t.db.query(
        `update public.leftovers set return_method = 'installer', transport_by = 'GQ lorry',
           transport_on = current_date where id = $1`,
        [id],
      ),
    ).rejects.toThrow(/leftovers_transport_check/);
  });

  it("records who keyed in the credit note and when", async () => {
    const id = await addLeftover("returned_to_supplier");
    await t.actAs("support");
    await t.db.query(
      `update public.leftovers set credit_note_no = 'FP-CN-2611', credit_note_amount = 540
       where id = $1`,
      [id],
    );
    const row = await leftover(id);
    expect(row.credit_note_by).toBe(t.profileIds.support);
    expect(row.credit_note_at).not.toBeNull();
  });

  it("keeps the supplier for returns and the keep reason for stock GQ keeps", async () => {
    const id = await addLeftover("pending_pickup", "gq");
    await t.actAs("support");
    await expect(
      t.db.query(
        "update public.leftovers set supplier = 'Floor Place' where id = $1",
        [id],
      ),
    ).rejects.toThrow(/leftovers_supplier_destination_check/);
    await t.db.query(
      `update public.leftovers set keep_reason = 'ordered_wrong', ordered_wrong_by = $2
       where id = $1`,
      [id, t.profileIds.sales],
    );
    expect((await leftover(id)).keep_reason).toBe("ordered_wrong");
  });
});

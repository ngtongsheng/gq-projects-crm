import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMof } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 18 task 05: saving a DO's items replaces them all in one step.

let t: TestDatabase;
let mofId: string;

async function addDelivery(withDo = true) {
  await t.actAs("support");
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.jobs (mof_id, job_type, scheduled_on, ends_on)
     values ($1, 'delivery', '2026-11-20', '2026-11-20') returning id`,
    [mofId],
  );
  if (withDo) {
    await t.db.query("select public.issue_do_number($1)", [rows[0].id]);
  }
  return rows[0].id;
}

const line = (code: string, qty: number, unit = "Box") => ({
  product: "Carpet Tile",
  code,
  unit,
  qty,
});

async function replace(jobId: string, lines: object[], items: string | null) {
  await t.db.query(
    "select public.replace_delivery_order_lines($1, $2::jsonb, $3)",
    [jobId, JSON.stringify(lines), items],
  );
}

async function linesOf(jobId: string) {
  const { rows } = await t.db.query<{
    position: number;
    code: string | null;
    qty: string;
  }>(
    `select l.position, l.code, l.qty from public.delivery_order_lines l
     join public.delivery_orders d on d.id = l.delivery_order_id
     where d.job_id = $1 order by l.position`,
    [jobId],
  );
  return rows;
}

beforeAll(async () => {
  t = await createTestDatabase();
  mofId = await addMof(t);
});

afterAll(async () => {
  await t.close();
});

describe("replace_delivery_order_lines", () => {
  it("replaces the lines in order and keeps the summary", async () => {
    const jobId = await addDelivery();
    await replace(
      jobId,
      [line("A", 1), line("B", 2), line("C", 3)],
      "A 1 Box, B 2 Box, C 3 Box",
    );
    await replace(jobId, [line("B", 5)], "B 5 Box");

    expect(await linesOf(jobId)).toEqual([
      { position: 1, code: "B", qty: "5.00" },
    ]);
    const { rows } = await t.db.query<{ items: string }>(
      "select items from public.delivery_orders where job_id = $1",
      [jobId],
    );
    expect(rows[0].items).toBe("B 5 Box");
  });

  it("clears the lines and leaves the summary when saved with none", async () => {
    const jobId = await addDelivery();
    await replace(jobId, [line("A", 1)], "A 1 Box");
    await replace(jobId, [], null);

    expect(await linesOf(jobId)).toEqual([]);
    const { rows } = await t.db.query<{ items: string }>(
      "select items from public.delivery_orders where job_id = $1",
      [jobId],
    );
    expect(rows[0].items).toBe("A 1 Box");
  });

  it("keeps the old lines when a new one is refused", async () => {
    const jobId = await addDelivery();
    await replace(jobId, [line("A", 1)], null);

    await expect(
      replace(jobId, [line("B", 2), line("C", 3, "kg")], null),
    ).rejects.toThrow();

    expect(await linesOf(jobId)).toEqual([
      { position: 1, code: "A", qty: "1.00" },
    ]);
  });

  it("needs the delivery to have a DO", async () => {
    const jobId = await addDelivery(false);
    await expect(replace(jobId, [line("A", 1)], null)).rejects.toThrow(
      /no DO yet/,
    );
  });

  it("is refused for anyone who cannot schedule", async () => {
    const jobId = await addDelivery();
    await replace(jobId, [line("A", 1)], null);
    await t.actAs("accounts");

    await expect(replace(jobId, [line("B", 2)], null)).rejects.toThrow(
      /row-level security/,
    );

    await t.actAs("support");
    expect(await linesOf(jobId)).toEqual([
      { position: 1, code: "A", qty: "1.00" },
    ]);
  });
});

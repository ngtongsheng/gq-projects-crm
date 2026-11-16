import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMof } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 24 D1: an order's total (contract_sum + vo_amount) cannot be lowered below the payments
// already received, whether the contract sum changes or a VO is lowered or removed.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

async function asService(sql: string, params: unknown[] = []) {
  await t.actAs(null);
  return t.db.query(sql, params);
}

function addPayment(mofId: string, amount: number) {
  return asService(
    "insert into public.payments (mof_id, amount, received_on) values ($1, $2, current_date)",
    [mofId, amount],
  );
}

function setContractSum(mofId: string, contractSum: number) {
  return asService("update public.mofs set contract_sum = $2 where id = $1", [
    mofId,
    contractSum,
  ]);
}

async function addVo(mofId: string, amount: number) {
  const { rows } = await asService(
    `insert into public.mof_variation_orders (mof_id, vo_no, confirmed_on, amount, description)
     values ($1, 'VO1', current_date, $2, 'Extra carpet tile') returning id`,
    [mofId, amount],
  );
  const [vo] = rows as { id: string }[];
  return vo.id;
}

async function orderTotal(mofId: string) {
  const { rows } = await asService(
    "select (contract_sum + vo_amount)::float8 as total from public.mofs where id = $1",
    [mofId],
  );
  const [row] = rows as { total: number }[];
  return row.total;
}

describe("order total floor", () => {
  it("refuses a contract sum that takes the total below the payments received", async () => {
    const mofId = await addMof(t, 1000);
    await addPayment(mofId, 600);
    await addPayment(mofId, 200.5);

    await expect(setContractSum(mofId, 800.49)).rejects.toThrow(
      "The order total can't go below RM 800.50 already received.",
    );
    expect(await orderTotal(mofId)).toBe(1000);
  });

  it("allows lowering the total to exactly the payments received", async () => {
    const mofId = await addMof(t, 1000);
    await addPayment(mofId, 800.5);

    await setContractSum(mofId, 800.5);
    expect(await orderTotal(mofId)).toBe(800.5);
  });

  it("refuses the change through update_mof_total too", async () => {
    const mofId = await addMof(t, 5000);
    await addPayment(mofId, 4000);
    await t.actAs("md");

    await expect(
      t.db.query("select public.update_mof_total($1, 3000, 0, 'Discount')", [
        mofId,
      ]),
    ).rejects.toThrow(
      "The order total can't go below RM 4,000.00 already received.",
    );
  });

  it("refuses deleting a VO when the payments need it", async () => {
    const mofId = await addMof(t, 1000);
    const voId = await addVo(mofId, 500);
    await addPayment(mofId, 1200);

    await expect(
      asService("delete from public.mof_variation_orders where id = $1", [
        voId,
      ]),
    ).rejects.toThrow(
      "The order total can't go below RM 1,200.00 already received.",
    );
    expect(await orderTotal(mofId)).toBe(1500);
  });

  it("allows raising the total", async () => {
    const mofId = await addMof(t, 1000);
    await addPayment(mofId, 1000);

    await setContractSum(mofId, 1200);
    await addVo(mofId, 300);
    expect(await orderTotal(mofId)).toBe(1500);
  });

  it("leaves orders with no payments free to change", async () => {
    const mofId = await addMof(t, 1000);
    const voId = await addVo(mofId, 200);

    await setContractSum(mofId, 100);
    await asService("delete from public.mof_variation_orders where id = $1", [
      voId,
    ]);
    expect(await orderTotal(mofId)).toBe(100);
  });

  it("lets an order already below its payments be raised but not lowered", async () => {
    const mofId = await addMof(t, 1000);
    await addPayment(mofId, 1000);
    await asService(
      "alter table public.mofs disable trigger keep_order_total_above_payments",
    );
    await setContractSum(mofId, 500);
    await asService(
      "alter table public.mofs enable trigger keep_order_total_above_payments",
    );

    await setContractSum(mofId, 700);
    await expect(setContractSum(mofId, 600)).rejects.toThrow(
      "below RM 1,000.00 already received",
    );
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMof } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 24 task 04: removing a commission payout leaves a permanent record of who removed it
// and what it held. Only the people who pay out commission can read the record.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

/** An order paid in full at 50% margin, with one RM 10 payout to the salesperson. */
async function addPayout() {
  const mofId = await addMof(t);
  await t.actAs(null);
  await t.db.query(
    "insert into public.mof_costs (mof_id, cost) values ($1, 500)",
    [mofId],
  );
  await t.db.query(
    "insert into public.payments (mof_id, amount, received_on) values ($1, 1000, current_date)",
    [mofId],
  );
  await t.actAs("md");
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.commission_payouts (mof_id, profile_id, amount, paid_on, note)
     values ($1, $2, 10, current_date, 'May batch') returning id`,
    [mofId, t.profileIds.sales],
  );
  return { payoutId: rows[0].id, mofId };
}

async function removePayout(as: "md" | "accounts", payoutId: string) {
  await t.actAs(as);
  await t.db.query("delete from public.commission_payouts where id = $1", [
    payoutId,
  ]);
}

describe("commission payout removals", () => {
  it("records who removed the payout, with its full values", async () => {
    for (const as of ["md", "accounts"] as const) {
      const { payoutId, mofId } = await addPayout();
      await removePayout(as, payoutId);

      await t.actAs(as);
      const { rows } = await t.db.query<{
        removed_by: string;
        removed_at: string;
        payout: Record<string, unknown>;
      }>(
        "select removed_by, removed_at, payout from public.commission_payout_removals where payout_id = $1",
        [payoutId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].removed_by).toBe(t.profileIds[as]);
      expect(rows[0].removed_at).not.toBeNull();
      expect(rows[0].payout).toMatchObject({
        id: payoutId,
        mof_id: mofId,
        profile_id: t.profileIds.sales,
        amount: 10,
        note: "May batch",
      });
    }
  });

  it("writes nothing when a payout is not removed", async () => {
    const { payoutId } = await addPayout();
    await t.actAs("md");
    const { rows } = await t.db.query(
      "select id from public.commission_payout_removals where payout_id = $1",
      [payoutId],
    );
    expect(rows).toEqual([]);
  });

  it("is not readable or writable by staff, even the salesperson paid", async () => {
    const { payoutId } = await addPayout();
    await removePayout("md", payoutId);

    await t.actAs("sales");
    await expect(
      t.db.query("select id from public.commission_payout_removals"),
    ).resolves.toMatchObject({ rows: [] });
    await expect(
      t.db.query(
        "insert into public.commission_payout_removals (payout_id, payout) values ($1, '{}')",
        [payoutId],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.db.query("delete from public.commission_payout_removals"),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot be changed by the people who read it", async () => {
    await t.actAs("md");
    await expect(
      t.db.query("update public.commission_payout_removals set payout = '{}'"),
    ).rejects.toThrow(/permission denied/);
  });
});

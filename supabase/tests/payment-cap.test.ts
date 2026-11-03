import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMof } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 audit finding 49: payments cannot add up to more than contract_sum + vo_amount.
// Two saves at once is out of reach in PGlite; the cap itself is what is checked here.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

function addPayment(mofId: string, amount: number) {
  return t.db.query(
    "insert into public.payments (mof_id, amount, received_on) values ($1, $2, current_date)",
    [mofId, amount],
  );
}

describe("payments", () => {
  it("refuses a payment that takes the total past the order total", async () => {
    const mofId = await addMof(t, 1000);
    await t.actAs("accounts");
    await addPayment(mofId, 600);

    await expect(addPayment(mofId, 400.01)).rejects.toThrow(
      "That takes payments past the order total of RM 1,000.00. If the order total has changed, change it on the MOF first.",
    );
  });

  it("allows payments that add up to exactly the order total", async () => {
    const mofId = await addMof(t, 1000);
    await t.actAs("accounts");
    await addPayment(mofId, 600);

    await expect(addPayment(mofId, 400)).resolves.toBeDefined();
  });

  it("counts the variation order amount in the total", async () => {
    const mofId = await addMof(t, 1000);
    await t.actAs(null);
    await t.db.query("update public.mofs set vo_amount = 500 where id = $1", [
      mofId,
    ]);
    await t.actAs("md");

    await expect(addPayment(mofId, 1500)).resolves.toBeDefined();
    await expect(addPayment(mofId, 0.01)).rejects.toThrow(
      "past the order total of RM 1,500.00",
    );
  });

  it("counts payments from every earlier entry, not only the last", async () => {
    const mofId = await addMof(t, 1000);
    await t.actAs("md");
    await addPayment(mofId, 300);
    await addPayment(mofId, 300);
    await addPayment(mofId, 300);

    await expect(addPayment(mofId, 200)).rejects.toThrow(
      "past the order total",
    );
  });
});

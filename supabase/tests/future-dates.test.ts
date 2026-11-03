import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMof, malaysiaDate } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 audit: payments, commission payouts and overtime cannot be dated after today in
// Malaysia. Tomorrow is the nearest day the rule must refuse.

let t: TestDatabase;
let mofId: string;
let today: string;
let tomorrow: string;

beforeAll(async () => {
  t = await createTestDatabase();
  mofId = await addMof(t);
  today = await malaysiaDate(t);
  tomorrow = await malaysiaDate(t, 1);
});

afterAll(async () => {
  await t.close();
});

describe("payments", () => {
  beforeAll(() => t.actAs("accounts"));

  const record = (receivedOn: string) =>
    t.db.query(
      "insert into public.payments (mof_id, amount, received_on) values ($1, 100, $2)",
      [mofId, receivedOn],
    );

  it("refuses a payment received tomorrow", async () => {
    await expect(record(tomorrow)).rejects.toThrow(
      "That date is in the future.",
    );
  });

  it("allows a payment received today", async () => {
    await expect(record(today)).resolves.toMatchObject({ affectedRows: 1 });
  });
});

describe("commission payouts", () => {
  // An order paid in full at a standard margin, so RM 300 of commission is payable.
  let paidMofId: string;

  beforeAll(async () => {
    paidMofId = await addMof(t, 10_000);
    await t.db.query(
      "insert into public.mof_costs (mof_id, cost) values ($1, 6000)",
      [paidMofId],
    );
    await t.db.query(
      "insert into public.payments (mof_id, amount, received_on) values ($1, 10000, $2)",
      [paidMofId, today],
    );
    await t.actAs("accounts");
  });

  const pay = (paidOn: string) =>
    t.db.query(
      "insert into public.commission_payouts (profile_id, mof_id, amount, paid_on) values ($1, $2, 100, $3)",
      [t.profileIds.sales, paidMofId, paidOn],
    );

  it("refuses a payout paid tomorrow", async () => {
    await expect(pay(tomorrow)).rejects.toThrow("That date is in the future.");
  });

  it("allows a payout paid today", async () => {
    await expect(pay(today)).resolves.toMatchObject({ affectedRows: 1 });
  });
});

describe("overtime claims", () => {
  beforeAll(() => t.actAs("site"));

  const claim = (workDate: string) =>
    t.db.query(
      `insert into public.ot_claims (work_date, from_time, to_time, mof_id, reason, claim_as)
       values ($1, '18:00', '21:00', $2, 'Site handover', 'ot')`,
      [workDate, mofId],
    );

  it("refuses a day that has not come", async () => {
    await expect(claim(tomorrow)).rejects.toThrow(
      "You cannot claim overtime for a day that has not come.",
    );
  });

  it("allows today", async () => {
    await expect(claim(today)).resolves.toMatchObject({ affectedRows: 1 });
  });
});

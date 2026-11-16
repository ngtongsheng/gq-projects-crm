import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { addMof, malaysiaDate } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 19 task 03: section C's OT amount worked out from the HR package, and approving a claim
// records its commission lines as paid out in one go.

let t: TestDatabase;
let today: string;
let monthCounter = 0;

beforeAll(async () => {
  t = await createTestDatabase();
  today = await malaysiaDate(t);
});

afterAll(async () => {
  await t.close();
});

function nextMonth() {
  monthCounter += 1;
  return `2021-${String(monthCounter).padStart(2, "0")}-01`;
}

async function startClaim(month = nextMonth()) {
  await t.actAs("sales");
  const { rows } = await t.db.query<{ id: string }>(
    "insert into public.monthly_claims (month) values ($1) returning id",
    [month],
  );
  return rows[0].id;
}

/** An order paid in full at a standard margin, so RM 300 of commission is payable to sales. */
async function addPayableMof() {
  const mofId = await addMof(t, 10_000);
  await t.db.query(
    "insert into public.mof_costs (mof_id, cost) values ($1, 6000)",
    [mofId],
  );
  await t.db.query(
    "insert into public.payments (mof_id, amount, received_on) values ($1, 10000, $2)",
    [mofId, today],
  );
  return mofId;
}

async function addCommissionLine(claimId: string, mofId: string) {
  await t.actAs("sales");
  await t.db.query(
    "insert into public.monthly_claim_commissions (claim_id, mof_id) values ($1, $2)",
    [claimId, mofId],
  );
}

async function setStatus(claimId: string, status: string, as: JobRole) {
  await t.actAs(as);
  await t.db.query(
    "update public.monthly_claims set status = $2 where id = $1",
    [claimId, status],
  );
}

async function approve(claimId: string, as: JobRole) {
  await t.actAs(as);
  await t.db.query("select public.approve_monthly_claim($1)", [claimId]);
}

async function statusOf(claimId: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ status: string }>(
    "select status from public.monthly_claims where id = $1",
    [claimId],
  );
  return rows[0].status;
}

async function payoutsOn(mofId: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ amount: string; note: string }>(
    "select amount::text, note from public.commission_payouts where mof_id = $1 and profile_id = $2",
    [mofId, t.profileIds.sales],
  );
  return rows;
}

describe("section C OT amount", () => {
  const month = "2025-03-01";
  let claimId: string;

  /** Overtime the salesperson filed, decided by the MD. */
  async function addOt(
    workDate: string,
    fromTime: string,
    toTime: string,
    decision: "ot" | "replacement_leave" | "rejected",
  ) {
    const mofId = await addMof(t);
    await t.actAs("sales");
    const { rows } = await t.db.query<{ id: string }>(
      `insert into public.ot_claims (work_date, from_time, to_time, mof_id, reason, claim_as)
       values ($1, $2, $3, $4, 'Night install', 'ot') returning id`,
      [workDate, fromTime, toTime, mofId],
    );
    await t.actAs("md");
    await t.db.query(
      "update public.ot_claims set status = $2, approved_as = $3 where id = $1",
      [
        rows[0].id,
        decision === "rejected" ? "rejected" : "approved",
        decision === "rejected" ? null : decision,
      ],
    );
  }

  beforeAll(async () => {
    claimId = await startClaim(month);
    // March's period with the cut-off on the 25th: 26 Feb to 25 Mar.
    await addOt("2025-02-26", "18:00", "19:00", "ot");
    await addOt("2025-03-10", "18:00", "20:00", "ot");
    await addOt("2025-03-11", "18:00", "20:00", "replacement_leave");
    await addOt("2025-03-12", "18:00", "20:00", "rejected");
    await addOt("2025-03-26", "18:00", "20:00", "ot");
  });

  const amountFor = async (as: JobRole) => {
    await t.actAs(as);
    const { rows } = await t.db.query<{ amount: string | null }>(
      "select public.monthly_claim_ot_amount($1)::text as amount",
      [claimId],
    );
    return rows[0]?.amount ?? null;
  };

  it("is zero without an HR package", async () => {
    expect(await amountFor("sales")).toBe("0.00");
  });

  it("is the period's OT-claim hours at basic / 26 / 8 x 1.5, from the package on the cut-off day", async () => {
    await t.actAs("accounts");
    await t.db.query(
      `insert into public.staff_packages (profile_id, effective_on, basic)
       values ($1, '2024-01-01', 2600), ($1, '2025-03-26', 5200)`,
      [t.profileIds.sales],
    );
    // 3 hours at RM 18.75.
    expect(await amountFor("sales")).toBe("56.25");
    expect(await amountFor("md")).toBe("56.25");
    expect(await amountFor("accounts")).toBe("56.25");
  });

  it("is not given to anyone else", async () => {
    expect(await amountFor("director")).toBeNull();
    expect(await amountFor("site")).toBeNull();
  });
});

describe("approving a claim", () => {
  it("records each commission line as paid out, so it cannot be claimed again", async () => {
    const mofId = await addPayableMof();
    const claimId = await startClaim();
    await addCommissionLine(claimId, mofId);
    await setStatus(claimId, "submitted", "sales");

    await approve(claimId, "md");
    expect(await statusOf(claimId)).toBe("approved");
    expect(await payoutsOn(mofId)).toEqual([
      { amount: "300.00", note: expect.stringMatching(/^Monthly claim /) },
    ]);

    await setStatus(claimId, "paid", "accounts");
    await expect(addCommissionLine(await startClaim(), mofId)).rejects.toThrow(
      "Nothing is payable on this order yet.",
    );
  });

  it("pays out the adjusted amount", async () => {
    const mofId = await addPayableMof();
    const claimId = await startClaim();
    await addCommissionLine(claimId, mofId);
    await setStatus(claimId, "submitted", "sales");
    await t.actAs("accounts");
    await t.db.query(
      "update public.monthly_claim_commissions set amount = 120, adjustment_reason = 'Half the order was returned' where claim_id = $1",
      [claimId],
    );
    await setStatus(claimId, "checked", "accounts");

    await approve(claimId, "accounts");
    expect(await payoutsOn(mofId)).toEqual([
      { amount: "120.00", note: expect.any(String) },
    ]);
  });

  it("leaves the claim waiting when a payout is refused", async () => {
    const mofId = await addPayableMof();
    const claimId = await startClaim();
    await addCommissionLine(claimId, mofId);
    await setStatus(claimId, "submitted", "sales");
    // Paid by hand meanwhile, so the claimed RM 300 is more than is left.
    await t.actAs("accounts");
    await t.db.query(
      "insert into public.commission_payouts (profile_id, mof_id, amount, paid_on) values ($1, $2, 100, $3)",
      [t.profileIds.sales, mofId, today],
    );

    await expect(approve(claimId, "md")).rejects.toThrow(/more than/);
    expect(await statusOf(claimId)).toBe("submitted");
    expect(await payoutsOn(mofId)).toHaveLength(1);
  });

  it("is refused for a draft, your own claim, or someone without the right", async () => {
    const claimId = await startClaim();
    await expect(approve(claimId, "md")).rejects.toThrow(
      "not waiting for approval",
    );

    await setStatus(claimId, "submitted", "sales");
    await expect(approve(claimId, "sales")).rejects.toThrow();
    await expect(approve(claimId, "director")).rejects.toThrow(
      "not waiting for approval",
    );
    expect(await statusOf(claimId)).toBe("submitted");
  });
});

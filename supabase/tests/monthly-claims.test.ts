import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { addMof, malaysiaDate } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 19 task 01: monthly claims. One claim per person per month (D1), the flow and who moves
// it, who reads it, and a commission line that cannot wait in two claims (D2).

let t: TestDatabase;
let today: string;
let monthCounter = 0;

beforeAll(async () => {
  t = await createTestDatabase();
  today = await malaysiaDate(t);
  // The salesperson reports to the Sales Director, so they are in the director's team.
  await t.db.query("update public.profiles set reports_to = $1 where id = $2", [
    t.profileIds.director,
    t.profileIds.sales,
  ]);
});

afterAll(async () => {
  await t.close();
});

/** A month no other test has used, so each test gets fresh claims. */
function nextMonth() {
  monthCounter += 1;
  const year = 2020 + Math.floor(monthCounter / 12);
  return `${year}-${String((monthCounter % 12) + 1).padStart(2, "0")}-01`;
}

async function startClaim(as: JobRole, month = nextMonth()) {
  await t.actAs(as);
  const { rows } = await t.db.query<{ id: string }>(
    "insert into public.monthly_claims (month) values ($1) returning id",
    [month],
  );
  return rows[0].id;
}

/** Moves a claim and returns the rows changed; an empty list means the rules hid it. */
async function move(
  claimId: string,
  status: string,
  as: JobRole,
  returnReason: string | null = null,
) {
  await t.actAs(as);
  const { rows } = await t.db.query<{ status: string }>(
    `update public.monthly_claims
     set status = $2, return_reason = coalesce($3, return_reason)
     where id = $1 returning status`,
    [claimId, status, returnReason],
  );
  return rows;
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
  const { rows } = await t.db.query<{ id: string; original_amount: string }>(
    `insert into public.monthly_claim_commissions (claim_id, mof_id) values ($1, $2)
     returning id, original_amount::text`,
    [claimId, mofId],
  );
  return rows[0];
}

async function addExpense(
  claimId: string,
  fields: Record<string, string | number>,
  as: JobRole = "sales",
) {
  await t.actAs(as);
  const line = { spent_on: today, description: "KL site visit", ...fields };
  const columns = Object.keys(line);
  const { rows } = await t.db.query<{
    id: string;
    amount: string;
    original_amount: string;
    receipt_no: number | null;
  }>(
    `insert into public.monthly_claim_expenses (claim_id, ${columns.join(", ")})
     values ($1, ${columns.map((_, i) => `$${i + 2}`).join(", ")})
     returning id, amount::text, original_amount::text, receipt_no`,
    [claimId, ...Object.values(line)],
  );
  return rows[0];
}

describe("one claim per person per month", () => {
  it("refuses a second claim for the same month", async () => {
    const month = nextMonth();
    await startClaim("sales", month);
    await expect(startClaim("sales", month)).rejects.toThrow(/duplicate key/);
  });

  it("is started as the signed-in person, on the first of the month", async () => {
    const claimId = await startClaim("sales");
    const { rows } = await t.db.query<{ profile_id: string; status: string }>(
      "select profile_id, status from public.monthly_claims where id = $1",
      [claimId],
    );
    expect(rows[0]).toEqual({
      profile_id: t.profileIds.sales,
      status: "draft",
    });
    await expect(startClaim("sales", "2031-05-02")).rejects.toThrow(/check/);
  });
});

describe("who reads a claim", () => {
  let claimId: string;

  beforeAll(async () => {
    claimId = await startClaim("sales");
    await addExpense(claimId, { expense_type: "toll", amount: 12.5 });
    await move(claimId, "submitted", "sales");
  });

  const visibleTo = async (as: JobRole) => {
    await t.actAs(as);
    const counts = await Promise.all(
      [
        "select id from public.monthly_claims where id = $1",
        "select id from public.monthly_claim_expenses where claim_id = $1",
        "select id from public.monthly_claim_log where claim_id = $1",
      ].map(async (sql) => (await t.db.query(sql, [claimId])).rows.length),
    );
    return counts;
  };

  it("the person, the MD, HR & Accounts and the person's Sales Director", async () => {
    for (const as of ["sales", "md", "accounts", "director"] as const) {
      expect(await visibleTo(as)).toEqual([1, 1, 1]);
    }
  });

  it("nobody else", async () => {
    for (const as of ["bd", "support", "site", "ssup"] as const) {
      expect(await visibleTo(as)).toEqual([0, 0, 0]);
    }
  });

  it("not a director outside the person's team", async () => {
    const siteClaim = await startClaim("site");
    await t.actAs("director");
    const { rows } = await t.db.query(
      "select id from public.monthly_claims where id = $1",
      [siteClaim],
    );
    expect(rows).toEqual([]);
  });
});

describe("the flow", () => {
  async function submitted(as: JobRole = "sales") {
    const claimId = await startClaim(as);
    await addExpense(claimId, { expense_type: "parking", amount: 5 }, as);
    await move(claimId, "submitted", as);
    return claimId;
  }

  it("HR & Accounts checks, the MD approves, HR & Accounts pays, each logged", async () => {
    const claimId = await submitted();
    expect(await move(claimId, "checked", "accounts")).toEqual([
      { status: "checked" },
    ]);
    expect(await move(claimId, "approved", "md")).toEqual([
      { status: "approved" },
    ]);
    expect(await move(claimId, "paid", "accounts")).toEqual([
      { status: "paid" },
    ]);

    await t.actAs("sales");
    const { rows } = await t.db.query<{ status: string; changed_by: string }>(
      "select status, changed_by from public.monthly_claim_log where claim_id = $1 order by changed_at, status",
      [claimId],
    );
    expect(rows.map((r) => r.status).sort()).toEqual(
      ["approved", "checked", "paid", "submitted"].sort(),
    );
    expect(rows.find((r) => r.status === "checked")?.changed_by).toBe(
      t.profileIds.accounts,
    );
  });

  it("only HR & Accounts checks; anyone else is refused or sees nothing", async () => {
    const claimId = await submitted();
    await expect(move(claimId, "checked", "md")).rejects.toThrow(
      /cannot go from submitted to checked/,
    );
    for (const as of ["director", "bd", "site"] as const) {
      expect(await move(claimId, "approved", as)).toEqual([]);
    }
  });

  it("the person cannot move their own claim past submitted", async () => {
    const claimId = await submitted("accounts");
    expect(await move(claimId, "checked", "accounts")).toEqual([]);
    expect(await move(claimId, "approved", "accounts")).toEqual([]);

    const mdClaim = await submitted("md");
    expect(await move(mdClaim, "approved", "md")).toEqual([]);
    expect(await move(mdClaim, "approved", "accounts")).toEqual([
      { status: "approved" },
    ]);
  });

  it("is returned with what to fix, edited and submitted again", async () => {
    const claimId = await submitted();
    await expect(move(claimId, "returned", "accounts")).rejects.toThrow(
      /check/,
    );
    await move(claimId, "returned", "accounts", "Toll receipt 12 Nov missing");
    await expect(
      addExpense(claimId, { expense_type: "toll", amount: 3 }),
    ).resolves.toBeDefined();
    expect(await move(claimId, "submitted", "sales")).toEqual([
      { status: "submitted" },
    ]);
  });

  it("does not skip steps", async () => {
    const claimId = await submitted();
    await expect(move(claimId, "paid", "accounts")).rejects.toThrow(
      /cannot go from submitted to paid/,
    );
  });
});

describe("lines", () => {
  it("cannot be added or changed by the person once submitted", async () => {
    const claimId = await startClaim("sales");
    const line = await addExpense(claimId, {
      expense_type: "petrol",
      amount: 80,
    });
    await move(claimId, "submitted", "sales");
    await expect(
      addExpense(claimId, { expense_type: "toll", amount: 3 }),
    ).rejects.toThrow(/row-level security/);
    await t.actAs("sales");
    const { rows } = await t.db.query(
      "update public.monthly_claim_expenses set amount = 90 where id = $1 returning id",
      [line.id],
    );
    expect(rows).toEqual([]);
  });

  it("keep the claimed amount when a checker adjusts, with a reason", async () => {
    const claimId = await startClaim("sales");
    const line = await addExpense(claimId, {
      expense_type: "petrol",
      amount: 80,
    });
    await move(claimId, "submitted", "sales");
    await t.actAs("accounts");
    await expect(
      t.db.query(
        "update public.monthly_claim_expenses set amount = 60 where id = $1",
        [line.id],
      ),
    ).rejects.toThrow(/check/);
    const { rows } = await t.db.query<{
      amount: string;
      original_amount: string;
      adjusted_by: string;
    }>(
      `update public.monthly_claim_expenses set amount = 60, adjustment_reason = 'Over the cap'
       where id = $1 returning amount::text, original_amount::text, adjusted_by`,
      [line.id],
    );
    expect(rows[0]).toEqual({
      amount: "60.00",
      original_amount: "80.00",
      adjusted_by: t.profileIds.accounts,
    });
    await expect(
      t.db.query(
        "update public.monthly_claim_expenses set description = 'Changed' where id = $1",
        [line.id],
      ),
    ).rejects.toThrow("Only the amount and its reason can be adjusted.");
  });

  it("mileage is km times the rate, with no receipt", async () => {
    const claimId = await startClaim("sales");
    const line = await addExpense(claimId, {
      expense_type: "mileage",
      km: 120,
      amount: 999,
    });
    expect([line.amount, line.original_amount]).toEqual(["72.00", "72.00"]);
  });

  it("numbers receipts R1, R2 in the order they are attached", async () => {
    const claimId = await startClaim("sales");
    const receipt = (n: number) => ({
      receipt_path: `claims/${claimId}/r${n}.jpg`,
      receipt_file_name: `r${n}.jpg`,
      receipt_content_type: "image/jpeg",
    });
    const first = await addExpense(claimId, {
      expense_type: "toll",
      amount: 5,
      ...receipt(1),
    });
    const noSlip = await addExpense(claimId, {
      expense_type: "mileage",
      km: 10,
      amount: 0,
    });
    const second = await addExpense(claimId, {
      expense_type: "parking",
      amount: 4,
      ...receipt(2),
    });
    expect([first.receipt_no, noSlip.receipt_no, second.receipt_no]).toEqual([
      1,
      null,
      2,
    ]);
  });

  it("refuse a day that has not come", async () => {
    const claimId = await startClaim("sales");
    await expect(
      addExpense(claimId, {
        expense_type: "toll",
        amount: 5,
        spent_on: await malaysiaDate(t, 1),
      }),
    ).rejects.toThrow("You cannot claim for a day that has not come.");
  });
});

describe("commission lines", () => {
  it("claim what is payable now, and nothing on an order not yet paid", async () => {
    const claimId = await startClaim("sales");
    const line = await addCommissionLine(claimId, await addPayableMof());
    expect(line.original_amount).toBe("300.00");

    await expect(addCommissionLine(claimId, await addMof(t))).rejects.toThrow(
      "Nothing is payable on this order yet.",
    );
  });

  it("refuse a double claim while the first claim is pending", async () => {
    const mofId = await addPayableMof();
    const first = await startClaim("sales");
    const second = await startClaim("sales");
    await addCommissionLine(first, mofId);
    await addCommissionLine(second, mofId);

    await move(first, "submitted", "sales");
    await expect(move(second, "submitted", "sales")).rejects.toThrow(
      /duplicate key/,
    );

    // Returned, the first claim no longer holds the line.
    await move(first, "returned", "accounts", "Claim it next month instead.");
    expect(await move(second, "submitted", "sales")).toEqual([
      { status: "submitted" },
    ]);
    await expect(move(first, "submitted", "sales")).rejects.toThrow(
      /duplicate key/,
    );
  });

  it("cannot be inserted with someone else's amount", async () => {
    const mofId = await addPayableMof();
    const claimId = await startClaim("sales");
    await expect(
      t.db.query(
        "insert into public.monthly_claim_commissions (claim_id, mof_id, amount) values ($1, $2, 5000)",
        [claimId, mofId],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("claim settings", () => {
  const save = (as: JobRole, value: unknown) =>
    t
      .actAs(as)
      .then(() =>
        t.db.query(
          "update public.app_settings set value = $1 where key = 'claims' returning key",
          [value],
        ),
      );
  const settings = {
    cutOffDay: 25,
    mileageRatePerKm: 0.6,
    kmPerDay: 150,
    monthlyTravelLimit: 0,
    needReport: true,
  };

  it("are changed by HR & Accounts or the MD, not by staff", async () => {
    expect((await save("accounts", settings)).rows).toHaveLength(1);
    expect((await save("md", settings)).rows).toHaveLength(1);
    expect((await save("sales", settings)).rows).toEqual([]);
  });

  it("refuse a cut-off day after the 28th", async () => {
    await expect(save("md", { ...settings, cutOffDay: 30 })).rejects.toThrow(
      /app_settings_claims_check/,
    );
  });
});

describe("overtime", () => {
  it("is decided by HR & Accounts too (D3)", async () => {
    const mofId = await addMof(t);
    await t.actAs("site");
    const { rows } = await t.db.query<{ id: string }>(
      `insert into public.ot_claims (work_date, from_time, to_time, mof_id, reason, claim_as)
       values ($1, '18:00', '21:00', $2, 'Site handover', 'ot') returning id`,
      [today, mofId],
    );
    await t.actAs("accounts");
    const decided = await t.db.query(
      "update public.ot_claims set status = 'approved', approved_as = 'ot' where id = $1 returning id",
      [rows[0].id],
    );
    expect(decided.rows).toHaveLength(1);
  });
});

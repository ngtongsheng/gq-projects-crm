import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CommissionMode } from "@/lib/auth/job-role";
import {
  type CommissionPerson,
  type CommissionType,
  calculateCommission,
} from "@/lib/domain/commission";
import { commissionBalance } from "@/lib/domain/commission-balance";
import {
  type CommissionSettings,
  DEFAULT_COMMISSION_SETTINGS,
  storedRows,
} from "@/lib/domain/commission-settings";
import { orderTotal } from "@/lib/domain/mof-totals";
import { addContact, malaysiaDate } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 audit finding 20: the database refuses a payout above payable-now. Payable-now is a
// SQL copy of the TypeScript commission rules, so every case runs through both and must agree.
// Two payouts at once is out of reach in PGlite; the cap itself is what is checked here.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

/** The salesperson on every order, a second salesperson or passer, and someone with no part in it. */
const PEOPLE = ["sales", "bd", "director"] as const;
type Person = (typeof PEOPLE)[number];

type Case = {
  name: string;
  contractSum?: number;
  voAmount?: number;
  /** Set after the payments are in, to take the total below what was received. */
  voAfterPayments?: number;
  cost: number | null;
  kind?: CommissionType;
  second?: Person;
  passedBy?: Person;
  modes?: Partial<Record<Person, CommissionMode>>;
  /** Days after the LOA date; the LOA date is 200 days ago. */
  invoiceDay?: number;
  payments?: { amount: number; day: number }[];
  payouts?: { person: Person; amount: number }[];
  settings?: Partial<CommissionSettings>;
  /** Payable now per person, worked out by hand; anyone left out is 0. */
  expected: Partial<Record<Person, number>>;
};

const PAID_IN_FULL = [{ amount: 10_000, day: 0 }];

const cases: Case[] = [
  { name: "cost not keyed in", cost: null, expected: {} },
  { name: "margin just below 20%: none", cost: 8000.01, expected: {} },
  { name: "margin exactly 20%: low", cost: 8000, expected: { sales: 150 } },
  {
    name: "margin just below 30%: low",
    cost: 7000.01,
    expected: { sales: 150 },
  },
  {
    name: "margin exactly 30%: standard",
    cost: 7000,
    expected: { sales: 300 },
  },
  {
    name: "margin exactly 45%: standard",
    cost: 5500,
    expected: { sales: 300 },
  },
  {
    name: "margin just above 45%: high",
    cost: 5499.99,
    expected: { sales: 400 },
  },
  {
    name: "company account",
    kind: "company",
    cost: 6000,
    expected: { sales: 150 },
  },
  {
    name: "low margin pass-down uses the other rate; a standard passer gets nothing",
    kind: "pass_down",
    passedBy: "bd",
    cost: 7500,
    expected: { sales: 100 },
  },
  {
    name: "pass-down with a flat-rate passer",
    kind: "pass_down",
    passedBy: "bd",
    modes: { bd: "flat_pass_down" },
    cost: 6000,
    expected: { sales: 150, bd: 100 },
  },
  {
    name: "high margin: the flat-rate passer gets no extra",
    kind: "pass_down",
    passedBy: "bd",
    modes: { bd: "flat_pass_down" },
    cost: 5000,
    expected: { sales: 250, bd: 100 },
  },
  {
    name: "low margin: the flat-rate passer keeps the flat rate",
    kind: "pass_down",
    passedBy: "bd",
    modes: { bd: "flat_pass_down" },
    cost: 7500,
    expected: { sales: 100, bd: 100 },
  },
  {
    name: "a passer who is also the salesperson is paid once",
    kind: "pass_down",
    passedBy: "sales",
    modes: { sales: "flat_pass_down" },
    cost: 6000,
    expected: { sales: 100 },
  },
  {
    name: "flat-rate salesperson on an own sale",
    modes: { sales: "flat_pass_down" },
    cost: 6000,
    expected: { sales: 100 },
  },
  {
    name: "two salespeople split 50/50",
    second: "bd",
    cost: 6000,
    expected: { sales: 150, bd: 150 },
  },
  {
    name: "split 60/40 with the second salesperson excluded",
    second: "bd",
    modes: { bd: "excluded" },
    settings: { splitSharePct: 60 },
    cost: 6000,
    expected: { sales: 180 },
  },
  {
    name: "excluded salesperson",
    modes: { sales: "excluded" },
    cost: 6000,
    expected: {},
  },
  {
    name: "just below the claim threshold",
    cost: 6000,
    payments: [{ amount: 8999.99, day: 0 }],
    expected: {},
  },
  {
    name: "exactly at the claim threshold",
    cost: 6000,
    payments: [{ amount: 9000, day: 0 }],
    expected: { sales: 270 },
  },
  {
    name: "claim threshold and rates the MD changed",
    cost: 6000,
    settings: {
      claimThresholdPct: 50,
      baseRatePct: { own: 2.5, pass_down: 1, company: 1 },
    },
    payments: [{ amount: 5000, day: 0 }],
    expected: { sales: 125 },
  },
  {
    name: "late cut from day 91, none on day 90",
    cost: 6000,
    payments: [
      { amount: 5000, day: 90 },
      { amount: 5000, day: 91 },
    ],
    expected: { sales: 262.5 },
  },
  {
    name: "second late cut counts from the invoice date",
    cost: 6000,
    invoiceDay: 50,
    payments: [{ amount: 10_000, day: 171 }],
    expected: { sales: 150 },
  },
  {
    name: "partial payments, the last one late",
    cost: 6000,
    payments: [
      { amount: 500, day: 100 },
      { amount: 3000, day: 10 },
      { amount: 6500, day: 20 },
    ],
    expected: { sales: 296.25 },
  },
  {
    name: "variation order counts in the total",
    voAmount: 2000,
    cost: 7200,
    payments: [{ amount: 12_000, day: 0 }],
    expected: { sales: 360 },
  },
  {
    name: "money past a reduced total earns nothing",
    voAfterPayments: -1000,
    cost: 5400,
    expected: { sales: 270 },
  },
  {
    name: "payouts already made",
    cost: 6000,
    payouts: [{ person: "sales", amount: 120.5 }],
    expected: { sales: 179.5 },
  },
  {
    name: "paid out in full",
    cost: 6000,
    payouts: [{ person: "sales", amount: 300 }],
    expected: {},
  },
  {
    name: "half a cent rounds up",
    contractSum: 16.5,
    cost: 10,
    payments: [{ amount: 16.5, day: 0 }],
    expected: { sales: 0.5 },
  },
  {
    name: "under half a cent rounds down",
    contractSum: 16.49,
    cost: 10,
    payments: [{ amount: 16.49, day: 0 }],
    expected: { sales: 0.49 },
  },
  {
    name: "half a cent in the late cut rounds up",
    contractSum: 100,
    second: "bd",
    cost: 60,
    payments: [{ amount: 100, day: 91 }],
    expected: { sales: 1.12, bd: 1.12 },
  },
];

const plusDays = (date: string, days: number) => {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};

let caseNo = 0;

/** Writes the case to the database as the service role, and returns what TypeScript needs. */
async function addCase(c: Case, settings: CommissionSettings) {
  await t.actAs(null);
  const id = (person: Person | undefined) =>
    person === undefined ? null : t.profileIds[person];
  const kind = c.kind ?? "own";
  const loaDate = plusDays(await malaysiaDate(t), -200);
  const invoiceDate =
    c.invoiceDay === undefined ? null : plusDays(loaDate, c.invoiceDay);
  const payments = (c.payments ?? PAID_IN_FULL).map((payment) => ({
    amount: payment.amount,
    receivedOn: plusDays(loaDate, payment.day),
  }));

  await t.db.query("delete from public.app_settings");
  if (c.settings) {
    for (const row of storedRows(settings)) {
      await t.db.query(
        "insert into public.app_settings (key, value) values ($1, $2)",
        [row.key, row.value],
      );
    }
  }
  for (const person of PEOPLE) {
    await t.db.query(
      "update public.profiles set commission_mode = $1 where id = $2",
      [c.modes?.[person] ?? "standard", t.profileIds[person]],
    );
  }

  let projectId: string | null = null;
  if (c.passedBy) {
    const { rows } = await t.db.query<{ id: string }>(
      `insert into public.projects (contact_id, name, lead_source, pic_id, commission_type, passed_by)
       values ($1, $2, 'referral', $3, 'pass_down', $4) returning id`,
      [await addContact(t), `Parity ${++caseNo}`, id("sales"), id(c.passedBy)],
    );
    projectId = rows[0].id;
  }
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.mofs (mof_no, loa_date, invoice_date, salesperson_id, second_salesperson_id,
       project_id, company_name, project_name, contract_sum, vo_amount, commission_type)
     values ($1, $2, $3, $4, $5, $6, 'Test Co', 'Test Project', $7, $8, $9) returning id`,
    [
      `PARITY-${++caseNo}`,
      loaDate,
      invoiceDate,
      id("sales"),
      id(c.second),
      projectId,
      c.contractSum ?? 10_000,
      c.voAmount ?? 0,
      kind,
    ],
  );
  const mofId = rows[0].id;
  if (c.cost !== null) {
    await t.db.query(
      "insert into public.mof_costs (mof_id, cost) values ($1, $2)",
      [mofId, c.cost],
    );
  }
  for (const payment of payments) {
    await t.db.query(
      "insert into public.payments (mof_id, amount, received_on) values ($1, $2, $3)",
      [mofId, payment.amount, payment.receivedOn],
    );
  }
  if (c.voAfterPayments !== undefined) {
    await t.db.query("update public.mofs set vo_amount = $1 where id = $2", [
      c.voAfterPayments,
      mofId,
    ]);
  }
  for (const payout of c.payouts ?? []) {
    await t.db.query(
      "insert into public.commission_payouts (mof_id, profile_id, amount, paid_on) values ($1, $2, $3, $4)",
      [mofId, t.profileIds[payout.person], payout.amount, loaDate],
    );
  }

  const people: CommissionPerson[] = PEOPLE.map((person) => ({
    id: t.profileIds[person],
    name: person,
    commissionMode: c.modes?.[person] ?? "standard",
  }));
  const input = {
    mof: {
      total: orderTotal({
        contractSum: c.contractSum ?? 10_000,
        voAmount: c.voAfterPayments ?? c.voAmount ?? 0,
      }),
      commissionType: kind,
      invoiceDate,
      loaDate,
      salespersonId: t.profileIds.sales,
      secondSalespersonId: id(c.second),
      passedById: id(c.passedBy),
    },
    cost: c.cost,
    payments,
    people,
    settings,
    today: await malaysiaDate(t),
  };
  return { mofId, input };
}

async function sqlPayableNow(mofId: string, person: Person) {
  const { rows } = await t.db.query<{ payable: string }>(
    "select public.commission_payable_now($1, $2)::text as payable",
    [mofId, t.profileIds[person]],
  );
  return Number(rows[0].payable);
}

describe("commission payable now: SQL matches TypeScript", () => {
  it.each(cases)("$name", async (c) => {
    const settings = { ...DEFAULT_COMMISSION_SETTINGS, ...c.settings };
    const { mofId, input } = await addCase(c, settings);
    const result = calculateCommission(input);

    for (const person of PEOPLE) {
      const commission = result.people.find(
        (line) => line.personId === t.profileIds[person],
      );
      const payouts = (c.payouts ?? [])
        .filter((payout) => payout.person === person)
        .map((payout) => payout.amount);
      const typescript = commission
        ? commissionBalance(commission, payouts).payableNow
        : 0;
      const expected = c.expected[person] ?? 0;

      expect({
        person,
        typescript,
        sql: await sqlPayableNow(mofId, person),
      }).toEqual({ person, typescript: expected, sql: expected });
    }
  });
});

describe("commission payouts", () => {
  beforeEach(async () => {
    await t.actAs(null);
    await t.db.query("delete from public.app_settings");
    await t.db.query("update public.profiles set commission_mode = 'standard'");
  });

  const addOrder = async (payments = PAID_IN_FULL) => {
    const { mofId } = await addCase(
      { name: "payout", cost: 6000, payments, expected: {} },
      DEFAULT_COMMISSION_SETTINGS,
    );
    return mofId;
  };

  const payOut = (mofId: string, amount: number, person: Person = "sales") =>
    t.db.query(
      "insert into public.commission_payouts (mof_id, profile_id, amount, paid_on) values ($1, $2, $3, current_date)",
      [mofId, t.profileIds[person], amount],
    );

  it("refuses a payout above what is payable now", async () => {
    const mofId = await addOrder();
    await t.actAs("accounts");

    await expect(payOut(mofId, 300.01)).rejects.toThrow(
      "That is more than the RM 300.00 left to pay out.",
    );
  });

  it("allows paying out exactly what is payable, then nothing more", async () => {
    const mofId = await addOrder();
    await t.actAs("md");
    await payOut(mofId, 200);

    await expect(payOut(mofId, 100.01)).rejects.toThrow(
      "That is more than the RM 100.00 left to pay out.",
    );
    await expect(payOut(mofId, 100)).resolves.toBeDefined();
    await expect(payOut(mofId, 0.01)).rejects.toThrow(
      "Nothing can be paid out on this order yet.",
    );
  });

  it("refuses any payout before the claim threshold", async () => {
    const mofId = await addOrder([{ amount: 5000, day: 0 }]);
    await t.actAs("accounts");

    await expect(payOut(mofId, 1)).rejects.toThrow(
      "Nothing can be paid out on this order yet.",
    );
  });

  it("refuses a payout to someone with no commission on the order", async () => {
    const mofId = await addOrder();
    await t.actAs("md");

    await expect(payOut(mofId, 1, "director")).rejects.toThrow(
      "Nothing can be paid out on this order yet.",
    );
  });

  it("refuses a payout on a cancelled order", async () => {
    const mofId = await addOrder();
    await t.db.query(
      "update public.mofs set stage = 'cancelled' where id = $1",
      [mofId],
    );
    await t.actAs("md");

    await expect(payOut(mofId, 1)).rejects.toThrow(
      "Nothing can be paid out on this order yet.",
    );
  });

  it("is not callable by anyone signed in, so the cost stays hidden", async () => {
    const mofId = await addOrder();
    await t.actAs("sales");

    await expect(sqlPayableNow(mofId, "sales")).rejects.toThrow(
      "permission denied",
    );
  });
});

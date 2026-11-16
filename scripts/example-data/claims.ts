import { addDays, type CalendarDate } from "../../src/lib/format/date.ts";
import { at, monthStart, previousMonthStart } from "./dates.ts";
import { exampleId } from "./ids.ts";
import { mofId } from "./orders.ts";
import type { PersonKey } from "./people.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

type ClaimStatus =
  | "draft"
  | "submitted"
  | "checked"
  | "returned"
  | "approved"
  | "paid";

/** A day of the claim month, 1-based. */
const dayOf = (month: CalendarDate, day: number): CalendarDate =>
  addDays(month, day - 1);

type ExpenseSeed = {
  day: number;
  type:
    | "petrol"
    | "toll"
    | "parking"
    | "outstation_meals"
    | "hotel"
    | "mileage"
    | "grab"
    | "others";
  description: string;
  amount?: number;
  km?: number;
  nights?: number;
  /** A photo is attached: R1, R2... in the order the rows are listed. */
  receipt?: boolean;
  /** The checker's change: the claimed amount stays in original_amount. */
  adjusted?: { amount: number; reason: string };
};

type ClaimSeed = {
  key: string;
  person: PersonKey;
  month: "twoBack" | "lastMonth" | "thisMonth";
  status: ClaimStatus;
  note?: string;
  remark?: string;
  returnReason?: string;
  receiptsReceived?: boolean;
  ot?: { claimed: number; approved: number; reason?: string };
  commissions?: Array<{ mof: string; amount: number; lateCut?: number }>;
  expenses: ExpenseSeed[];
  /** Who moved the claim on, in order; the claim's log is one entry per step. */
  steps: Array<{ status: Exclude<ClaimStatus, "draft">; by: PersonKey }>;
};

// Commission lines match the example payouts (commission_payouts in orders.ts): an approved
// claim is where the payout is written. The flags the app shows are worked out from these
// rows: a day with nothing logged, meals twice, over 150 km, hotel over budget, and the
// monthly petrol + toll + parking total (Vanisha's claim).
const SEEDS: ClaimSeed[] = [
  {
    key: "vernice-paid",
    person: "vernice",
    month: "twoBack",
    status: "paid",
    receiptsReceived: true,
    commissions: [{ mof: "m4", amount: 500, lateCut: 80 }],
    expenses: [
      {
        day: 6,
        type: "petrol",
        description: "Site visits, Cheras and Bangsar",
        amount: 86.4,
        receipt: true,
      },
      {
        day: 11,
        type: "toll",
        description: "KL to Seremban, client meeting",
        amount: 24.6,
        receipt: true,
      },
      {
        day: 18,
        type: "parking",
        description: "Parking at SLA Architects, Bangsar",
        amount: 12,
        receipt: true,
      },
    ],
    steps: [
      { status: "submitted", by: "vernice" },
      { status: "checked", by: "jany" },
      { status: "approved", by: "jany" },
      { status: "paid", by: "jany" },
    ],
  },
  {
    key: "vernice-approved",
    person: "vernice",
    month: "lastMonth",
    status: "approved",
    receiptsReceived: true,
    note: "Sutera ballroom paid late because their finance changed bank; I followed up weekly.",
    commissions: [{ mof: "m1", amount: 2400 }],
    expenses: [
      {
        day: 4,
        type: "mileage",
        description: "Sutera ballroom site visit",
        km: 62,
      },
      {
        day: 9,
        type: "parking",
        description: "Parking at Sutera head office",
        amount: 18,
        receipt: true,
      },
      {
        day: 15,
        type: "petrol",
        description: "Sutera and Kiara visits",
        amount: 92.5,
        receipt: true,
      },
    ],
    steps: [
      { status: "submitted", by: "vernice" },
      { status: "checked", by: "jany" },
      { status: "approved", by: "vicky" },
    ],
  },
  {
    key: "vanisha-submitted",
    person: "vanisha",
    month: "lastMonth",
    status: "submitted",
    note: "Johor trip was for the Orion tender site check.",
    expenses: [
      {
        day: 5,
        type: "mileage",
        description: "Johor Bahru site check and return",
        km: 180,
      },
      {
        day: 6,
        type: "hotel",
        description: "Hotel in Johor Bahru",
        amount: 900,
        nights: 2,
        receipt: true,
      },
      {
        day: 6,
        type: "outstation_meals",
        description: "Lunch, Johor Bahru",
        amount: 25,
      },
      {
        day: 6,
        type: "outstation_meals",
        description: "Lunch again, Johor Bahru",
        amount: 25,
      },
      {
        day: 12,
        type: "petrol",
        description: "Petrol for the month",
        amount: 620,
        receipt: true,
      },
      {
        day: 14,
        type: "toll",
        description: "Highway tolls, Johor trip and Penang",
        amount: 210,
        receipt: true,
      },
      {
        day: 20,
        type: "parking",
        description: "Parking at client offices",
        amount: 95,
        receipt: true,
      },
    ],
    steps: [{ status: "submitted", by: "vanisha" }],
  },
  {
    key: "awal-checked",
    person: "awal",
    month: "lastMonth",
    status: "checked",
    remark: "Receipts match. Grab fare adjusted to the one on the receipt.",
    receiptsReceived: true,
    ot: {
      claimed: 96,
      approved: 90,
      reason: "Hours corrected to the approved 3.5 hours.",
    },
    expenses: [
      {
        day: 7,
        type: "petrol",
        description: "Installation visits, Sutera ballroom",
        amount: 74,
        receipt: true,
      },
      {
        day: 13,
        type: "grab",
        description: "Grab from the site to the airport",
        amount: 60,
        receipt: true,
        adjusted: {
          amount: 48.5,
          reason: "The receipt shows RM 48.50, the rest was a tip.",
        },
      },
    ],
    steps: [
      { status: "submitted", by: "awal" },
      { status: "checked", by: "jany" },
    ],
  },
  {
    key: "crystal-returned",
    person: "crystal",
    month: "lastMonth",
    status: "returned",
    returnReason: "Toll receipt for the 12th is missing. Please attach it.",
    expenses: [
      {
        day: 12,
        type: "toll",
        description: "Client site, Klang",
        amount: 18.4,
      },
      {
        day: 19,
        type: "petrol",
        description: "Petrol, site visits",
        amount: 55,
        receipt: true,
      },
    ],
    steps: [
      { status: "submitted", by: "crystal" },
      { status: "returned", by: "jany" },
    ],
  },
  {
    key: "akmal-draft",
    person: "akmal",
    month: "thisMonth",
    status: "draft",
    expenses: [
      {
        day: 1,
        type: "parking",
        description: "Parking at the Kiara cafe site",
        amount: 8,
        receipt: true,
      },
    ],
    steps: [],
  },
];

const round2 = (n: number): number => Math.round(n * 100) / 100;
const MILEAGE_RATE_PER_KM = 0.6;

export function buildClaims({ people, today }: BuildContext): ExampleTable[] {
  const lastMonth = previousMonthStart(today);
  const months = {
    thisMonth: monthStart(today),
    lastMonth,
    twoBack: previousMonthStart(lastMonth),
  };

  const claims: Row[] = [];
  const commissions: Row[] = [];
  const expenses: Row[] = [];
  const log: Row[] = [];

  for (const seed of SEEDS) {
    const month = months[seed.month];
    // The claim is handled in the month after, so every stamp is on or before today.
    const nextMonth = monthStart(addDays(month, 31));
    const claimId = exampleId("monthly_claims", seed.key);
    const person = people[seed.person];
    const checker = people.jany;
    const done = seed.status !== "draft";

    claims.push({
      id: claimId,
      profile_id: person,
      month,
      status: seed.status,
      note: seed.note ?? "",
      remark: seed.remark ?? "",
      return_reason: seed.returnReason ?? null,
      original_receipts_received: seed.receiptsReceived ?? false,
      ot_original_amount: seed.ot?.claimed ?? null,
      ot_amount: seed.ot?.approved ?? null,
      ot_adjustment_reason: seed.ot?.reason ?? null,
      created_at: at(done ? addDays(month, 24) : month, 0, "09:00"),
    });

    for (const line of seed.commissions ?? []) {
      commissions.push({
        id: exampleId("monthly_claim_commissions", `${seed.key}:${line.mof}`),
        claim_id: claimId,
        mof_id: mofId(line.mof),
        profile_id: person,
        late_cut_amount: line.lateCut ?? 0,
        late_cut_waived: false,
        original_amount: line.amount,
        amount: line.amount,
        // Set by the claim's status trigger when the status changes in the app.
        pending: ["submitted", "checked", "approved"].includes(seed.status),
      });
    }

    let receiptNo = 0;
    for (const [index, line] of seed.expenses.entries()) {
      const claimed =
        line.type === "mileage"
          ? round2((line.km ?? 0) * MILEAGE_RATE_PER_KM)
          : (line.amount ?? 0);
      receiptNo += line.receipt ? 1 : 0;
      expenses.push({
        id: exampleId("monthly_claim_expenses", `${seed.key}:${index}`),
        claim_id: claimId,
        spent_on: dayOf(month, line.day),
        expense_type: line.type,
        description: line.description,
        km: line.km ?? null,
        nights: line.nights ?? null,
        original_amount: claimed,
        amount: line.adjusted?.amount ?? claimed,
        adjustment_reason: line.adjusted?.reason ?? null,
        adjusted_by: line.adjusted ? checker : null,
        adjusted_at: line.adjusted ? at(nextMonth, 0, "11:00") : null,
        // The receipt files are not in storage; the database only holds their paths.
        receipt_no: line.receipt ? receiptNo : null,
        receipt_path: line.receipt
          ? `claims/${claimId}/receipt-${receiptNo}.jpg`
          : null,
        receipt_file_name: line.receipt ? `receipt-${receiptNo}.jpg` : null,
        receipt_content_type: line.receipt ? "image/jpeg" : null,
      });
    }

    if (done) {
      for (const [index, step] of seed.steps.entries()) {
        log.push({
          id: exampleId("monthly_claim_log", `${seed.key}:${step.status}`),
          claim_id: claimId,
          status: step.status,
          note: step.status === "returned" ? seed.returnReason : null,
          changed_by: people[step.by],
          changed_at: at(nextMonth, 0, `${10 + index}:00`),
        });
      }
    }
  }

  return [
    { table: "monthly_claims", key: "id", rows: claims },
    {
      table: "monthly_claim_commissions",
      key: "id",
      rows: commissions,
      clearedByParent: true,
    },
    {
      table: "monthly_claim_expenses",
      key: "id",
      rows: expenses,
      clearedByParent: true,
    },
    {
      table: "monthly_claim_log",
      key: "id",
      rows: log,
      clearedByParent: true,
    },
  ];
}

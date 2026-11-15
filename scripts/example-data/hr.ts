import { addDays } from "../../src/lib/format/date.ts";
import { contactId, projectId } from "./customers.ts";
import { at } from "./dates.ts";
import { exampleId } from "./ids.ts";
import { type PersonKey, TEST_USERS } from "./people.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

type Allowance = { name: string; amount: number };

type PackageStep = {
  from: string | number;
  basic: number;
  reason: string;
  claimCap?: number;
  hotelLevel?: string;
  allowances?: Allowance[];
};

const SALES_ALLOWANCES: Allowance[] = [
  { name: "car", amount: 300 },
  { name: "office_parking", amount: 100 },
];
const SITE_ALLOWANCES: Allowance[] = [{ name: "motor_car", amount: 300 }];

// Dated history: a change is a new row. A number is days from today (an upcoming increment),
// a string is a fixed date. Directors have no package, as in the demo.
const PACKAGES: Partial<Record<PersonKey, PackageStep[]>> = {
  vernice: [
    {
      from: "2025-01-01",
      basic: 3000,
      reason: "Joined",
      allowances: SALES_ALLOWANCES,
    },
    {
      from: "2026-01-01",
      basic: 3400,
      reason: "Annual increment 2026",
      allowances: SALES_ALLOWANCES,
      claimCap: 600,
    },
    {
      from: 45,
      basic: 3800,
      reason: "Promotion S1 to S2",
      allowances: SALES_ALLOWANCES,
      claimCap: 700,
    },
  ],
  vanisha: [
    {
      from: "2025-06-01",
      basic: 3200,
      reason: "Joined",
      allowances: SALES_ALLOWANCES,
    },
    {
      from: "2026-06-01",
      basic: 3500,
      reason: "Annual increment 2026",
      allowances: SALES_ALLOWANCES,
    },
  ],
  cavan: [
    {
      from: "2026-02-01",
      basic: 2600,
      reason: "Joined",
      allowances: SALES_ALLOWANCES,
    },
  ],
  crystal: [
    {
      from: "2026-05-01",
      basic: 2400,
      reason: "Joined",
      allowances: SALES_ALLOWANCES,
    },
  ],
  awal: [
    {
      from: "2024-03-01",
      basic: 2400,
      reason: "Joined",
      allowances: SITE_ALLOWANCES,
    },
    {
      from: "2026-03-01",
      basic: 2650,
      reason: "Annual increment 2026",
      allowances: SITE_ALLOWANCES,
    },
  ],
  akmal: [
    {
      from: "2025-09-01",
      basic: 2300,
      reason: "Joined",
      allowances: SITE_ALLOWANCES,
    },
  ],
  sarah: [
    {
      from: "2025-02-01",
      basic: 2500,
      reason: "Joined",
      allowances: [{ name: "site", amount: 200 }],
    },
  ],
  jess: [{ from: "2024-08-01", basic: 3000, reason: "Joined" }],
  waimun: [
    {
      from: "2023-04-01",
      basic: 3600,
      reason: "Joined",
      allowances: [{ name: "phone", amount: 80 }],
    },
  ],
  affifa: [{ from: "2025-10-01", basic: 2800, reason: "Joined" }],
  liza: [{ from: "2025-10-01", basic: 2800, reason: "Joined" }],
};

// Grade per person, as in staff_hr_records. Crystal has no own target below, so she shows the
// grade fallback. Cavan signed the older scheme version, so he shows "needs the new one".
const GRADES: Partial<
  Record<
    PersonKey,
    {
      grade: string;
      signed: string | null;
      version: string | null;
      confirmed: string | null;
    }
  >
> = {
  eddie: {
    grade: "M1",
    signed: "2026-09-10",
    version: "2026-09-08",
    confirmed: null,
  },
  vanessa: {
    grade: "M1",
    signed: "2026-09-10",
    version: "2026-09-08",
    confirmed: null,
  },
  vernice: {
    grade: "S2",
    signed: "2026-09-10",
    version: "2026-09-08",
    confirmed: "2025-04-01",
  },
  vanisha: {
    grade: "S1",
    signed: "2026-09-11",
    version: "2026-09-08",
    confirmed: "2025-12-01",
  },
  cavan: {
    grade: "J3",
    signed: "2026-03-01",
    version: "2025-01-01",
    confirmed: "2026-08-01",
  },
  crystal: { grade: "J2", signed: null, version: null, confirmed: null },
};

const VISIT_TARGET: Partial<Record<PersonKey, number>> = {
  eddie: 6,
  vanessa: 6,
  vernice: 10,
  vanisha: 10,
  cavan: 10,
  crystal: 10,
};

const POLICY_LINK = "https://example.invalid/drive/";

/** HR sample data: packages, grades, per-year targets, policies, extra rules, one handover. */
export function buildHr({ people, today }: BuildContext): ExampleTable[] {
  const accounts = people.jany;
  const year = Number(today.slice(0, 4));

  const packages: Row[] = Object.entries(PACKAGES).flatMap(([key, steps]) =>
    (steps ?? []).map((step) => {
      const effectiveOn =
        typeof step.from === "number" ? addDays(today, step.from) : step.from;
      return {
        id: exampleId("staff_packages", `${key}:${effectiveOn}`),
        profile_id: people[key as PersonKey],
        effective_on: effectiveOn,
        basic: step.basic,
        allowances: step.allowances ?? [],
        claim_cap: step.claimCap ?? null,
        hotel_level: step.hotelLevel ?? null,
        reason: step.reason,
        added_by: accounts,
        added_at: at(today, -3, "10:00"),
      };
    }),
  );

  const records: Row[] = Object.entries(GRADES).map(([key, g]) => ({
    profile_id: people[key as PersonKey],
    grade: g?.grade,
    appendix_signed_on: g?.signed,
    appendix_version: g?.version,
    confirmed_on: g?.confirmed,
    note: "",
  }));

  // One row per person per year. The sync trigger keeps profiles.yearly_target equal to this
  // year's effective target, so test-users.ts no longer writes that column.
  const targets: Row[] = TEST_USERS.filter(
    (u) => u.yearlyTarget !== null || VISIT_TARGET[u.key] !== undefined,
  ).flatMap((u) =>
    [year, year + 1].map((y) => ({
      profile_id: people[u.key],
      year: y,
      sales_target:
        u.yearlyTarget === null
          ? null
          : Math.round((u.yearlyTarget * (y === year ? 1 : 1.1)) / 10000) *
            10000,
      visit_target: VISIT_TARGET[u.key] ?? null,
    })),
  );

  // The older version stays as history; the newer one names it in replaces_id.
  const olderClaims = exampleId("hr_policy_documents", "claims-2025");
  const policies: Row[] = [
    {
      id: exampleId("hr_policy_documents", "scheme"),
      category: "commission_target",
      title: "Appendix: Sales Target & Commission Scheme",
      version: "2026-09-08",
      effective_on: "2026-09-08",
      is_commission_scheme: true,
      link: `${POLICY_LINK}sales-target-commission-scheme`,
      note: "Part of the Letter of Appointment. Each salesperson signs the Employee Acknowledgement.",
      added_by: accounts,
      added_at: at(today, -60, "09:00"),
    },
    {
      id: olderClaims,
      category: "claims_expenses",
      title: "Claims & expenses policy",
      version: "2025-01-01",
      effective_on: "2025-01-01",
      link: `${POLICY_LINK}claims-2025`,
      note: "",
      added_by: accounts,
      added_at: at(today, -300, "09:00"),
    },
    {
      id: exampleId("hr_policy_documents", "claims-2026"),
      category: "claims_expenses",
      title: "Claims & expenses policy",
      version: "2026-06-01",
      effective_on: "2026-06-01",
      link: `${POLICY_LINK}claims-2026`,
      replaces_id: olderClaims,
      note: "Monthly cut-off moved to the 25th.",
      added_by: accounts,
      added_at: at(today, -120, "09:00"),
    },
    {
      id: exampleId("hr_policy_documents", "leave"),
      category: "leave",
      title: "Leave policy",
      version: "2026-01-01",
      effective_on: "2026-01-01",
      link: `${POLICY_LINK}leave`,
      note: "",
      added_by: accounts,
      added_at: at(today, -200, "09:00"),
    },
  ];

  // The demo's three rules added after the appendix; Vicky (MD) is the author.
  const rules: Row[] = [
    {
      key: "late-collection",
      starts_on: "2026-11-12",
      rule: "Late collection: payment received more than 90 days after invoice → commission −25%; more than 180 days → −50%. Salesperson may appeal; Vicky / Jany may give special approval as a one-time favour.",
    },
    {
      key: "monthly-report",
      starts_on: "2026-11-12",
      rule: "Monthly report: submit to Vicky by the 1st Monday of the next month. Monthly claim (commission + travel + OT): cut-off 25th – submit in the system to Jany, print the claim form, sign and attach the original receipts (R1, R2…). Explanations or appeals go in the note on the claim. All claims go to Jany. Jany checks and records any change (original claim vs final approved amount); the claim is approved by Jany or Vicky (Jany can pass it to Vicky). Site supervisor OT / replacement leave is approved by Eddie, Vicky or Jany.",
    },
    {
      key: "leave-days",
      starts_on: "2026-11-11",
      rule: "Annual leave 14 days, medical leave 14 days a year (company default; can be set per person).",
    },
  ].map(({ key, ...rest }) => ({
    id: exampleId("hr_extra_rules", key),
    ...rest,
    added_by: people.vicky,
    added_at: at(today, -3, "09:00"),
  }));

  // Lisa resigned: the hand_over_work function needs a signed-in admin, so the rows it would
  // have written are inserted directly. Vernice already owns this customer and project in the
  // seeded customers, which is the state after the handover.
  const handover: Row[] = [
    {
      id: exampleId("handover_items", "aiman"),
      from_id: people.lisa,
      to_id: people.vernice,
      contact_id: contactId("aiman"),
      project_id: null,
      handed_over_at: at(today, -5, "17:00"),
      handed_over_by: people.vicky,
    },
    {
      id: exampleId("handover_items", "meridian-showroom"),
      from_id: people.lisa,
      to_id: people.vernice,
      contact_id: null,
      project_id: projectId("meridian-showroom"),
      handed_over_at: at(today, -5, "17:00"),
      handed_over_by: people.vicky,
    },
  ];

  return [
    { table: "hr_policy_documents", key: "id", rows: policies },
    { table: "hr_extra_rules", key: "id", rows: rules },
    { table: "staff_hr_records", key: "profile_id", rows: records },
    { table: "staff_packages", key: "id", rows: packages },
    { table: "yearly_targets", key: "profile_id", rows: targets },
    { table: "handover_items", key: "id", rows: handover },
  ];
}

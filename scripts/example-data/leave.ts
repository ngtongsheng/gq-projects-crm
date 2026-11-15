import { at } from "./dates.ts";
import { exampleId } from "./ids.ts";
import { type PersonKey, TEST_USERS } from "./people.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

type Request = {
  key: string;
  person: PersonKey;
  type: string;
  from: string;
  to: string;
  half?: "am" | "pm";
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  /** Who rejects or approves each step, in order; the rest stay waiting. */
  decidedBy?: PersonKey[];
};

// 2027 dates, working days only. The database counts the days itself; `days` is its answer.
const REQUESTS: Request[] = [
  {
    key: "vernice-al",
    person: "vernice",
    type: "annual",
    from: "2027-03-01",
    to: "2027-03-03",
    days: 3,
    reason: "Family trip",
    status: "approved",
    decidedBy: ["eddie", "vicky"],
  },
  {
    key: "vanisha-al",
    person: "vanisha",
    type: "annual",
    from: "2027-04-12",
    to: "2027-04-14",
    days: 3,
    reason: "Moving house",
    status: "pending",
  },
  {
    key: "cavan-el",
    person: "cavan",
    type: "emergency",
    from: "2027-02-15",
    to: "2027-02-15",
    days: 1,
    reason: "Burst pipe at home",
    status: "rejected",
    decidedBy: ["vanessa"],
  },
  {
    key: "crystal-rl",
    person: "crystal",
    type: "replacement",
    from: "2027-05-17",
    to: "2027-05-18",
    days: 2,
    reason: "Worked the showroom weekend",
    status: "cancelled",
  },
  {
    key: "awal-al",
    person: "awal",
    type: "annual",
    from: "2027-06-04",
    to: "2027-06-04",
    half: "pm",
    days: 0.5,
    reason: "Appointment",
    status: "approved",
    decidedBy: ["eddie", "vicky"],
  },
  {
    key: "jany-cl",
    person: "jany",
    type: "compassionate",
    from: "2027-07-05",
    to: "2027-07-06",
    days: 2,
    reason: "Family bereavement",
    status: "approved",
    decidedBy: ["vicky"],
  },
  {
    key: "affifa-mc",
    person: "affifa",
    type: "mc",
    from: "2027-08-02",
    to: "2027-08-02",
    days: 1,
    reason: "Fever",
    status: "pending",
  },
];

/** The approvers the database adds for an application, as in add_leave_approval_steps. */
function stepsFor(person: PersonKey, ids: BuildContext["people"]): Row[] {
  const user = TEST_USERS.find((u) => u.key === person);
  if (!user) throw new Error(`No test person ${person}`);
  const lead = user.jobRole === "sales" ? user.reportsTo : null;
  if (lead) {
    return [
      { position: 1, approver_id: ids[lead], approver_role: null },
      { position: 2, approver_id: null, approver_role: "md" },
    ];
  }
  if (user.jobRole === "bd" || user.jobRole === "site") {
    return [
      { position: 1, approver_id: null, approver_role: "director" },
      { position: 2, approver_id: null, approver_role: "md" },
    ];
  }
  const role = user.jobRole === "md" ? "director" : "md";
  return [{ position: 1, approver_id: null, approver_role: role }];
}

/**
 * Everyone still here gets a 2027 entitlement, and one request per status (plus a few more types).
 * The database adds each request's approval steps itself, so the steps table is written as an
 * update of those rows (see `onConflict`).
 */
export function buildLeave({ people, today }: BuildContext): ExampleTable[] {
  const entitlements: Row[] = TEST_USERS.filter((u) => !u.left).map((u, i) => ({
    profile_id: people[u.key],
    year: 2027,
    annual_days: 14,
    carried_days: i % 3 === 0 ? 2 : 0,
    mc_days: 14,
  }));

  const requests: Row[] = [];
  const steps: Row[] = [];
  for (const r of REQUESTS) {
    const requestId = exampleId("leave_requests", r.key);
    const decided = r.status !== "pending";
    const decider = r.decidedBy?.at(-1) ?? r.person;
    requests.push({
      id: requestId,
      person_id: people[r.person],
      leave_type: r.type,
      starts_on: r.from,
      ends_on: r.to,
      half_day: r.half ?? null,
      days: r.days,
      reason: r.reason,
      status: r.status,
      applied_at: at(today, -10, "09:00"),
      decided_by: decided ? people[decider] : null,
      decided_at: decided ? at(today, -8, "10:00") : null,
      decision_note:
        r.status === "rejected" ? "Not enough cover that week." : "",
    });
    stepsFor(r.person, people).forEach((step, index) => {
      const by = r.decidedBy?.[index];
      if (!by) return;
      steps.push({
        request_id: requestId,
        ...step,
        decision: r.status === "rejected" ? "rejected" : "approved",
        decided_by: people[by],
        decided_at: at(today, -9 + index, "10:00"),
        note: "",
      });
    });
  }

  return [
    { table: "leave_entitlements", key: "profile_id", rows: entitlements },
    { table: "leave_requests", key: "id", rows: requests },
    {
      table: "leave_approval_steps",
      key: "request_id",
      rows: steps,
      clearedByParent: true,
      onConflict: "request_id,position",
    },
  ];
}

import { describe, expect, it } from "vitest";
import { JobRole } from "@/lib/auth/job-role";
import { ReportStats } from "@/lib/domain/report-stats";
import { buildExampleData } from "./dataset.ts";
import { exampleId } from "./ids.ts";
import { TEST_USERS } from "./people.ts";
import { EXAMPLE_REFERENCES } from "./table-references.ts";
import type { ExampleTable, People } from "./types.ts";

const people = Object.fromEntries(
  TEST_USERS.map((u) => [u.key, exampleId("profiles", u.key)]),
) as People;
const profileIds = new Set(Object.values(people));
const context = { people, today: "2026-11-02" };
const data = buildExampleData(context);

const table = (name: string): ExampleTable => {
  const found = data.tables.find((t) => t.table === name);
  if (!found) throw new Error(`No table ${name}`);
  return found;
};

const GRADES = [
  "J1",
  "J2",
  "J3",
  "S1",
  "S2",
  "S3",
  "SN1",
  "SN2",
  "SN3",
  "M1",
  "M2",
];

const PROFILE_COLUMNS = [
  "passed_by",
  "requested_by",
  "decided_by",
  "owner_id",
  "pic_id",
  "support_id",
  "salesperson_id",
  "second_salesperson_id",
  "office_pic_id",
  "site_supervisor_id",
  "supervisor_id",
  "profile_id",
  "reserved_by",
  "reviewed_by",
  "assignee_id",
  "assigned_by",
  "approved_by",
  "by_id",
  "person_id",
  "approver_id",
  "added_by",
  "from_id",
  "to_id",
  "handed_over_by",
  "measurement_to",
  "photos_to",
  "photos_saved_by",
  "done_by",
  "created_by",
];

describe("example data", () => {
  it("is the same every time for the same day", () => {
    expect(buildExampleData(context)).toEqual(data);
  });

  it("fills every module with rows", () => {
    const empty = data.tables
      .filter(
        (t) =>
          t.rows.length === 0 &&
          t.table !== "mof_total_changes" &&
          t.table !== "mof_changes",
      )
      .map((t) => t.table);
    expect(empty).toEqual([]);
  });

  it("gives every row of a table its own key", () => {
    for (const spec of data.tables) {
      if (spec.key !== "id") continue;
      const ids = spec.rows.map((r) => r.id);
      expect(new Set(ids).size, spec.table).toBe(ids.length);
    }
  });

  it("only points at rows that exist and are inserted earlier", () => {
    const seen = new Map<string, Set<unknown>>();
    for (const spec of data.tables) {
      for (const [column, parent] of Object.entries(
        EXAMPLE_REFERENCES[spec.table] ?? {},
      )) {
        // A table pointing at itself (a policy replacing an older one) lists the older row first.
        const ids =
          parent === spec.table
            ? new Set(spec.rows.map((r) => r.id))
            : seen.get(parent);
        for (const row of spec.rows) {
          const value = row[column];
          if (value === null || value === undefined) continue;
          // The grades are filled by the migration, not by the example data.
          if (parent === "sales_grades") {
            expect(GRADES).toContain(value);
            continue;
          }
          expect(ids?.has(value), `${spec.table}.${column}`).toBe(true);
        }
      }
      for (const row of spec.rows) {
        for (const column of PROFILE_COLUMNS) {
          const value = row[column];
          if (value === null || value === undefined) continue;
          expect(profileIds.has(String(value)), `${spec.table}.${column}`).toBe(
            true,
          );
        }
      }
      seen.set(spec.table, new Set(spec.rows.map((r) => r.id)));
    }
  });

  it("keeps to the customer rules", () => {
    for (const c of table("contacts").rows) {
      expect(String(c.mobile)).toMatch(/^60[0-9]{8,10}$/);
      expect(c.account_type === "pass_down").toBe(c.passed_by !== null);
    }
    const perContact = new Map<unknown, number>();
    for (const o of table("contact_owners").rows) {
      perContact.set(o.contact_id, (perContact.get(o.contact_id) ?? 0) + 1);
    }
    expect(Math.max(...perContact.values())).toBeLessThanOrEqual(2);
    const names = table("companies").rows.map((r) =>
      String(r.name).toLowerCase(),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps to the order rules", () => {
    for (const m of table("mofs").rows) {
      expect(m.mof_no).toBe(String(m.mof_no).toUpperCase());
      expect(Number(m.contract_sum) + Number(m.vo_amount)).toBeGreaterThan(0);
      expect(m.second_salesperson_id).not.toBe(m.salesperson_id);
    }
    const zoho = [
      ...table("supplier_pos").rows.map((r) => r.zoho_no),
      ...table("delivery_orders")
        .rows.map((r) => r.running_no)
        .filter((n) => n !== null),
    ];
    expect(new Set(zoho).size).toBe(zoho.length);
  });

  it("starts every Done delivery as scheduled so its DO number can come first", () => {
    const jobs = table("jobs").rows;
    expect(data.deliveriesToFinish.length).toBeGreaterThan(0);
    for (const id of data.deliveriesToFinish) {
      const job = jobs.find((j) => j.id === id);
      expect(job?.job_type).toBe("delivery");
      expect(job?.status).toBe("scheduled");
    }
    const doJobs = new Set(table("delivery_orders").rows.map((r) => r.job_id));
    for (const id of data.deliveriesToFinish) expect(doJobs.has(id)).toBe(true);
  });

  it("claims are never verified or paid (that needs a signed-in person)", () => {
    for (const claim of table("installer_claims").rows) {
      expect(claim.verified_by).toBeUndefined();
      expect(claim.paid_on).toBeUndefined();
    }
  });

  it("holds no more stock than there is", () => {
    const qty = new Map(
      table("stock_items").rows.map((r) => [r.id, Number(r.qty)]),
    );
    const held = new Map<unknown, number>();
    for (const r of table("stock_reservations").rows) {
      if (r.status === "released" || r.status === "cancelled") continue;
      held.set(r.item_id, (held.get(r.item_id) ?? 0) + Number(r.qty));
    }
    for (const [item, total] of held) {
      expect(total).toBeLessThanOrEqual(qty.get(item) ?? 0);
    }
  });

  it("freezes report figures in the shape the app reads", () => {
    for (const report of table("monthly_reports").rows) {
      expect(
        (report.status === "draft") === (report.submitted_at === null),
      ).toBe(true);
      if (report.stats !== null) {
        expect(ReportStats.safeParse(report.stats).success).toBe(true);
      }
    }
  });

  it("files OT hours the way the database works them out", () => {
    const hours = table("ot_claims").rows.map((r) => r.hours);
    expect(hours).toContain(3.5);
    expect(hours.every((h) => Number(h) > 0)).toBe(true);
  });
});

describe("monthly claims", () => {
  it("has a claim in every status, each with a log entry per step", () => {
    const claims = table("monthly_claims").rows;
    expect(new Set(claims.map((c) => c.status))).toEqual(
      new Set([
        "draft",
        "submitted",
        "checked",
        "returned",
        "approved",
        "paid",
      ]),
    );
    const logged = new Map<unknown, number>();
    for (const entry of table("monthly_claim_log").rows) {
      logged.set(entry.claim_id, (logged.get(entry.claim_id) ?? 0) + 1);
    }
    for (const claim of claims) {
      expect(logged.has(claim.id), String(claim.status)).toBe(
        claim.status !== "draft",
      );
    }
  });

  it("numbers receipts R1, R2... under the claim's own folder, none for mileage", () => {
    const perClaim = new Map<unknown, number[]>();
    for (const e of table("monthly_claim_expenses").rows) {
      if (e.receipt_path === null) {
        expect(e.receipt_no).toBeNull();
        continue;
      }
      expect(e.expense_type).not.toBe("mileage");
      expect(String(e.receipt_path).startsWith(`claims/${e.claim_id}/`)).toBe(
        true,
      );
      perClaim.set(e.claim_id, [
        ...(perClaim.get(e.claim_id) ?? []),
        Number(e.receipt_no),
      ]);
    }
    expect(perClaim.size).toBeGreaterThan(0);
    for (const numbers of perClaim.values()) {
      expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    }
  });

  it("keeps every adjusted line's reason and keeps one pending commission line per order", () => {
    const lines = [
      ...table("monthly_claim_expenses").rows,
      ...table("monthly_claim_commissions").rows,
    ];
    expect(lines.some((l) => l.amount !== l.original_amount)).toBe(true);
    for (const l of lines) {
      if (l.amount !== l.original_amount)
        expect(l.adjustment_reason).toBeTruthy();
    }
    const pending = table("monthly_claim_commissions")
      .rows.filter((l) => l.pending)
      .map((l) => `${l.mof_id}:${l.profile_id}`);
    expect(new Set(pending).size).toBe(pending.length);
  });

  it("gives flagged examples: meals twice, over 150 km, a hotel by the night", () => {
    const rows = table("monthly_claim_expenses").rows;
    const meals = rows.filter((r) => r.expense_type === "outstation_meals");
    expect(
      new Set(meals.map((r) => `${r.claim_id}:${r.spent_on}`)).size,
    ).toBeLessThan(meals.length);
    expect(
      rows.some((r) => r.expense_type === "mileage" && Number(r.km) > 150),
    ).toBe(true);
    expect(rows.some((r) => r.expense_type === "hotel" && r.nights)).toBe(true);
  });
});

describe("site work", () => {
  const logs = () => table("site_logs").rows;

  it("logs visits with and without an MOF, as the database requires", () => {
    expect(logs().some((l) => l.mof_id === null)).toBe(true);
    expect(logs().some((l) => l.mof_id !== null)).toBe(true);
    for (const log of logs()) {
      if (log.mof_id === null) {
        expect(log.site_name, String(log.id)).toBeTruthy();
        expect(log.salesperson_id, String(log.id)).toBeTruthy();
      } else {
        expect(log.site_name ?? null).toBeNull();
        expect(log.salesperson_id ?? null).toBeNull();
        expect(log.project_id ?? null).toBeNull();
      }
      if (log.inst_pct !== undefined) expect(log.activity).toBe("installation");
      if (log.delivery_ok !== undefined) expect(log.activity).toBe("delivery");
      if (log.measurement_to !== undefined) {
        expect(log.activity).toBe("measurement");
      }
      if (log.photos_to !== undefined) {
        expect(["shooting", "handover"]).toContain(log.activity);
      }
      expect(log.photos_saved_at === undefined).toBe(
        log.photos_saved_by === undefined,
      );
    }
  });

  it("has a log for every activity", () => {
    expect(new Set(logs().map((l) => l.activity))).toEqual(
      new Set([
        "measurement",
        "inspection",
        "installation",
        "handover",
        "shooting",
        "delivery",
        "stock_return",
      ]),
    );
  });

  it("has follow-ups with an assignee, a closed one, and waits on open ones", () => {
    const followUps = table("site_follow_ups").rows;
    expect(followUps.some((f) => f.assignee_id)).toBe(true);
    for (const f of followUps) {
      expect(f.done_at === undefined).toBe(f.done_by === undefined);
    }
    const closed = new Set(followUps.filter((f) => f.done_at).map((f) => f.id));
    expect(closed.size).toBeGreaterThan(0);
    const waits = table("site_follow_up_waits").rows;
    expect(waits.length).toBeGreaterThan(0);
    for (const w of waits) expect(closed.has(w.follow_up_id)).toBe(false);
  });

  it("has days off with the end on or after the start", () => {
    for (const off of table("site_off").rows) {
      expect(["office", "other"]).toContain(off.kind);
      expect(String(off.ends_on) >= String(off.starts_on)).toBe(true);
    }
  });

  it("has shoot requests in each state, done ones stamped", () => {
    const requests = table("shoot_requests").rows;
    expect(new Set(requests.map((r) => r.status))).toEqual(
      new Set(["requested", "done", "cancelled"]),
    );
    for (const r of requests) {
      expect(r.status === "done").toBe(r.done_at !== undefined);
      expect(r.done_at === undefined).toBe(r.done_by === undefined);
    }
  });
});

describe("tasks and leave", () => {
  it("has a task in every status and leave in every status", () => {
    const statuses = (name: string) =>
      new Set(table(name).rows.map((r) => r.status));
    expect(statuses("tasks")).toEqual(
      new Set([
        "not_started",
        "in_progress",
        "pending_review",
        "revision_required",
        "completed",
      ]),
    );
    expect(statuses("leave_requests")).toEqual(
      new Set(["pending", "approved", "rejected", "cancelled"]),
    );
  });

  it("keeps to the task and leave table rules", () => {
    for (const t of table("tasks").rows) {
      expect(String(t.due_on) >= String(t.assigned_on)).toBe(true);
      expect(t.assignee_id).not.toBe(t.assigned_by);
      expect(t.status === "completed").toBe(t.completed_at !== null);
    }
    for (const e of table("leave_entitlements").rows) {
      expect(e.year).toBeGreaterThanOrEqual(2027);
    }
    for (const r of table("leave_requests").rows) {
      expect(String(r.starts_on).startsWith("2027")).toBe(true);
      expect(r.status === "pending").toBe(r.decided_at === null);
    }
  });
});

describe("test sign-ins", () => {
  it("has the demo's 17 people, each with an unusable email domain", () => {
    expect(TEST_USERS).toHaveLength(17);
    expect(new Set(TEST_USERS.map((u) => u.email)).size).toBe(17);
    for (const u of TEST_USERS) expect(u.email).toMatch(/@example\.invalid$/);
    expect(new Set(TEST_USERS.map((u) => u.jobRole))).toEqual(
      new Set(JobRole.options),
    );
  });

  it("matches the demo's flags and left staff", () => {
    const by = (key: string) => TEST_USERS.find((u) => u.key === key);
    expect(by("vicky")?.role).toBe("admin");
    expect(by("sarah")?.sells).toBe(true);
    expect(by("jess")?.arrangesStock).toBe(true);
    expect(by("waimun")?.seesMargin).toBe(true);
    expect(TEST_USERS.filter((u) => u.left).map((u) => u.key)).toEqual([
      "lisa",
      "marketingexec",
    ]);
  });

  it("puts every salesperson in a team led by a director or bd", () => {
    for (const u of TEST_USERS) {
      if (u.jobRole !== "sales") {
        expect(u.reportsTo, u.key).toBeNull();
        continue;
      }
      const lead = TEST_USERS.find((l) => l.key === u.reportsTo);
      expect(["director", "bd"], u.key).toContain(lead?.jobRole);
    }
  });
});

describe("HR sample data", () => {
  const years = (profile: string) =>
    table("yearly_targets")
      .rows.filter((r) => r.profile_id === profile)
      .map((r) => r.year);

  it("gives each target person a row for this year and the next", () => {
    const year = Number(context.today.slice(0, 4));
    expect(years(people.vernice)).toEqual([year, year + 1]);
  });

  it("keeps package history to one row per person per date, written by an HR person", () => {
    const rows = table("staff_packages").rows;
    const keys = rows.map((r) => `${r.profile_id}:${r.effective_on}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(rows.some((r) => String(r.effective_on) > context.today)).toBe(true);
    for (const r of [...rows, ...table("hr_policy_documents").rows]) {
      expect([people.jany, people.vicky]).toContain(r.added_by);
    }
  });

  it("flags one scheme document and one policy that replaces another", () => {
    const docs = table("hr_policy_documents").rows;
    expect(docs.filter((d) => d.is_commission_scheme)).toHaveLength(1);
    expect(docs.filter((d) => d.replaces_id)).toHaveLength(1);
  });

  it("hands over from a person who has left", () => {
    const leavers = new Set(
      TEST_USERS.filter((u) => u.left).map((u) => people[u.key]),
    );
    for (const item of table("handover_items").rows) {
      expect(leavers.has(String(item.from_id))).toBe(true);
      expect((item.contact_id === null) !== (item.project_id === null)).toBe(
        true,
      );
    }
  });
});

import { describe, expect, it } from "vitest";
import { ReportStats } from "@/lib/domain/report-stats";
import { buildExampleData } from "./dataset.ts";
import { exampleId } from "./ids.ts";
import { TEST_USERS } from "./people.ts";
import { EXAMPLE_REFERENCES } from "./table-references.ts";
import type { ExampleTable, People } from "./types.ts";

const people = Object.fromEntries(
  TEST_USERS.map((u) => [u.jobRole, exampleId("profiles", u.jobRole)]),
) as People;
const profileIds = new Set(Object.values(people));
const context = { people, today: "2026-11-02" };
const data = buildExampleData(context);

const table = (name: string): ExampleTable => {
  const found = data.tables.find((t) => t.table === name);
  if (!found) throw new Error(`No table ${name}`);
  return found;
};

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
];

describe("example data", () => {
  it("is the same every time for the same day", () => {
    expect(buildExampleData(context)).toEqual(data);
  });

  it("fills every module with rows", () => {
    const empty = data.tables
      .filter((t) => t.rows.length === 0 && t.table !== "mof_total_changes")
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
        const ids = seen.get(parent);
        for (const row of spec.rows) {
          const value = row[column];
          if (value === null || value === undefined) continue;
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

describe("test sign-ins", () => {
  it("has one per job role with an unusable email domain", () => {
    expect(TEST_USERS.map((u) => u.jobRole).sort()).toEqual([
      "accounts",
      "bd",
      "director",
      "md",
      "sales",
      "site",
      "support",
    ]);
    for (const u of TEST_USERS) expect(u.email).toMatch(/@example\.invalid$/);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { addMof } from "./fixtures";
import {
  applyMigrations,
  createTestDatabase,
  type TestDatabase,
} from "./harness";

// Loop 14 task 04: field-level MOF change history. Order total changes are copied in from
// mof_total_changes (the old rows once, new ones by trigger); a completed job needs a reason;
// cost rows reach only the cost readers.

const MIGRATION = "20261115170000_mof_changes.sql";

let t: TestDatabase;
let backfilledMof: string;

type ChangeRow = {
  field: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  changed_by: string | null;
};

async function asService<Row>(sql: string, params: unknown[] = []) {
  await t.actAs(null);
  const { rows } = await t.db.query<Row>(sql, params);
  return rows;
}

async function changesSeenBy(jobRole: JobRole | null, mofId: string) {
  await t.actAs(jobRole);
  const { rows } = await t.db.query<ChangeRow>(
    `select field, old_value, new_value, reason, changed_by from public.mof_changes
     where mof_id = $1 order by created_at, field`,
    [mofId],
  );
  return rows;
}

async function mofFields(mofId: string) {
  const [row] = await asService<Record<string, unknown>>(
    `select mof_no, loa_date::text, salesperson_id, company_name, project_name, scope,
       installer_name, contract_sum::float8, vo_amount::float8, retention_pct::float8,
       commission_type, stage, payment_checked, approvals_in_writing, artwork_signed_off,
       dos_pre_approved
     from public.mofs where id = $1`,
    [mofId],
  );
  return row;
}

type Change = {
  field: string;
  old_value: string | null;
  new_value: string | null;
};

async function saveMof(
  jobRole: JobRole,
  mofId: string,
  options: {
    mof?: Record<string, unknown>;
    reason?: string;
    cost?: number | null;
    changes?: Change[];
  } = {},
) {
  const mof = { ...(await mofFields(mofId)), ...options.mof };
  await t.actAs(jobRole);
  await t.db.query("select public.save_mof($1, $2, $3, $4, $5, $6)", [
    mofId,
    JSON.stringify(mof),
    JSON.stringify([
      {
        product: "Carpet Tile",
        stock_type: "stock",
        qty: 10,
        unit: "m2",
        area_m2: 10,
      },
    ]),
    options.reason ?? "",
    options.cost ?? null,
    JSON.stringify(options.changes ?? []),
  ]);
}

beforeAll(async () => {
  t = await createTestDatabase({ migrationsBefore: MIGRATION });
  backfilledMof = await addMof(t, 1000);
  await asService(
    `insert into public.mof_total_changes (mof_id, old_total, new_total, reason, changed_by)
     values ($1, 1000, 1200, 'CN-0412: 40 m² returned', $2)`,
    [backfilledMof, t.profileIds.accounts],
  );
  await applyMigrations(t.db, { from: MIGRATION });
});

afterAll(async () => {
  await t.close();
});

describe("mof_changes: copied from mof_total_changes", () => {
  it("copies the order total changes saved before", async () => {
    expect(await changesSeenBy(null, backfilledMof)).toEqual([
      {
        field: "order_total",
        old_value: "1000.00",
        new_value: "1200.00",
        reason: "CN-0412: 40 m² returned",
        changed_by: t.profileIds.accounts,
      },
    ]);
  });

  it("keeps the old table's rows", async () => {
    const rows = await asService(
      "select 1 from public.mof_total_changes where mof_id = $1",
      [backfilledMof],
    );
    expect(rows).toHaveLength(1);
  });

  it("copies a new VO's order total change", async () => {
    const mofId = await addMof(t, 1000);
    await asService(
      `insert into public.mof_variation_orders (mof_id, vo_no, confirmed_on, amount, description)
       values ($1, 'VO1', '2026-11-02', 250, 'Extra carpet tile for pantry')`,
      [mofId],
    );
    expect(await changesSeenBy(null, mofId)).toEqual([
      expect.objectContaining({
        field: "order_total",
        old_value: "1000.00",
        new_value: "1250.00",
      }),
    ]);
  });
});

describe("save_mof: records the field changes", () => {
  it("records each posted change with the reason and who saved it", async () => {
    const mofId = await addMof(t);
    await saveMof("support", mofId, {
      mof: { installer_name: "Ah Seng" },
      reason: "Leong is on leave",
      changes: [
        { field: "installer_name", old_value: null, new_value: "Ah Seng" },
      ],
    });

    expect(await changesSeenBy(null, mofId)).toEqual([
      {
        field: "installer_name",
        old_value: null,
        new_value: "Ah Seng",
        reason: "Leong is on leave",
        changed_by: t.profileIds.support,
      },
    ]);
  });

  it("keeps a blank reason as none", async () => {
    const mofId = await addMof(t);
    await saveMof("md", mofId, {
      changes: [{ field: "scope", old_value: "s_and_l", new_value: "supply" }],
      mof: { scope: "supply" },
    });
    const [row] = await changesSeenBy(null, mofId);
    expect(row.reason).toBeNull();
  });

  it("records a contract change and the order total it moves", async () => {
    const mofId = await addMof(t, 1000);
    await saveMof("md", mofId, {
      mof: { contract_sum: 900 },
      reason: "Lobby omitted",
      changes: [{ field: "contract_sum", old_value: "1000", new_value: "900" }],
    });
    const fields = (await changesSeenBy(null, mofId)).map((row) => row.field);
    expect(fields.sort()).toEqual(["contract_sum", "order_total"]);
  });
});

describe("save_mof: a completed job needs a reason", () => {
  let mofId: string;

  beforeAll(async () => {
    mofId = await addMof(t);
    await asService(
      "update public.mofs set site_stage = 'completed' where id = $1",
      [mofId],
    );
  });

  const installerChange = (to: string): Change[] => [
    { field: "installer_name", old_value: null, new_value: to },
  ];

  it("refuses a change without a reason and keeps nothing", async () => {
    await expect(
      saveMof("md", mofId, {
        mof: { installer_name: "Ah Seng" },
        reason: "  ",
        changes: installerChange("Ah Seng"),
      }),
    ).rejects.toThrow(/already completed/);
    expect(await changesSeenBy(null, mofId)).toEqual([]);
    expect((await mofFields(mofId)).installer_name).toBeNull();
  });

  it("saves the change with a reason", async () => {
    await saveMof("md", mofId, {
      mof: { installer_name: "Ah Seng" },
      reason: "Snagging by a second team",
      changes: installerChange("Ah Seng"),
    });
    expect(await changesSeenBy(null, mofId)).toHaveLength(1);
  });

  it("lets a save without changes through", async () => {
    await expect(saveMof("md", mofId)).resolves.toBeUndefined();
  });
});

describe("mof_changes: who reads and writes", () => {
  let mofId: string;

  beforeAll(async () => {
    mofId = await addMof(t);
    await saveMof("md", mofId, {
      mof: { installer_name: "Ah Seng" },
      cost: 700,
      changes: [
        { field: "cost", old_value: null, new_value: "700" },
        { field: "installer_name", old_value: null, new_value: "Ah Seng" },
      ],
    });
  });

  it("shows cost rows to those who see the cost", async () => {
    for (const jobRole of ["md", "support", "accounts"] as const) {
      const fields = (await changesSeenBy(jobRole, mofId)).map(
        (row) => row.field,
      );
      expect(fields).toContain("cost");
    }
  });

  it("hides cost rows from the order's salesperson, who sees the rest", async () => {
    const fields = (await changesSeenBy("sales", mofId)).map(
      (row) => row.field,
    );
    expect(fields).toEqual(["installer_name"]);
  });

  it("refuses an order total row written by hand", async () => {
    await t.actAs("md");
    await expect(
      t.db.query(
        `insert into public.mof_changes (mof_id, field, old_value, new_value)
         values ($1, 'order_total', '1', '2')`,
        [mofId],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("refuses a row from someone who cannot change an MOF", async () => {
    await t.actAs("sales");
    await expect(
      t.db.query(
        `insert into public.mof_changes (mof_id, field, old_value, new_value)
         values ($1, 'installer_name', 'a', 'b')`,
        [mofId],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not let anyone post who made the change", async () => {
    await t.actAs("md");
    await expect(
      t.db.query(
        `insert into public.mof_changes (mof_id, field, changed_by)
         values ($1, 'installer_name', $2)`,
        [mofId, t.profileIds.sales],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

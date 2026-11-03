import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 finding 14: an MOF, its lines, order total and cost are saved together or not at all.

let t: TestDatabase;
let counter = 0;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

const mofFields = (overrides: Record<string, unknown> = {}) => ({
  mof_no: `MOF-SAVE-${++counter}`,
  loa_date: "2026-11-02",
  salesperson_id: t.profileIds.sales,
  company_name: "Test Co",
  project_name: "Test Project",
  scope: "s_and_l",
  contract_sum: 1000,
  vo_amount: 0,
  retention_pct: 0,
  commission_type: "own",
  stage: "pending_order",
  payment_checked: false,
  approvals_in_writing: false,
  artwork_signed_off: false,
  dos_pre_approved: false,
  ...overrides,
});

const line = (overrides: Record<string, unknown> = {}) => ({
  product: "Carpet Tile",
  stock_type: "stock",
  supplier: null,
  qty: 10,
  unit: "m2",
  area_m2: 10,
  ...overrides,
});

type SaveArgs = {
  mofId?: string | null;
  mof: Record<string, unknown>;
  lines: Record<string, unknown>[];
  reason?: string;
  cost?: number | null;
};

async function saveMof(jobRole: JobRole, args: SaveArgs) {
  await t.actAs(jobRole);
  const { rows } = await t.db.query<{ id: string }>(
    "select public.save_mof($1, $2, $3, $4, $5) as id",
    [
      args.mofId ?? null,
      JSON.stringify(args.mof),
      JSON.stringify(args.lines),
      args.reason ?? "",
      args.cost ?? null,
    ],
  );
  return rows[0].id;
}

async function count(sql: string, params: unknown[]) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ n: number }>(sql, params);
  return Number(rows[0].n);
}

const mofsNumbered = (mofNo: unknown) =>
  count("select count(*) as n from public.mofs where mof_no = $1", [mofNo]);

describe("save_mof: a new MOF", () => {
  it("saves the MOF, its lines and cost", async () => {
    const mof = mofFields();
    const id = await saveMof("md", { mof, lines: [line()], cost: 800 });

    expect(
      await count(
        "select count(*) as n from public.mof_lines where mof_id = $1",
        [id],
      ),
    ).toBe(1);
    expect(
      await count(
        "select count(*) as n from public.mof_costs where mof_id = $1",
        [id],
      ),
    ).toBe(1);
  });

  it("keeps no MOF when a line fails, and a retry works", async () => {
    const mof = mofFields();

    await expect(
      saveMof("support", { mof, lines: [line(), line({ product: " " })] }),
    ).rejects.toThrow(/mof_lines_product_check/);
    expect(await mofsNumbered(mof.mof_no)).toBe(0);

    await saveMof("support", { mof, lines: [line()] });
    expect(await mofsNumbered(mof.mof_no)).toBe(1);
  });

  it("refuses a cost from Purchasing and keeps nothing", async () => {
    const mof = mofFields();

    await expect(
      saveMof("support", { mof, lines: [line()], cost: 800 }),
    ).rejects.toThrow(/mof_costs/);
    expect(await mofsNumbered(mof.mof_no)).toBe(0);
  });

  it("refuses a salesperson", async () => {
    const mof = mofFields();

    await expect(saveMof("sales", { mof, lines: [line()] })).rejects.toThrow(
      /row-level security/,
    );
    expect(await mofsNumbered(mof.mof_no)).toBe(0);
  });
});

describe("save_mof: an existing MOF", () => {
  async function registered() {
    const mof = mofFields();
    const id = await saveMof("md", { mof, lines: [line()] });
    await t.actAs(null);
    const { rows } = await t.db.query<{ id: string }>(
      "select id from public.mof_lines where mof_id = $1",
      [id],
    );
    return { id, mof, lineId: rows[0].id };
  }

  it("removes, changes and adds lines and records a total change", async () => {
    const { id, mof, lineId } = await registered();

    await saveMof("support", {
      mofId: id,
      mof: { ...mof, vo_amount: -100 },
      lines: [line({ id: lineId, qty: 20 }), line({ product: "Carpet Roll" })],
      reason: "CN-1",
    });

    await t.actAs(null);
    const { rows } = await t.db.query<{ product: string; qty: string }>(
      "select product, qty from public.mof_lines where mof_id = $1 order by product",
      [id],
    );
    expect(rows).toEqual([
      { product: "Carpet Roll", qty: "10.00" },
      { product: "Carpet Tile", qty: "20.00" },
    ]);
    expect(
      await count(
        "select count(*) as n from public.mof_total_changes where mof_id = $1 and reason = 'CN-1'",
        [id],
      ),
    ).toBe(1);
  });

  it("keeps the saved MOF as it was when a line fails", async () => {
    const { id, mof, lineId } = await registered();

    await expect(
      saveMof("support", {
        mofId: id,
        mof: { ...mof, project_name: "Renamed", contract_sum: 2000 },
        lines: [line({ id: lineId, qty: -1 })],
        reason: "Bigger order",
      }),
    ).rejects.toThrow(/mof_lines_qty_check/);

    await t.actAs(null);
    const { rows } = await t.db.query<{
      project_name: string;
      contract_sum: string;
    }>("select project_name, contract_sum from public.mofs where id = $1", [
      id,
    ]);
    expect(rows[0]).toEqual({
      project_name: "Test Project",
      contract_sum: "1000.00",
    });
  });

  it("refuses a change in order total without a reason", async () => {
    const { id, mof } = await registered();

    await expect(
      saveMof("support", {
        mofId: id,
        mof: { ...mof, contract_sum: 2000 },
        lines: [line()],
        reason: " ",
      }),
    ).rejects.toThrow(/Give the reason/);
  });

  it("refuses a cost from Purchasing", async () => {
    const { id, mof, lineId } = await registered();

    await expect(
      saveMof("support", {
        mofId: id,
        mof,
        lines: [line({ id: lineId })],
        cost: 800,
      }),
    ).rejects.toThrow(/mof_costs/);
  });
});

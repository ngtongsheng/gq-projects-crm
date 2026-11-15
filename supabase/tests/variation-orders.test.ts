import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JobRole } from "@/lib/auth/job-role";
import {
  applyMigrations,
  createTestDatabase,
  type TestDatabase,
} from "./harness";

// Loop 14 D1: variation orders. Each saved VO amount becomes one VO at the LOA date, a trigger
// keeps mofs.vo_amount equal to the VOs' sum, VOs are read like their MOF, and VO cost adds
// into the MOF cost.

const MIGRATION = "20261115210000_variation_orders.sql";

let t: TestDatabase;
let n = 0;

type BackfillCase = { mofId: string; loaDate: string; vo: number };
const backfill: BackfillCase[] = [];

async function asService<T>(sql: string, params: unknown[] = []) {
  await t.actAs(null);
  const { rows } = await t.db.query<T>(sql, params);
  return rows;
}

/** An MOF as the service role; before the migration it may carry a VO amount. */
async function addMof(
  salespersonId: string,
  { vo = 0, loaDate = "2026-03-10", contractSum = 1000 } = {},
) {
  n += 1;
  const [mof] = await asService<{ id: string }>(
    `insert into public.mofs (mof_no, loa_date, salesperson_id, company_name, project_name,
       contract_sum, vo_amount)
     values ($1, $2, $3, 'VO Co', 'VO Project', $4, $5) returning id`,
    [`VO-${n}`, loaDate, salespersonId, contractSum, vo],
  );
  return mof.id;
}

async function mofTotal(mofId: string) {
  const [row] = await asService<{ vo_amount: string; total: string }>(
    "select vo_amount, contract_sum + vo_amount as total from public.mofs where id = $1",
    [mofId],
  );
  return { voAmount: Number(row.vo_amount), total: Number(row.total) };
}

async function totalChanges(mofId: string) {
  return asService<{ old_total: string; new_total: string; reason: string }>(
    `select old_total, new_total, reason from public.mof_total_changes
     where mof_id = $1 order by created_at, id`,
    [mofId],
  );
}

async function addVo(mofId: string, amount: number, voNo = "VO1") {
  const [vo] = await asService<{ id: string }>(
    `insert into public.mof_variation_orders (mof_id, vo_no, confirmed_on, amount, description)
     values ($1, $2, '2026-11-02', $3, 'Extra carpet tile for pantry') returning id`,
    [mofId, voNo, amount],
  );
  return vo.id;
}

beforeAll(async () => {
  t = await createTestDatabase({ migrationsBefore: MIGRATION });
  const sales = t.profileIds.sales;
  for (const [vo, loaDate] of [
    [6500, "2026-02-14"],
    [-120.5, "2026-05-01"],
    [0, "2026-06-20"],
  ] as const) {
    backfill.push({ mofId: await addMof(sales, { vo, loaDate }), loaDate, vo });
  }
  await t.actAs(null);
  await applyMigrations(t.db, { from: MIGRATION });
});

afterAll(async () => {
  await t.close();
});

describe("backfill", () => {
  it("keeps every MOF total", async () => {
    for (const { mofId, vo } of backfill) {
      expect(await mofTotal(mofId)).toEqual({ voAmount: vo, total: 1000 + vo });
      expect(await totalChanges(mofId)).toEqual([]);
    }
  });

  it("makes one VO per saved VO amount, dated at the LOA date", async () => {
    for (const { mofId, loaDate, vo } of backfill) {
      const rows = await asService<{
        vo_no: string;
        confirmed_on: string;
        amount: string;
        needs_work: boolean;
      }>(
        `select vo_no, to_char(confirmed_on, 'YYYY-MM-DD') as confirmed_on, amount, needs_work
         from public.mof_variation_orders where mof_id = $1`,
        [mofId],
      );
      expect(rows).toEqual(
        vo === 0
          ? []
          : [
              {
                vo_no: "VO1",
                confirmed_on: loaDate,
                amount: vo.toFixed(2),
                needs_work: false,
              },
            ],
      );
    }
  });
});

describe("vo_amount follows the VOs", () => {
  it("adds, changes and removes with the VOs and records each total change", async () => {
    const mofId = await addMof(t.profileIds.sales);

    const first = await addVo(mofId, 300);
    await addVo(mofId, -50, "VO2");
    expect(await mofTotal(mofId)).toEqual({ voAmount: 250, total: 1250 });

    await asService(
      "update public.mof_variation_orders set amount = 400 where id = $1",
      [first],
    );
    expect(await mofTotal(mofId)).toEqual({ voAmount: 350, total: 1350 });

    await asService("delete from public.mof_variation_orders where id = $1", [
      first,
    ]);
    expect(await mofTotal(mofId)).toEqual({ voAmount: -50, total: 950 });

    expect(await totalChanges(mofId)).toEqual([
      {
        old_total: "1000.00",
        new_total: "1300.00",
        reason: "VO1: Extra carpet tile for pantry",
      },
      {
        old_total: "1300.00",
        new_total: "1250.00",
        reason: "VO2: Extra carpet tile for pantry",
      },
      {
        old_total: "1250.00",
        new_total: "1350.00",
        reason: "VO1: Extra carpet tile for pantry",
      },
      { old_total: "1350.00", new_total: "950.00", reason: "VO1 deleted" },
    ]);
  });

  it("records nothing when the amount stays the same", async () => {
    const mofId = await addMof(t.profileIds.sales);
    const voId = await addVo(mofId, 100);
    await asService(
      "update public.mof_variation_orders set description = 'Pantry tiles' where id = $1",
      [voId],
    );
    expect(await totalChanges(mofId)).toHaveLength(1);
  });

  it("refuses a VO that takes the order total to zero or below", async () => {
    const mofId = await addMof(t.profileIds.sales);
    await expect(addVo(mofId, -1000)).rejects.toThrow(/check/);
    expect(await mofTotal(mofId)).toEqual({ voAmount: 0, total: 1000 });
  });

  it("leaves vo_amount to the VOs in save_mof and update_mof_total", async () => {
    const mofId = await addMof(t.profileIds.sales);
    await addVo(mofId, 200);
    await t.actAs("md");
    await expect(
      t.db.query("select public.update_mof_total($1, 1000, 500, 'More')", [
        mofId,
      ]),
    ).rejects.toThrow(/VO list/);
    await expect(
      t.db.query(
        "select public.save_mof(null, $1, '[]'::jsonb, '', null::numeric)",
        [
          JSON.stringify({
            mof_no: "VO-NEW",
            loa_date: "2026-11-02",
            salesperson_id: t.profileIds.sales,
            company_name: "VO Co",
            project_name: "VO Project",
            scope: "s_and_l",
            contract_sum: 1000,
            vo_amount: 300,
            retention_pct: 0,
            commission_type: "own",
            stage: "pending_order",
            payment_checked: false,
            approvals_in_writing: false,
            artwork_signed_off: false,
            dos_pre_approved: false,
          }),
        ],
      ),
    ).rejects.toThrow(/VO list/);
  });

  it("turns an imported VO amount into a VO", async () => {
    const mofId = await addMof(t.profileIds.sales);
    await addVo(mofId, 200);
    await t.actAs("support");
    await t.db.query("select public.import_mofs($1)", [
      JSON.stringify([{ id: mofId, vo_amount: 450 }]),
    ]);
    expect(await mofTotal(mofId)).toEqual({ voAmount: 450, total: 1450 });
    const rows = await asService<{ vo_no: string; amount: string }>(
      "select vo_no, amount from public.mof_variation_orders where mof_id = $1 order by vo_no",
      [mofId],
    );
    expect(rows).toEqual([
      { vo_no: "VO1", amount: "200.00" },
      { vo_no: "VO2", amount: "250.00" },
    ]);
  });
});

describe("who reads and writes VOs", () => {
  let salesMof: string;
  let directorMof: string;

  beforeAll(async () => {
    salesMof = await addMof(t.profileIds.sales);
    directorMof = await addMof(t.profileIds.director);
    await addVo(salesMof, 100);
    await addVo(directorMof, 100);
  });

  async function sees(jobRole: JobRole, table: string, mofId: string) {
    await t.actAs(jobRole);
    const { rows } = await t.db.query<{ n: number }>(
      `select count(*) as n from public.${table} where ${table === "mofs" ? "id" : "mof_id"} = $1`,
      [mofId],
    );
    return Number(rows[0].n) > 0;
  }

  it.each(
    JobRole.options,
  )("%s reads VOs exactly where they read the MOF", async (role) => {
    for (const mofId of [salesMof, directorMof]) {
      expect(await sees(role, "mof_variation_orders", mofId)).toBe(
        await sees(role, "mofs", mofId),
      );
    }
  });

  it.each(
    JobRole.options,
  )("%s adds a VO only if they keep the register", async (role) => {
    const mofId = await addMof(t.profileIds.sales);
    await t.actAs(role);
    const add = t.db.query(
      `insert into public.mof_variation_orders (mof_id, vo_no, confirmed_on, amount, description)
       values ($1, 'VO1', '2026-11-02', 100, 'Extra')`,
      [mofId],
    );
    if (["md", "support", "accounts"].includes(role)) {
      await add;
      expect((await mofTotal(mofId)).voAmount).toBe(100);
    } else {
      await expect(add).rejects.toThrow(/row-level security/);
    }
  });
});

describe("VO cost", () => {
  it("adds into the MOF cost, seen only by those who see cost", async () => {
    const mofId = await addMof(t.profileIds.sales);
    const voId = await addVo(mofId, 500);
    await asService(
      "insert into public.mof_costs (mof_id, cost) values ($1, 600)",
      [mofId],
    );
    await asService(
      "insert into public.mof_variation_order_costs (variation_order_id, cost) values ($1, 350)",
      [voId],
    );

    for (const role of JobRole.options) {
      await t.actAs(role);
      const { rows: base } = await t.db.query(
        "select 1 from public.mof_costs where mof_id = $1",
        [mofId],
      );
      const { rows } = await t.db.query<{ cost: string }>(
        "select cost from public.mof_cost_totals where mof_id = $1",
        [mofId],
      );
      const { rows: voCosts } = await t.db.query(
        "select 1 from public.mof_variation_order_costs where variation_order_id = $1",
        [voId],
      );
      expect(rows).toEqual(base.length ? [{ cost: "950.00" }] : []);
      expect(voCosts.length).toBe(base.length);
    }
  });

  it("is left out while the MOF has no cost", async () => {
    const mofId = await addMof(t.profileIds.sales);
    const voId = await addVo(mofId, 500);
    await asService(
      "insert into public.mof_variation_order_costs (variation_order_id, cost) values ($1, 350)",
      [voId],
    );
    expect(
      await asService(
        "select cost from public.mof_cost_totals where mof_id = $1",
        [mofId],
      ),
    ).toEqual([]);
  });

  it("counts in the commission margin tier", async () => {
    const mofId = await addMof(t.profileIds.sales);
    const voId = await addVo(mofId, 1000);
    await asService(
      "insert into public.mof_costs (mof_id, cost) values ($1, 1000)",
      [mofId],
    );
    const tier = async () => {
      await t.actAs("sales");
      const { rows } = await t.db.query<{ margin_tier: string }>(
        "select margin_tier from public.commission_basis() where mof_id = $1",
        [mofId],
      );
      return rows[0].margin_tier;
    };
    // (2000 - 1000) / 2000 = 50%: above the 45% bonus line.
    expect(await tier()).toBe("high");
    await asService(
      "insert into public.mof_variation_order_costs (variation_order_id, cost) values ($1, 600)",
      [voId],
    );
    // (2000 - 1600) / 2000 = 20%: at the no-commission line, so low.
    expect(await tier()).toBe("low");
  });
});

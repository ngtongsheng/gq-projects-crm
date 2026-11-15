import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type CommissionSettings,
  DEFAULT_COMMISSION_SETTINGS,
  storedRows,
} from "@/lib/domain/commission-settings";
import { addMof } from "./fixtures";
import {
  applyMigrations,
  createTestDatabase,
  type TestDatabase,
} from "./harness";

// Loop 14 D3 and D4: the saved second late cut moves from 120 to 180 days only where it was
// still 120, and a salesperson's late-cut appeal is sent by them and decided by the MD or HR &
// Accounts. What an approved appeal does to payable-now is in commission-parity.test.ts.

const MIGRATION = "20261115180000_commission_appeals.sql";
const REASON = "Client is a GLC; finance takes 4 months.";

/** The saved rules after the migration, given what was saved before it. */
async function migratedRules(rules: CommissionSettings | null) {
  const db = await createTestDatabase({ migrationsBefore: MIGRATION });
  try {
    if (rules) {
      const [row] = storedRows(rules);
      await db.db.query(
        "insert into public.app_settings (key, value) values ($1, $2)",
        [row.key, row.value],
      );
    }
    await applyMigrations(db.db, { from: MIGRATION });
    const { rows } = await db.db.query<{ value: CommissionSettings }>(
      "select value from public.app_settings where key = 'commission'",
    );
    return rows[0]?.value ?? null;
  } finally {
    await db.close();
  }
}

const withSecondCut = (
  afterDays: number,
  firstAfterDays = 90,
): CommissionSettings => ({
  ...DEFAULT_COMMISSION_SETTINGS,
  firstLateCut: { afterDays: firstAfterDays, cutPct: 25 },
  secondLateCut: { afterDays, cutPct: 50 },
});

describe("second late cut moves to 180 days", () => {
  it("changes saved rules that still say 120, and nothing else in them", async () => {
    const { claimThresholdPct: _, ...before } = withSecondCut(120);
    expect(await migratedRules(withSecondCut(120))).toEqual({
      ...before,
      secondLateCut: { afterDays: 180, cutPct: 50 },
    });
  });

  it("keeps a value the MD chose herself", async () => {
    expect(
      (await migratedRules(withSecondCut(150)))?.secondLateCut.afterDays,
    ).toBe(150);
  });

  it("keeps 120 where the first cut starts at 180 or later", async () => {
    expect(
      (await migratedRules(withSecondCut(120, 200)))?.secondLateCut.afterDays,
    ).toBe(120);
  });

  it("adds nothing when no rules were saved", async () => {
    expect(await migratedRules(null)).toBeNull();
  });
});

describe("commission appeals", () => {
  let t: TestDatabase;

  beforeAll(async () => {
    t = await createTestDatabase();
  });

  afterAll(async () => {
    await t.close();
  });

  async function send(mofId: string, reason = REASON) {
    await t.actAs("sales");
    const { rows } = await t.db.query<{ id: string; profile_id: string }>(
      `insert into public.commission_appeals (mof_id, reason) values ($1, $2)
       returning id, profile_id`,
      [mofId, reason],
    );
    return rows[0];
  }

  async function decide(
    appealId: string,
    status: string,
    as: "md" | "accounts" | "sales" | "director" = "md",
  ) {
    await t.actAs(as);
    const { rows } = await t.db.query<{
      status: string;
      decided_by: string | null;
      decided_at: string | null;
    }>(
      `update public.commission_appeals set status = $2, reply = 'Special approval this time only.'
       where id = $1 returning status, decided_by, decided_at`,
      [appealId, status],
    );
    return rows;
  }

  it("is sent as the signed-in salesperson, pending", async () => {
    const mofId = await addMof(t);
    const appeal = await send(mofId);
    expect(appeal.profile_id).toBe(t.profileIds.sales);

    await t.actAs("sales");
    await expect(
      t.db.query(
        "insert into public.commission_appeals (mof_id, profile_id, reason) values ($1, $2, $3)",
        [mofId, t.profileIds.bd, REASON],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.db.query(
        "insert into public.commission_appeals (mof_id, reason, status) values ($1, $2, 'approved')",
        [mofId, REASON],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("needs a reason of at least 10 characters", async () => {
    const mofId = await addMof(t);
    await expect(send(mofId, "too short")).rejects.toThrow(/check/);
    await expect(send(mofId, "0123456789")).resolves.toBeDefined();
  });

  it("allows one standing appeal per person per order; another after a rejection", async () => {
    const mofId = await addMof(t);
    const first = await send(mofId);
    await expect(send(mofId)).rejects.toThrow(/duplicate key/);

    await decide(first.id, "rejected");
    const second = await send(mofId);
    await decide(second.id, "approved");
    await expect(send(mofId)).rejects.toThrow(/duplicate key/);
  });

  it("is decided once by the MD or HR & Accounts, who and when stamped", async () => {
    for (const as of ["md", "accounts"] as const) {
      const appeal = await send(await addMof(t));
      const [decided] = await decide(appeal.id, "approved", as);
      expect(decided.status).toBe("approved");
      expect(decided.decided_by).toBe(t.profileIds[as]);
      expect(decided.decided_at).not.toBeNull();

      expect(await decide(appeal.id, "rejected", as)).toEqual([]);
    }
  });

  it("cannot be decided by anyone else, or left pending", async () => {
    const appeal = await send(await addMof(t));
    expect(await decide(appeal.id, "approved", "sales")).toEqual([]);
    expect(await decide(appeal.id, "approved", "director")).toEqual([]);
    await expect(decide(appeal.id, "pending")).rejects.toThrow(
      /row-level security/,
    );
  });

  it("is read by the salesperson and the MD, not by others outside the team", async () => {
    const appeal = await send(await addMof(t));
    const visibleTo = async (as: "sales" | "md" | "support") => {
      await t.actAs(as);
      const { rows } = await t.db.query(
        "select id from public.commission_appeals where id = $1",
        [appeal.id],
      );
      return rows.length;
    };
    expect(await visibleTo("sales")).toBe(1);
    expect(await visibleTo("md")).toBe(1);
    expect(await visibleTo("support")).toBe(0);
  });
});

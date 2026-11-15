import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMof } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 14 task 03: a new VO that needs work on a job the site marked completed reopens it and
// alerts the site supervisors told, each until they note it.

let t: TestDatabase;
let n = 0;
let secondSupervisor: string;

async function asService<T>(sql: string, params: unknown[] = []) {
  await t.actAs(null);
  const { rows } = await t.db.query<T>(sql, params);
  return rows;
}

async function actAsPerson(id: string) {
  await t.db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    id,
  ]);
  await t.db.exec("set role authenticated");
}

async function completedMof(stage = "completed_payment_pending") {
  const mofId = await addMof(t);
  await asService(
    "update public.mofs set site_stage = 'completed', stage = $2 where id = $1",
    [mofId, stage],
  );
  return mofId;
}

/** Saves a VO as Purchasing; returns whether the job was reopened. */
async function saveVo(
  mofId: string,
  {
    needsWork = true,
    notify = [] as string[],
    voId = null as string | null,
    amount = 500,
  } = {},
) {
  n += 1;
  await t.actAs("support");
  const { rows } = await t.db.query<{ reopened: boolean }>(
    "select public.save_variation_order($1, $2, $3, null, $4) as reopened",
    [
      voId,
      mofId,
      {
        vo_no: `VO${n}`,
        confirmed_on: "2026-11-10",
        amount,
        description: "Extra carpet tile for pantry",
        qty: "120 m2",
        needs_work: needsWork,
      },
      notify,
    ],
  );
  return rows[0].reopened;
}

async function job(mofId: string) {
  const [row] = await asService<{ site_stage: string; stage: string }>(
    "select site_stage, stage from public.mofs where id = $1",
    [mofId],
  );
  return row;
}

async function alerts(mofId: string) {
  return asService<{ id: string; supervisor_id: string; noted: boolean }>(
    `select a.id, a.supervisor_id, a.noted_at is not null as noted
     from public.additional_work_alerts a
     join public.mof_variation_orders v on v.id = a.variation_order_id
     where v.mof_id = $1 order by a.supervisor_id`,
    [mofId],
  );
}

beforeAll(async () => {
  t = await createTestDatabase();
  const [user] = await asService<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ('site2@test.local', '{}') returning id",
  );
  secondSupervisor = user.id;
  await asService(
    "update public.profiles set job_role = 'site' where id = $1",
    [secondSupervisor],
  );
});

afterAll(async () => {
  await t.close();
});

describe("reopening a completed job", () => {
  it("reopens when the new VO needs work and the site marked the job completed", async () => {
    const mofId = await completedMof();

    expect(await saveVo(mofId)).toBe(true);
    expect(await job(mofId)).toEqual({
      site_stage: "installation",
      stage: "delivered_installing",
    });
  });

  it("moves a closed order back to delivered – installing", async () => {
    const mofId = await completedMof("closed");

    await saveVo(mofId);

    expect((await job(mofId)).stage).toBe("delivered_installing");
  });

  it("leaves an order on hold where it is", async () => {
    const mofId = await completedMof("on_hold");

    await saveVo(mofId);

    expect(await job(mofId)).toEqual({
      site_stage: "installation",
      stage: "on_hold",
    });
  });

  it("does not reopen for a VO without work", async () => {
    const mofId = await completedMof();

    expect(await saveVo(mofId, { needsWork: false })).toBe(false);
    expect(await job(mofId)).toEqual({
      site_stage: "completed",
      stage: "completed_payment_pending",
    });
  });

  it("does not touch a job the site has not completed", async () => {
    const mofId = await addMof(t);
    await asService(
      "update public.mofs set site_stage = 'delivered', stage = 'delivered_installing' where id = $1",
      [mofId],
    );

    expect(
      await saveVo(mofId, { notify: [t.profileIds.site, secondSupervisor] }),
    ).toBe(false);
    expect((await job(mofId)).site_stage).toBe("delivered");
    expect(await alerts(mofId)).toEqual([]);
  });

  it("does not reopen when an existing VO is changed", async () => {
    const mofId = await completedMof();
    await saveVo(mofId, { needsWork: false });
    const [vo] = await asService<{ id: string }>(
      "select id from public.mof_variation_orders where mof_id = $1",
      [mofId],
    );

    expect(await saveVo(mofId, { voId: vo.id, needsWork: true })).toBe(false);
    expect((await job(mofId)).site_stage).toBe("completed");
  });

  it("keeps the MOF total in step with a VO saved here", async () => {
    const mofId = await completedMof();

    await saveVo(mofId, { amount: 750, needsWork: false });

    const [row] = await asService<{ vo_amount: string }>(
      "select vo_amount from public.mofs where id = $1",
      [mofId],
    );
    expect(Number(row.vo_amount)).toBe(750);
  });

  it("refuses someone outside the register editors", async () => {
    const mofId = await completedMof();
    await t.actAs("site");

    await expect(
      t.db.query(
        `select public.save_variation_order(null, $1,
           '{"vo_no":"VO9","confirmed_on":"2026-11-10","amount":100,"description":"Extra","needs_work":true}',
           null, '{}')`,
        [mofId],
      ),
    ).rejects.toThrow(/row-level security/);
    expect((await job(mofId)).site_stage).toBe("completed");
  });
});

describe("additional work alerts", () => {
  it("alerts each site supervisor told, and nobody else", async () => {
    const mofId = await completedMof();

    await saveVo(mofId, {
      notify: [t.profileIds.site, secondSupervisor, t.profileIds.sales],
    });

    expect(
      (await alerts(mofId)).map((alert) => alert.supervisor_id).sort(),
    ).toEqual([t.profileIds.site, secondSupervisor].sort());
  });

  it("is noted per supervisor: one noting leaves the other's open", async () => {
    const mofId = await completedMof();
    await saveVo(mofId, { notify: [t.profileIds.site, secondSupervisor] });
    const mine = (await alerts(mofId)).find(
      (alert) => alert.supervisor_id === t.profileIds.site,
    );

    await t.actAs("site");
    await t.db.query(
      "update public.additional_work_alerts set noted_at = now() where id = $1",
      [mine?.id],
    );

    const after = await alerts(mofId);
    expect(
      after.find((a) => a.supervisor_id === t.profileIds.site)?.noted,
    ).toBe(true);
    expect(after.find((a) => a.supervisor_id === secondSupervisor)?.noted).toBe(
      false,
    );
  });

  it("does not let one supervisor note another's alert", async () => {
    const mofId = await completedMof();
    await saveVo(mofId, { notify: [secondSupervisor] });
    const [theirs] = await alerts(mofId);

    await t.actAs("site");
    const { affectedRows } = await t.db.query(
      "update public.additional_work_alerts set noted_at = now() where id = $1",
      [theirs.id],
    );

    expect(affectedRows).toBe(0);
    expect((await alerts(mofId))[0].noted).toBe(false);
  });

  it("does not let a supervisor take back a note", async () => {
    const mofId = await completedMof();
    await saveVo(mofId, { notify: [secondSupervisor] });
    const [theirs] = await alerts(mofId);
    await actAsPerson(secondSupervisor);
    await t.db.query(
      "update public.additional_work_alerts set noted_at = now() where id = $1",
      [theirs.id],
    );

    await expect(
      t.db.query(
        "update public.additional_work_alerts set noted_at = null where id = $1",
        [theirs.id],
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

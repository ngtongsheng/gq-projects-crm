import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 15 task 05: leave requests, their approval chain (D4) and entitlements (D7). The
// salesperson reports to the Marketing Director (bd), their team lead. Dates are in January
// 2027: Monday 4th to Sunday 10th, with Wednesday 6th made a public holiday.

let t: TestDatabase;

async function query<T>(who: JobRole, sql: string, params: unknown[] = []) {
  await t.actAs(who);
  const { rows } = await t.db.query<T>(sql, params);
  return rows;
}

async function asService(sql: string, params: unknown[] = []) {
  await t.actAs(null);
  await t.db.query(sql, params);
}

async function apply(
  who: JobRole,
  from: string,
  to = from,
  type = "annual",
  halfDay: string | null = null,
) {
  const [row] = await query<{ id: string; days: string }>(
    who,
    `insert into public.leave_requests (leave_type, starts_on, ends_on, half_day, reason)
     values ($1, $2, $3, $4, 'Family trip') returning id, days`,
    [type, from, to, halfDay],
  );
  return row;
}

const decide = (who: JobRole, id: string, approve = true) =>
  query(who, "select public.decide_leave($1, $2, 'ok')", [id, approve]);

async function request(id: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ status: string; decided_by: string }>(
    "select status, decided_by from public.leave_requests where id = $1",
    [id],
  );
  return rows[0];
}

async function steps(id: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<{
    approver_id: string | null;
    approver_role: string | null;
    decision: string | null;
  }>(
    `select approver_id, approver_role, decision from public.leave_approval_steps
     where request_id = $1 order by position`,
    [id],
  );
  return rows;
}

async function cleanUp() {
  await asService("delete from public.leave_requests");
}

beforeAll(async () => {
  t = await createTestDatabase();
  await asService("update public.profiles set reports_to = $1 where id = $2", [
    t.profileIds.bd,
    t.profileIds.sales,
  ]);
  await asService(
    "insert into public.public_holidays (day, name) values ('2027-01-06', 'Test holiday')",
  );
});

afterAll(async () => {
  await t.close();
});

describe("days", () => {
  it("counts Monday to Friday, leaving out the public holiday", async () => {
    expect((await apply("sales", "2027-01-04", "2027-01-10")).days).toBe("4.0");
    await cleanUp();
  });

  it("counts Saturday for a Site Supervisor", async () => {
    expect((await apply("site", "2027-01-04", "2027-01-10")).days).toBe("5.0");
    await cleanUp();
  });

  it("counts a half day as 0.5", async () => {
    expect(
      (await apply("sales", "2027-01-04", "2027-01-04", "annual", "am")).days,
    ).toBe("0.5");
    await cleanUp();
  });

  it("refuses dates with no working days", async () => {
    await expect(apply("sales", "2027-01-09", "2027-01-10")).rejects.toThrow(
      "no working days",
    );
  });

  it("refuses leave over leave already applied for", async () => {
    await apply("sales", "2027-01-04", "2027-01-05");
    await expect(apply("sales", "2027-01-05", "2027-01-07")).rejects.toThrow(
      "already leave",
    );
    await cleanUp();
  });

  it("nobody applies in someone else's name", async () => {
    await expect(
      query(
        "md",
        `insert into public.leave_requests (person_id, leave_type, starts_on, ends_on)
         values ($1, 'annual', '2027-01-04', '2027-01-04')`,
        [t.profileIds.designer],
      ),
    ).rejects.toThrow();
  });
});

describe("approval chain", () => {
  it.each<[JobRole, (string | null)[]]>([
    ["sales", ["bd", "md"]],
    ["bd", ["director", "md"]],
    ["site", ["director", "md"]],
    ["md", ["director"]],
    ["designer", ["md"]],
    ["accounts", ["md"]],
    ["director", ["md"]],
  ])("%s goes to %j", async (who, approvers) => {
    const { id } = await apply(who, "2027-01-04");
    const chain = (await steps(id)).map((step) =>
      step.approver_id === t.profileIds.bd ? "bd" : step.approver_role,
    );
    expect(chain).toEqual(approvers);
    await cleanUp();
  });

  it("a salesperson with no team lead goes to the md", async () => {
    await asService(
      "update public.profiles set reports_to = null where id = $1",
      [t.profileIds.sales],
    );
    const { id } = await apply("sales", "2027-01-04");
    expect((await steps(id)).map((step) => step.approver_role)).toEqual(["md"]);
    await asService(
      "update public.profiles set reports_to = $1 where id = $2",
      [t.profileIds.bd, t.profileIds.sales],
    );
    await cleanUp();
  });

  it("team lead then md", async () => {
    const { id } = await apply("sales", "2027-01-04");
    await expect(decide("director", id)).rejects.toThrow("someone else");
    await decide("bd", id);
    expect((await request(id)).status).toBe("pending");
    await expect(decide("bd", id)).rejects.toThrow("someone else");
    await decide("md", id);
    expect(await request(id)).toEqual({
      status: "approved",
      decided_by: t.profileIds.md,
    });
    await cleanUp();
  });

  it("the md decides every step at once", async () => {
    const { id } = await apply("site", "2027-01-04");
    await decide("md", id);
    expect((await steps(id)).map((step) => step.decision)).toEqual([
      "approved",
      "approved",
    ]);
    expect((await request(id)).status).toBe("approved");
    await cleanUp();
  });

  it("a rejection stops the chain", async () => {
    const { id } = await apply("bd", "2027-01-04");
    await decide("director", id, false);
    expect((await request(id)).status).toBe("rejected");
    expect((await steps(id)).map((step) => step.decision)).toEqual([
      "rejected",
      null,
    ]);
    await expect(decide("md", id)).rejects.toThrow("not waiting");
    await cleanUp();
  });

  it.each<JobRole>(["md", "sales", "bd", "accounts"])(
    "%s cannot approve their own leave",
    async (who) => {
      const { id } = await apply(who, "2027-01-04", "2027-01-04", "mc");
      await asService(
        `update public.leave_requests set slip_path = 'leave/' || id || '/1a2b3c4d-mc.jpg',
         slip_file_name = 'mc.jpg', slip_content_type = 'image/jpeg', slip_uploaded_at = now()
       where id = $1`,
        [id],
      );
      await expect(decide(who, id)).rejects.toThrow("own leave");
      await cleanUp();
    },
  );

  it("the director approves the md's leave", async () => {
    const { id } = await apply("md", "2027-01-04");
    await decide("director", id);
    expect((await request(id)).status).toBe("approved");
    await cleanUp();
  });

  it("nobody writes a status or a step directly", async () => {
    const { id } = await apply("designer", "2027-01-04");
    await expect(
      query(
        "md",
        "update public.leave_requests set status = 'approved' where id = $1",
        [id],
      ),
    ).rejects.toThrow();
    await expect(
      query(
        "md",
        "update public.leave_approval_steps set decision = 'approved' where request_id = $1",
        [id],
      ),
    ).rejects.toThrow();
    await cleanUp();
  });
});

describe("MC slips", () => {
  const uploadSlip = (who: JobRole, id: string) =>
    query(
      who,
      `update public.leave_requests set slip_path = 'leave/' || id || '/1a2b3c4d-mc.jpg',
         slip_file_name = 'mc.jpg', slip_content_type = 'image/jpeg'
       where id = $1`,
      [id],
    );

  it("HR & Accounts checks an MC once the slip is in", async () => {
    const { id } = await apply("sales", "2027-01-04", "2027-01-04", "mc");
    await expect(decide("accounts", id)).rejects.toThrow("Upload the slip");
    await uploadSlip("sales", id);
    await decide("accounts", id);
    expect(await request(id)).toEqual({
      status: "approved",
      decided_by: t.profileIds.accounts,
    });
    await cleanUp();
  });

  it("HR & Accounts does not approve annual leave", async () => {
    const { id } = await apply("designer", "2027-01-04");
    await expect(decide("accounts", id)).rejects.toThrow("someone else");
    await cleanUp();
  });

  it("only HR & Accounts or the md ticks the original slip", async () => {
    const { id } = await apply("designer", "2027-01-04", "2027-01-04", "mc");
    const tick = (who: JobRole) =>
      query(
        who,
        "update public.leave_requests set original_given_to_hr = true where id = $1",
        [id],
      );
    await expect(tick("designer")).rejects.toThrow("HR & Accounts");
    await tick("accounts");
    await cleanUp();
  });

  it("annual leave has no slip", async () => {
    const { id } = await apply("designer", "2027-01-04");
    await expect(uploadSlip("designer", id)).rejects.toThrow();
    await cleanUp();
  });
});

describe("cancelling", () => {
  it("the person cancels their own pending leave; nobody else does", async () => {
    const { id } = await apply("sales", "2027-01-04");
    const cancel = (who: JobRole) =>
      query(
        who,
        "update public.leave_requests set status = 'cancelled' where id = $1",
        [id],
      );
    await expect(cancel("md")).rejects.toThrow();
    await cancel("sales");
    expect(await request(id)).toEqual({
      status: "cancelled",
      decided_by: t.profileIds.sales,
    });
    await expect(decide("md", id)).rejects.toThrow("not waiting");
    await cleanUp();
  });
});

describe("who sees leave", () => {
  const visible = async (who: JobRole) =>
    (
      await query<{ id: string }>(who, "select id from public.leave_requests")
    ).map((row) => row.id);

  it.each<JobRole>(["sales", "bd", "md", "director", "accounts"])(
    "%s sees the salesperson's leave and its steps",
    async (who) => {
      const { id } = await apply("sales", "2027-01-04");
      expect(await visible(who)).toEqual([id]);
      expect(
        await query(
          who,
          "select 1 from public.leave_approval_steps where request_id = $1",
          [id],
        ),
      ).toHaveLength(2);
      await cleanUp();
    },
  );

  it.each<JobRole>(["designer", "site", "ssup", "support", "marketing"])(
    "%s does not",
    async (who) => {
      await apply("sales", "2027-01-04");
      expect(await visible(who)).toEqual([]);
      expect(
        await query(who, "select 1 from public.leave_approval_steps"),
      ).toEqual([]);
      await cleanUp();
    },
  );

  it("a team lead does not see people outside their team", async () => {
    await apply("designer", "2027-01-04");
    expect(await visible("bd")).toEqual([]);
    await cleanUp();
  });

  it("people who left see nothing, even their own", async () => {
    await apply("designer", "2027-01-04");
    await asService("update public.profiles set active = false where id = $1", [
      t.profileIds.designer,
    ]);
    expect(await visible("designer")).toEqual([]);
    await asService("update public.profiles set active = true where id = $1", [
      t.profileIds.designer,
    ]);
    await cleanUp();
  });
});

describe("entitlements", () => {
  const setFor = (who: JobRole, person: JobRole, year = 2027) =>
    query(
      who,
      `insert into public.leave_entitlements (profile_id, year, annual_days, carried_days, mc_days)
       values ($1, $2, 14, 3.5, 14)`,
      [t.profileIds[person], year],
    );
  const readable = async (who: JobRole) =>
    (
      await query<{ profile_id: string }>(
        who,
        "select profile_id from public.leave_entitlements",
      )
    ).map((row) => row.profile_id);

  it.each<JobRole>(["director", "sales", "bd"])(
    "%s cannot set one",
    async (who) => {
      await expect(setFor(who, "designer")).rejects.toThrow();
    },
  );

  it("HR & Accounts sets a carry-forward; the md changes it back", async () => {
    await setFor("accounts", "sales");
    await query(
      "md",
      "delete from public.leave_entitlements where profile_id = $1",
      [t.profileIds.sales],
    );
    expect(await readable("accounts")).toEqual([]);
  });

  it("no entitlements before 2027, and only in half days", async () => {
    await expect(setFor("accounts", "sales", 2026)).rejects.toThrow();
    await expect(
      query(
        "accounts",
        `insert into public.leave_entitlements (profile_id, year, annual_days, mc_days)
         values ($1, 2027, 10.3, 14)`,
        [t.profileIds.sales],
      ),
    ).rejects.toThrow();
  });

  it("the person, their team lead and the managers read it; others do not", async () => {
    await setFor("accounts", "sales");
    for (const who of ["sales", "bd", "md", "director", "accounts"] as const) {
      expect(await readable(who)).toEqual([t.profileIds.sales]);
    }
    for (const who of ["designer", "site", "marketing"] as const) {
      expect(await readable(who)).toEqual([]);
    }
  });
});

describe("leave policy", () => {
  it("defaults to 14 AL and 14 MC, prorated", async () => {
    const rows = await query<{ key: string; value: unknown }>(
      "sales",
      "select key, value from public.app_settings where key like 'leave_%' order by key",
    );
    expect(rows).toEqual([
      { key: "leave_annual_days", value: 14 },
      { key: "leave_mc_days", value: 14 },
      { key: "leave_prorate", value: true },
    ]);
  });

  it("refuses a policy that is not half days", async () => {
    await expect(
      query(
        "md",
        "update public.app_settings set value = '10.3' where key = 'leave_annual_days'",
      ),
    ).rejects.toThrow();
  });
});

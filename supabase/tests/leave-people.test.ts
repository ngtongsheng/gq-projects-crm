import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 15 task 08: leave_people() gives the Leave page the join date and job role of the people
// whose leave the caller already reads.

let t: TestDatabase;

async function people(who: JobRole) {
  await t.actAs(who);
  const { rows } = await t.db.query<{
    id: string;
    job_role: string;
    joined_on: string | null;
  }>("select id, job_role, joined_on::text from public.leave_people()");
  return rows;
}

beforeAll(async () => {
  t = await createTestDatabase();
  await t.db.query(
    "update public.profiles set reports_to = $1, joined_on = '2027-03-10' where id = $2",
    [t.profileIds.bd, t.profileIds.sales],
  );
});

afterAll(async () => {
  await t.close();
});

describe("leave_people", () => {
  it.each<JobRole>(["md", "director", "accounts"])(
    "%s gets everyone still here, with job role and join date",
    async (who) => {
      const rows = await people(who);
      expect(rows).toHaveLength(10);
      expect(rows.find((row) => row.id === t.profileIds.sales)).toMatchObject({
        job_role: "sales",
        joined_on: "2027-03-10",
      });
    },
  );

  it("a Marketing Director gets themself and the salespeople who report to them", async () => {
    const rows = await people("bd");
    expect(rows.map((row) => row.id).sort()).toEqual(
      [t.profileIds.bd, t.profileIds.sales].sort(),
    );
  });

  it("a salesperson gets only themself", async () => {
    const rows = await people("sales");
    expect(rows.map((row) => row.id)).toEqual([t.profileIds.sales]);
  });

  it("someone who has left gets nobody, and is not listed", async () => {
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set active = false where id = $1",
      [t.profileIds.site],
    );
    const asLeft = await people("site");
    const asMd = await people("md");
    await t.actAs(null);
    await t.db.query("update public.profiles set active = true where id = $1", [
      t.profileIds.site,
    ]);
    expect(asLeft).toEqual([]);
    expect(asMd.map((row) => row.id)).not.toContain(t.profileIds.site);
  });
});

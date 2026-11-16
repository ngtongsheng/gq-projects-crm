import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 21 task 07: HR & Accounts (a staff role) cannot read other profiles, so an embedded
// profiles(...) select on the claims came back empty and the claims list failed. claim_people()
// gives the MD and HR & Accounts the name and job role of everyone whose claim they settle.

let t: TestDatabase;

async function people(who: JobRole) {
  await t.actAs(who);
  const { rows } = await t.db.query<{ id: string; job_role: string }>(
    "select id, job_role from public.claim_people()",
  );
  return rows;
}

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

describe("claim_people", () => {
  it.each<JobRole>([
    "md",
    "accounts",
  ])("%s gets everyone, with job role", async (who) => {
    const rows = await people(who);
    expect(rows).toHaveLength(10);
    expect(rows.find((row) => row.id === t.profileIds.sales)?.job_role).toBe(
      "sales",
    );
  });

  it.each<JobRole>([
    "director",
    "sales",
    "site",
  ])("%s gets nobody", async (who) => {
    expect(await people(who)).toEqual([]);
  });
});

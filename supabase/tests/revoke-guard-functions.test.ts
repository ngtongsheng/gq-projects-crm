import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 audit: trigger functions are not part of the API, so nobody signed in may execute
// them. Checked for every trigger function rather than a list, so a new one cannot be missed.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

describe("trigger functions", () => {
  it("cannot be executed by the API roles", async () => {
    const { rows } = await t.db.query<{ name: string; role: string }>(`
      select p.proname as name, r.rolname as role
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join pg_roles r
      where n.nspname = 'public'
        and p.prorettype = 'trigger'::regtype
        and r.rolname in ('anon', 'authenticated')
        and has_function_privilege(r.rolname, p.oid, 'execute')
    `);
    expect(rows).toEqual([]);
  });

  it("includes the four guards that were missed before", async () => {
    const { rows } = await t.db.query<{ name: string }>(`
      select p.proname as name
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.prorettype = 'trigger'::regtype
        and p.proname in ('guard_installer_claim', 'guard_job', 'guard_delivery_order', 'guard_site_booking')
    `);
    expect(rows).toHaveLength(4);
  });
});

describe("functions the app calls", () => {
  it("stay executable by signed-in users", async () => {
    const { rows } = await t.db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated', 'public.is_admin()', 'execute') as allowed",
    );
    expect(rows[0].allowed).toBe(true);
  });
});

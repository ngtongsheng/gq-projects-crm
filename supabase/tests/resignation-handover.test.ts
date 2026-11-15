import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 16 D5: an admin hands a leaver's customers and open projects to one person in one go.
// Closed projects stay put, and so does commission: MOF salespeople and the projects' commission
// type and passed_by are never touched.

let t: TestDatabase;
let n = 0;

async function asService<T>(sql: string, params: unknown[] = []) {
  await t.actAs(null);
  const { rows } = await t.db.query<T>(sql, params);
  return rows;
}

async function addCustomer(owners: string[]): Promise<string> {
  n += 1;
  const [company] = await asService<{ id: string }>(
    "insert into public.companies (name) values ($1) returning id",
    [`Company ${n}`],
  );
  const [contact] = await asService<{ id: string }>(
    "insert into public.contacts (company_id, name, mobile) values ($1, $2, $3) returning id",
    [company.id, `Customer ${n}`, `60123${String(n).padStart(6, "0")}`],
  );
  for (const owner of owners) {
    await asService(
      "insert into public.contact_owners (contact_id, profile_id) values ($1, $2)",
      [contact.id, owner],
    );
  }
  return contact.id;
}

async function addProject(
  contactId: string,
  stage: string,
  picId: string,
  supportId: string | null = null,
): Promise<string> {
  const [project] = await asService<{ id: string }>(
    `insert into public.projects (contact_id, name, lead_source, stage, pic_id, support_id,
       commission_type, passed_by)
     values ($1, $2, 'referral', $3, $4, $5, 'pass_down', $6) returning id`,
    [contactId, `Project ${++n}`, stage, picId, supportId, t.profileIds.ssup],
  );
  return project.id;
}

async function project(id: string) {
  const [row] = await asService<{
    pic_id: string;
    support_id: string | null;
    commission_type: string;
    passed_by: string | null;
  }>(
    "select pic_id, support_id, commission_type, passed_by from public.projects where id = $1",
    [id],
  );
  return row;
}

async function ownersOf(contactId: string): Promise<string[]> {
  const rows = await asService<{ profile_id: string }>(
    "select profile_id from public.contact_owners where contact_id = $1 order by profile_id",
    [contactId],
  );
  return rows.map((row) => row.profile_id);
}

async function markLeft(jobRole: JobRole) {
  await asService(
    "update public.profiles set active = false, left_on = '2026-11-10' where id = $1",
    [t.profileIds[jobRole]],
  );
}

async function handOver(as: JobRole, leaver: string, recipient: string) {
  await t.actAs(as);
  const { rows } = await t.db.query<{ moved: number }>(
    "select public.hand_over_work($1, $2) as moved",
    [leaver, recipient],
  );
  return rows[0].moved;
}

beforeEach(async () => {
  t = await createTestDatabase();
});

afterEach(async () => {
  await t.close();
});

describe("hand_over_work", () => {
  it("moves customers and open projects, leaves closed projects and commission alone", async () => {
    const { sales, bd, director } = t.profileIds;
    const ownCustomer = await addCustomer([sales]);
    const sharedWithRecipient = await addCustomer([sales, bd]);
    const sharedWithOther = await addCustomer([sales, director]);
    const open = await addProject(ownCustomer, "negotiation", sales);
    const onHold = await addProject(ownCustomer, "on_hold", sales, director);
    const asSupport = await addProject(ownCustomer, "lead", director, sales);
    const recipientSupports = await addProject(ownCustomer, "lead", sales, bd);
    const awarded = await addProject(ownCustomer, "awarded", sales);
    const lost = await addProject(ownCustomer, "lost", sales);
    const [mof] = await asService<{ id: string }>(
      `insert into public.mofs (mof_no, loa_date, salesperson_id, second_salesperson_id,
         project_id, company_name, project_name, contract_sum, commission_type)
       values ('HO-1', '2026-10-01', $1, $2, $3, 'Co', 'Awarded job', 1000, 'pass_down')
       returning id`,
      [sales, bd, awarded],
    );
    await markLeft("sales");

    const moved = await handOver("md", sales, bd);

    expect(moved).toBe(7);
    expect(await ownersOf(ownCustomer)).toEqual([bd]);
    expect(await ownersOf(sharedWithRecipient)).toEqual([bd]);
    expect(await ownersOf(sharedWithOther)).toEqual([bd, director].sort());
    expect(await project(open)).toEqual({
      pic_id: bd,
      support_id: null,
      commission_type: "pass_down",
      passed_by: t.profileIds.ssup,
    });
    expect(await project(onHold)).toMatchObject({
      pic_id: bd,
      support_id: director,
    });
    expect(await project(asSupport)).toMatchObject({
      pic_id: director,
      support_id: bd,
    });
    expect(await project(recipientSupports)).toMatchObject({
      pic_id: bd,
      support_id: null,
    });
    expect((await project(awarded)).pic_id).toBe(sales);
    expect((await project(lost)).pic_id).toBe(sales);
    const [order] = await asService<{
      salesperson_id: string;
      second_salesperson_id: string;
      commission_type: string;
    }>(
      "select salesperson_id, second_salesperson_id, commission_type from public.mofs where id = $1",
      [mof.id],
    );
    expect(order).toEqual({
      salesperson_id: sales,
      second_salesperson_id: bd,
      commission_type: "pass_down",
    });
  });

  it("writes the handover list, readable by admins only", async () => {
    const { sales, bd, md } = t.profileIds;
    const customer = await addCustomer([sales]);
    const open = await addProject(customer, "lead", sales);
    await markLeft("sales");

    await handOver("md", sales, bd);

    await t.actAs("md");
    const { rows } = await t.db.query<{
      from_id: string;
      to_id: string;
      contact_id: string | null;
      project_id: string | null;
      handed_over_by: string;
    }>(
      "select from_id, to_id, contact_id, project_id, handed_over_by from public.handover_items order by project_id nulls first",
    );
    expect(rows).toEqual([
      {
        from_id: sales,
        to_id: bd,
        contact_id: customer,
        project_id: null,
        handed_over_by: md,
      },
      {
        from_id: sales,
        to_id: bd,
        contact_id: null,
        project_id: open,
        handed_over_by: md,
      },
    ]);

    await t.actAs("bd");
    const { rows: staffRows } = await t.db.query(
      "select 1 from public.handover_items",
    );
    expect(staffRows).toEqual([]);
  });

  it("works for an admin who is not the MD", async () => {
    const { sales, bd, accounts } = t.profileIds;
    await asService("update public.profiles set role = 'admin' where id = $1", [
      accounts,
    ]);
    const customer = await addCustomer([sales]);
    const open = await addProject(customer, "follow_up", sales);
    await markLeft("sales");

    await handOver("accounts", sales, bd);

    expect((await project(open)).pic_id).toBe(bd);
    expect(await ownersOf(customer)).toEqual([bd]);
  });

  it("refuses anyone who is not an admin, and changes nothing", async () => {
    const { sales, bd } = t.profileIds;
    const customer = await addCustomer([sales]);
    await markLeft("sales");

    await expect(handOver("director", sales, bd)).rejects.toMatchObject({
      code: "42501",
    });
    expect(await ownersOf(customer)).toEqual([sales]);
  });

  it("refuses someone still here, the leaver themselves, or a recipient who left", async () => {
    const { sales, bd, site } = t.profileIds;
    await expect(handOver("md", sales, bd)).rejects.toMatchObject({
      code: "55000",
    });
    await markLeft("sales");
    await expect(handOver("md", sales, sales)).rejects.toMatchObject({
      code: "22023",
    });
    await markLeft("site");
    await expect(handOver("md", sales, site)).rejects.toMatchObject({
      code: "22023",
    });
  });

  it("lets nobody write the list directly", async () => {
    await t.actAs("md");
    await expect(
      t.db.query(
        "insert into public.handover_items (from_id, to_id, contact_id, handed_over_by) values ($1, $2, null, $1)",
        [t.profileIds.sales, t.profileIds.bd],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

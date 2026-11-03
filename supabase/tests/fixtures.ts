import type { TestDatabase } from "./harness";

// Rows other tables point at. They are added as the service role (no signed-in user), so no
// role rule gets in the way; each test then acts as the person it is about.

let counter = 0;
const next = () => ++counter;

async function insertId(
  t: TestDatabase,
  sql: string,
  params: unknown[],
): Promise<string> {
  await t.actAs(null);
  const { rows } = await t.db.query<{ id: string }>(sql, params);
  return rows[0].id;
}

/** An order owned by the sales person. */
export function addMof(t: TestDatabase, contractSum = 1000) {
  return insertId(
    t,
    `insert into public.mofs (mof_no, loa_date, salesperson_id, company_name, project_name, contract_sum)
     values ($1, current_date, $2, 'Test Co', 'Test Project', $3) returning id`,
    [`MOF-${next()}`, t.profileIds.sales, contractSum],
  );
}

/** A customer contact, in a company of its own. */
export async function addContact(t: TestDatabase) {
  const companyId = await insertId(
    t,
    "insert into public.companies (name) values ($1) returning id",
    [`Fixture Co ${next()}`],
  );
  return insertId(
    t,
    "insert into public.contacts (company_id, name, mobile) values ($1, 'Contact', $2) returning id",
    [companyId, `6013${String(next()).padStart(7, "0")}`],
  );
}

/** A project led by the sales person. */
export async function addProject(t: TestDatabase) {
  const contactId = await addContact(t);
  return insertId(
    t,
    `insert into public.projects (contact_id, name, lead_source, pic_id)
     values ($1, $2, 'referral', $3) returning id`,
    [contactId, `Fixture Project ${next()}`, t.profileIds.sales],
  );
}

/** Today's date in Malaysia plus a number of days, as YYYY-MM-DD. */
export async function malaysiaDate(t: TestDatabase, plusDays = 0) {
  const { rows } = await t.db.query<{ d: string }>(
    "select to_char((now() at time zone 'Asia/Kuala_Lumpur')::date + $1::int, 'YYYY-MM-DD') as d",
    [plusDays],
  );
  return rows[0].d;
}

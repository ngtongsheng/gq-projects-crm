import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 13 task 02: a salesperson reads and edits only their own costing; a Marketing Director
// reads their team's; the MD, Sales Director, Purchasing and HR & Accounts read all; nobody
// else reads any. Purchasing works FOB enquiries but never edits a quote. An approved
// revision is frozen except for the chosen option.

type Quote = {
  quoteId: string;
  revisionId: string;
  optionId: string;
  itemId: string;
};

let t: TestDatabase;
let beeId: string;
let mine: Quote;
let bees: Quote;

async function actAsId(profileId: string) {
  await t.db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    profileId,
  ]);
  await t.db.exec("set role authenticated");
}

async function actAs(who: JobRole | string) {
  if (t.profileIds[who as JobRole]) await t.actAs(who as JobRole);
  else await actAsId(who);
}

async function query<T>(
  who: JobRole | string,
  sql: string,
  params: unknown[] = [],
) {
  await actAs(who);
  const { rows } = await t.db.query<T>(sql, params);
  return rows;
}

async function idsIn(who: JobRole | string, table: string) {
  const rows = await query<{ id: string }>(
    who,
    `select id from public.${table}`,
  );
  return rows.map((row) => row.id);
}

/** A quote with one draft revision, option A and one local carpet line, added by its owner. */
async function addQuote(
  owner: JobRole | string,
  quoteNo: string,
): Promise<Quote> {
  const [quote] = await query<{ id: string }>(
    owner,
    `insert into public.quotes (quote_no, project_name, customer_name)
     values ($1, 'Lobby', 'Acme') returning id`,
    [quoteNo],
  );
  const [revision] = await query<{ id: string }>(
    owner,
    "insert into public.quote_revisions (quote_id, rev) values ($1, 0) returning id",
    [quote.id],
  );
  const [option] = await query<{ id: string }>(
    owner,
    "insert into public.quote_options (revision_id, key) values ($1, 'A') returning id",
    [revision.id],
  );
  const [item] = await query<{ id: string }>(
    owner,
    `insert into public.quote_items (option_id, position, category, type, product, qty, rate, material, install)
     values ($1, 0, 'si', 'local', 'Carpet tile', 100, 60, 30, 5) returning id`,
    [option.id],
  );
  return {
    quoteId: quote.id,
    revisionId: revision.id,
    optionId: option.id,
    itemId: item.id,
  };
}

async function setStatus(
  who: JobRole | string,
  revisionId: string,
  status: string,
) {
  return query(
    who,
    "update public.quote_revisions set status = $1 where id = $2",
    [status, revisionId],
  );
}

beforeAll(async () => {
  t = await createTestDatabase();
  await t.actAs(null);
  const { rows } = await t.db.query<{ id: string }>(
    "insert into auth.users (email) values ('bee@test.local') returning id",
  );
  beeId = rows[0].id;
  await t.db.query(
    "update public.profiles set job_role = 'sales', reports_to = $1 where id = $2",
    [t.profileIds.bd, beeId],
  );
  mine = await addQuote("sales", "GQ-1001");
  bees = await addQuote(beeId, "GQ-1002");
});

afterAll(async () => {
  await t.close();
});

describe("settings", () => {
  it("ships a 30% minimum margin and a 10% SST", async () => {
    const rows = await query<{ key: string; value: number }>(
      "sales",
      `select key, value from public.app_settings
       where key in ('costing_min_margin_pct', 'costing_sst_pct') order by key`,
    );
    expect(rows).toEqual([
      { key: "costing_min_margin_pct", value: 30 },
      { key: "costing_sst_pct", value: 10 },
    ]);
  });

  it("gives a new revision the SST setting", async () => {
    const [revision] = await query<{ sst_pct: string }>(
      "sales",
      "select sst_pct from public.quote_revisions where id = $1",
      [mine.revisionId],
    );
    expect(Number(revision.sst_pct)).toBe(10);
  });
});

const quoteTables = [
  ["quotes", "quoteId"],
  ["quote_revisions", "revisionId"],
  ["quote_options", "optionId"],
  ["quote_items", "itemId"],
] as const;

describe.each(quoteTables)("who reads %s", (table, key) => {
  it("a salesperson reads only their own", async () => {
    expect(await idsIn(beeId, table)).toEqual([bees[key]]);
  });

  it("a Marketing Director reads their team's only", async () => {
    expect(await idsIn("bd", table)).toEqual([bees[key]]);
  });

  it.each([
    "md",
    "director",
    "support",
    "accounts",
  ] as const)("%s reads all", async (jobRole) => {
    const rows = await idsIn(jobRole, table);
    expect(rows).toContain(mine[key]);
    expect(rows).toContain(bees[key]);
  });

  it.each([
    "site",
    "ssup",
    "marketing",
    "designer",
  ] as const)("%s reads nothing", async (jobRole) => {
    expect(await idsIn(jobRole, table)).toEqual([]);
  });
});

describe("who writes a quote", () => {
  it("refuses a quote number that names a revision", async () => {
    await expect(addQuote("sales", "GQ-1003-R1")).rejects.toThrow();
  });

  it("refuses a quote added for someone else", async () => {
    await expect(
      query(
        "sales",
        `insert into public.quotes (quote_no, project_name, customer_name, salesperson_id)
         values ('GQ-1004', 'P', 'C', $1)`,
        [beeId],
      ),
    ).rejects.toThrow();
  });

  it("refuses Purchasing adding a quote", async () => {
    await expect(addQuote("support", "GQ-1005")).rejects.toThrow();
  });

  it("does not let Purchasing or a director edit someone's lines", async () => {
    for (const who of ["support", "director"] as const) {
      const rows = await query(
        who,
        "update public.quote_items set rate = 1 where id = $1 returning id",
        [mine.itemId],
      );
      expect(rows).toEqual([]);
    }
  });

  it("does not let another salesperson edit the lines", async () => {
    const rows = await query(
      beeId,
      "update public.quote_items set rate = 1 where id = $1 returning id",
      [mine.itemId],
    );
    expect(rows).toEqual([]);
  });

  it("refuses a line carrying another type's cost", async () => {
    await expect(
      query(
        "sales",
        `insert into public.quote_items (option_id, position, category, type, qty, rate, cost)
         values ($1, 1, 'si', 'local', 1, 1, 5)`,
        [mine.optionId],
      ),
    ).rejects.toThrow();
  });
});

describe("approval flow", () => {
  it("refuses Purchasing changing the status", async () => {
    await expect(
      setStatus("support", mine.revisionId, "approved"),
    ).resolves.toEqual([]);
  });

  it("refuses a director approving a draft", async () => {
    await expect(
      setStatus("director", mine.revisionId, "approved"),
    ).rejects.toThrow();
  });

  it("lets the owner submit, and refuses the owner returning it", async () => {
    await setStatus("sales", mine.revisionId, "submitted");
    await expect(
      setStatus("sales", mine.revisionId, "returned"),
    ).rejects.toThrow();
  });

  it("lets the owner keep editing a submitted revision", async () => {
    const rows = await query(
      "sales",
      "update public.quote_items set rate = 65 where id = $1 returning id",
      [mine.itemId],
    );
    expect(rows).toHaveLength(1);
  });

  it("refuses a director changing figures while returning", async () => {
    await expect(
      query(
        "director",
        "update public.quote_revisions set status = 'returned', fx_usd = 9 where id = $1",
        [mine.revisionId],
      ),
    ).rejects.toThrow();
  });

  it("lets a director return, the owner resubmit and the MD approve", async () => {
    await setStatus("director", mine.revisionId, "returned");
    await setStatus("sales", mine.revisionId, "submitted");
    await setStatus("md", mine.revisionId, "approved");
    const [revision] = await query<{ status: string }>(
      "sales",
      "select status from public.quote_revisions where id = $1",
      [mine.revisionId],
    );
    expect(revision.status).toBe("approved");
  });

  it("writes history as the signed-in person", async () => {
    const [row] = await query<{ by_id: string }>(
      "md",
      `insert into public.quote_revision_history (revision_id, action, note)
       values ($1, 'approved', 'ok') returning by_id`,
      [mine.revisionId],
    );
    expect(row.by_id).toBe(t.profileIds.md);
    await expect(
      query(
        "support",
        `insert into public.quote_revision_history (revision_id, action) values ($1, 'edited')`,
        [mine.revisionId],
      ),
    ).rejects.toThrow();
  });
});

describe("an approved revision", () => {
  it("refuses the owner changing its figures", async () => {
    await expect(
      query(
        "sales",
        "update public.quote_revisions set sst_pct = 6 where id = $1",
        [mine.revisionId],
      ),
    ).rejects.toThrow();
  });

  it("leaves its lines and options untouched", async () => {
    const updated = await query(
      "sales",
      "update public.quote_items set rate = 1 where id = $1 returning id",
      [mine.itemId],
    );
    const removed = await query(
      "sales",
      "delete from public.quote_options where id = $1 returning id",
      [mine.optionId],
    );
    expect(updated).toEqual([]);
    expect(removed).toEqual([]);
    await expect(
      query(
        "sales",
        `insert into public.quote_items (option_id, position, category, type, qty, rate)
         values ($1, 1, 'disc', 'discount', 1, 10)`,
        [mine.optionId],
      ),
    ).rejects.toThrow();
  });

  it("lets the owner record the chosen option", async () => {
    const rows = await query(
      "sales",
      "update public.quote_revisions set chosen_option_id = $1 where id = $2 returning id",
      [mine.optionId, mine.revisionId],
    );
    expect(rows).toHaveLength(1);
  });

  it("refuses a chosen option from another revision", async () => {
    await expect(
      query(
        "sales",
        "update public.quote_revisions set chosen_option_id = $1 where id = $2",
        [bees.optionId, mine.revisionId],
      ),
    ).rejects.toThrow();
  });
});

describe("FOB enquiries", () => {
  let mineId: string;
  let beesId: string;

  beforeAll(async () => {
    [{ id: mineId }] = await query<{ id: string }>(
      "sales",
      `insert into public.fob_enquiries (quote_no, salesperson_id, product, qty)
       values ('GQ-1001', $1, 'Axminster 42oz', 1500) returning id`,
      [t.profileIds.sales],
    );
    [{ id: beesId }] = await query<{ id: string }>(
      "support",
      `insert into public.fob_enquiries (quote_no, salesperson_id, product)
       values ('GQ-1002', $1, 'Wilton') returning id`,
      [beeId],
    );
  });

  it("Purchasing reads all and fills the FOB, stamped as the reply", async () => {
    expect(await idsIn("support", "fob_enquiries")).toEqual(
      expect.arrayContaining([mineId, beesId]),
    );
    const [row] = await query<{ status: string; replied_by: string }>(
      "support",
      `update public.fob_enquiries set fob = 3.85, fx = 4.5
       where id = $1 returning status, replied_by`,
      [mineId],
    );
    expect(row).toEqual({
      status: "replied",
      replied_by: t.profileIds.support,
    });
  });

  it("a salesperson reads only their own", async () => {
    expect(await idsIn("sales", "fob_enquiries")).toEqual([mineId]);
  });

  it("the director reads all", async () => {
    expect(await idsIn("director", "fob_enquiries")).toEqual(
      expect.arrayContaining([mineId, beesId]),
    );
  });

  it("the site role reads none", async () => {
    expect(await idsIn("site", "fob_enquiries")).toEqual([]);
  });

  it("refuses a salesperson adding one for someone else", async () => {
    await expect(
      query(
        "sales",
        "insert into public.fob_enquiries (salesperson_id, product) values ($1, 'X')",
        [beeId],
      ),
    ).rejects.toThrow();
  });
});

describe("people who left", () => {
  it("read no quotes", async () => {
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set active = false where id = $1",
      [beeId],
    );
    expect(await idsIn(beeId, "quotes")).toEqual([]);
    await t.actAs(null);
    await t.db.query("update public.profiles set active = true where id = $1", [
      beeId,
    ]);
  });
});

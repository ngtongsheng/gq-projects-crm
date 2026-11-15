import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMof } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 18 task 04 (D2): the app issues DO running numbers, never twice and never a cancelled one.

let t: TestDatabase;
let mofId: string;

async function addDelivery(status = "scheduled") {
  await t.actAs("support");
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.jobs (mof_id, job_type, scheduled_on, ends_on)
     values ($1, 'delivery', '2026-11-20', '2026-11-20') returning id`,
    [mofId],
  );
  if (status !== "scheduled") {
    await t.db.query("update public.jobs set status = $1 where id = $2", [
      status,
      rows[0].id,
    ]);
  }
  return rows[0].id;
}

async function issue(jobId: string) {
  const { rows } = await t.db.query<{ no: string }>(
    "select public.issue_do_number($1) as no",
    [jobId],
  );
  return rows[0].no;
}

async function nextNo() {
  const { rows } = await t.db.query<{ no: string }>(
    "select public.next_do_number() as no",
  );
  return rows[0].no;
}

async function addLine(
  jobId: string,
  position: number,
  line: { product: string; code?: string; unit: string; qty: number },
) {
  await t.db.query(
    `insert into public.delivery_order_lines
       (delivery_order_id, position, product, code, unit, qty)
     select id, $2, $3, $4, $5, $6 from public.delivery_orders where job_id = $1`,
    [jobId, position, line.product, line.code ?? null, line.unit, line.qty],
  );
}

beforeAll(async () => {
  t = await createTestDatabase();
  mofId = await addMof(t);
});

afterAll(async () => {
  await t.close();
});

describe("issuing a DO number", () => {
  it("starts at 5541 and adds the DO to the job", async () => {
    const jobId = await addDelivery();
    expect(await issue(jobId)).toBe("5541");
    const { rows } = await t.db.query<{ running_no: string; issued_at: Date }>(
      "select running_no, issued_at from public.delivery_orders where job_id = $1",
      [jobId],
    );
    expect(rows[0].running_no).toBe("5541");
    expect(rows[0].issued_at).not.toBeNull();
  });

  it("keeps the number a DO already has", async () => {
    const jobId = await addDelivery();
    const first = await issue(jobId);
    expect(await issue(jobId)).toBe(first);
  });

  it("gives distinct numbers when many are issued at once", async () => {
    const jobIds = await Promise.all(
      Array.from({ length: 8 }, () => addDelivery()),
    );
    const numbers = await Promise.all(jobIds.map(issue));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("serialises issuers on the numbering row lock", async () => {
    // PGlite has one connection, so two sessions cannot race here. Race-freedom comes from
    // `for update` on the single numbering row: a second issuer waits until the first commits.
    const { rows } = await t.db.query<{ src: string }>(
      "select prosrc as src from pg_proc where proname = 'issue_do_number'",
    );
    expect(rows[0].src).toMatch(
      /from public\.delivery_order_numbering for update/,
    );
  });

  it("continues after a number keyed in from Zoho", async () => {
    const keyed = await addDelivery();
    await t.db.query(
      "insert into public.delivery_orders (mof_id, job_id, running_no) values ($1, $2, '6000')",
      [mofId, keyed],
    );
    expect(await issue(await addDelivery())).toBe("6001");
  });

  it("is refused for HR & Accounts", async () => {
    const jobId = await addDelivery();
    await t.actAs("accounts");
    await expect(issue(jobId)).rejects.toThrow(/Only the MD/);
  });

  it("is refused for a job that is not a delivery", async () => {
    await t.actAs("support");
    const { rows } = await t.db.query<{ id: string }>(
      `insert into public.jobs (mof_id, job_type, scheduled_on, ends_on)
       values ($1, 'installation', '2026-11-20', '2026-11-20') returning id`,
      [mofId],
    );
    await expect(issue(rows[0].id)).rejects.toThrow(/delivery job/);
  });
});

describe("a cancelled DO number", () => {
  it("is never reused, by the app or by keying it in", async () => {
    const jobId = await addDelivery();
    const cancelled = await issue(jobId);
    await t.db.query(
      "update public.delivery_orders set running_no = null where job_id = $1",
      [jobId],
    );

    const { rows } = await t.db.query<{ running_no: string }>(
      "select running_no from public.cancelled_delivery_order_numbers where job_id = $1",
      [jobId],
    );
    expect(rows.map((row) => row.running_no)).toEqual([cancelled]);

    const fresh = await issue(await addDelivery());
    expect(Number(fresh)).toBeGreaterThan(Number(cancelled));

    await expect(
      t.db.query(
        "update public.delivery_orders set running_no = $1 where job_id = $2",
        [cancelled, jobId],
      ),
    ).rejects.toThrow(/cancelled DO/);
  });

  it("counts as used when it is the highest number", async () => {
    const jobId = await addDelivery();
    const top = await issue(jobId);
    await t.db.query(
      "update public.delivery_orders set running_no = null where job_id = $1",
      [jobId],
    );
    expect(await nextNo()).toBe(String(Number(top) + 1));
  });

  it("cannot be added to the list by hand", async () => {
    await t.actAs("md");
    await expect(
      t.db.query(
        "insert into public.cancelled_delivery_order_numbers (running_no, mof_id) values ('9000', $1)",
        [mofId],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("setting the next DO number", () => {
  it("must be higher than the last number used", async () => {
    await t.actAs("accounts");
    const { rows } = await t.db.query<{ last: number }>(
      "select public.last_delivery_order_number() as last",
    );
    const last = rows[0].last;
    await expect(
      t.db.query("select public.set_next_do_number($1)", [last]),
    ).rejects.toThrow(/higher than the last number used/);

    await t.db.query("select public.set_next_do_number($1)", [last + 50]);
    expect(await nextNo()).toBe(String(last + 50));
  });

  it("is the number the next DO gets, and moves on after it", async () => {
    await t.actAs("md");
    const { rows } = await t.db.query<{ last: number }>(
      "select public.last_delivery_order_number() as last",
    );
    const wanted = rows[0].last + 10;
    await t.db.query("select public.set_next_do_number($1)", [wanted]);
    await t.actAs("support");
    expect(await issue(await addDelivery())).toBe(String(wanted));
    expect(await nextNo()).toBe(String(wanted + 1));
  });

  it("is refused for the Sales Director", async () => {
    await t.actAs("director");
    await expect(
      t.db.query("select public.set_next_do_number(9000)"),
    ).rejects.toThrow(/Only the MD, Purchasing or HR & Accounts/);
  });

  it("cannot be written directly", async () => {
    await t.actAs("md");
    await expect(
      t.db.query("update public.delivery_order_numbering set next_no = 1"),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("delivered to date", () => {
  it("sums each item across the MOF's DOs, leaving out postponed and the current one", async () => {
    mofId = await addMof(t);
    const first = await addDelivery();
    const second = await addDelivery();
    const postponed = await addDelivery();
    const current = await addDelivery();
    for (const jobId of [first, second, postponed, current]) {
      await issue(jobId);
    }
    await addLine(first, 1, {
      product: "Carpet Tile",
      code: "CSC-01",
      unit: "Box",
      qty: 10,
    });
    await addLine(first, 2, { product: "Adhesive", unit: "Pail", qty: 2 });
    await addLine(second, 1, {
      product: "Carpet Tile",
      code: "CSC-01",
      unit: "Box",
      qty: 5.5,
    });
    await addLine(postponed, 1, {
      product: "Carpet Tile",
      code: "CSC-01",
      unit: "Box",
      qty: 100,
    });
    await addLine(current, 1, {
      product: "Carpet Tile",
      code: "CSC-01",
      unit: "Box",
      qty: 7,
    });
    await t.db.query(
      "update public.jobs set status = 'postponed' where id = $1",
      [postponed],
    );

    const { rows } = await t.db.query<{
      item: string;
      unit: string;
      qty: string;
    }>("select item, unit, qty from public.delivered_to_date($1, $2)", [
      mofId,
      current,
    ]);
    expect(rows).toEqual([
      { item: "Adhesive", unit: "Pail", qty: "2.00" },
      { item: "CSC-01", unit: "Box", qty: "15.50" },
    ]);
  });

  it("lines are written only by schedulers", async () => {
    const jobId = await addDelivery();
    await issue(jobId);
    await t.actAs("accounts");
    await expect(
      addLine(jobId, 1, { product: "Rug", unit: "Pc", qty: 1 }),
    ).rejects.toThrow(/row-level security/);
  });
});

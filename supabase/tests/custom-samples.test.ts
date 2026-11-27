import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 25 task 06: custom samples (demo vTuft). Keepers record and take samples back, sellers and
// the MD borrow, the borrower marks a loan returned, keepers or the borrower give a sample away
// once. HR & Accounts reads only; Site Supervisors see nothing.

let t: TestDatabase;

const KEEPERS: JobRole[] = [
  "md",
  "designer",
  "support",
  "ssup",
  "marketing",
  "director",
];

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

async function query<Row>(as: JobRole, sql: string, params: unknown[] = []) {
  await t.actAs(as);
  const { rows } = await t.db.query<Row>(sql, params);
  return rows;
}

async function record(
  as: JobRole = "designer",
  { code = null as string | null, qty = 1 } = {},
) {
  const rows = await query<{ id: string; code: string }>(
    as,
    `insert into public.custom_samples (code, design_name, design_no, qty)
     values ($1, 'Botanical swirl', 'BS-01', $2) returning id, code`,
    [code, qty],
  );
  return rows[0];
}

async function borrow(
  as: JobRole,
  sampleId: string,
  { salesperson = as as JobRole, outOn = "2027-03-01" } = {},
) {
  const rows = await query<{ id: string; due: string }>(
    as,
    `insert into public.custom_sample_loans (sample_id, salesperson_id, customer, out_on)
     values ($1, $2, 'Hotel Seri', $3)
     returning id, to_char(due_on, 'YYYY-MM-DD') as due`,
    [sampleId, t.profileIds[salesperson], outOn],
  );
  return rows[0];
}

const updateLoan = (as: JobRole, loanId: string, set: string) =>
  query<{ id: string }>(
    as,
    `update public.custom_sample_loans set ${set} where id = $1 returning id`,
    [loanId],
  );

const updateSample = (as: JobRole, sampleId: string, set: string) =>
  query<{ id: string }>(
    as,
    `update public.custom_samples set ${set} where id = $1 returning id`,
    [sampleId],
  );

async function loan(loanId: string) {
  const rows = await query<{
    returned: boolean;
    back_by: string | null;
    given_away: boolean;
    not_received: number;
  }>(
    "md",
    `select returned_marked_on is not null as returned, back_by, given_away,
       cardinality(not_received_on) as not_received
     from public.custom_sample_loans where id = $1`,
    [loanId],
  );
  return rows[0];
}

const giveAway = (as: JobRole, sampleId: string, reason = "Customer kept it") =>
  updateSample(
    as,
    sampleId,
    `given_to = 'Hotel Seri', gift_reason = '${reason}'`,
  );

async function setLoanDays(days: number) {
  await t.actAs("md");
  await t.db.query(
    "update public.app_settings set value = $1::jsonb where key = 'customSamples'",
    [JSON.stringify({ loanDays: days })],
  );
}

describe("recording samples", () => {
  it("numbers a blank code TS-### after the highest one", async () => {
    const first = await record();
    const second = await record();
    expect([first.code, second.code]).toEqual(["TS-001", "TS-002"]);
    await record("designer", { code: "TS-010" });
    expect((await record()).code).toBe("TS-011");
  });

  it("refuses a code already used and a quantity under 1", async () => {
    await expect(record("designer", { code: "TS-001" })).rejects.toThrow();
    await expect(record("designer", { qty: 0 })).rejects.toThrow();
  });

  it.each(KEEPERS)("%s records and edits", async (who) => {
    const sample = await record(who);
    expect(await updateSample(who, sample.id, "notes = 'Blue tones'")).toEqual([
      { id: sample.id },
    ]);
  });

  it.each(["sales", "bd", "accounts", "site"] as const)(
    "%s cannot record or edit",
    async (who) => {
      await expect(record(who)).rejects.toThrow(/row-level security/);
      const sample = await record();
      expect(await updateSample(who, sample.id, "notes = 'x'")).toEqual([]);
    },
  );

  it("keeps the photo under the sample's own folder, photos only", async () => {
    const sample = await record();
    await expect(
      updateSample(
        "designer",
        sample.id,
        `photo_path = 'custom-samples/${sample.id}/ab12cd34-swirl.jpg'`,
      ),
    ).resolves.toHaveLength(1);
    await expect(
      updateSample(
        "designer",
        sample.id,
        `photo_path = 'custom-samples/${sample.id}/ab12cd34-swirl.pdf'`,
      ),
    ).rejects.toThrow();
    await expect(
      updateSample(
        "designer",
        sample.id,
        `photo_path = 'custom-samples/${crypto.randomUUID()}/ab12cd34-swirl.jpg'`,
      ),
    ).rejects.toThrow();
  });
});

describe("who reads", () => {
  it("HR & Accounts reads samples and loans; Site Supervisors read nothing", async () => {
    const sample = await record();
    await borrow("sales", sample.id);
    const count = (as: JobRole, table: string) =>
      query<{ n: number }>(
        as,
        `select count(*)::int as n from public.${table} where ${
          table === "custom_samples" ? "id" : "sample_id"
        } = $1`,
        [sample.id],
      );
    expect(await count("accounts", "custom_samples")).toEqual([{ n: 1 }]);
    expect(await count("accounts", "custom_sample_loans")).toEqual([{ n: 1 }]);
    expect(await count("site", "custom_samples")).toEqual([{ n: 0 }]);
    expect(await count("site", "custom_sample_loans")).toEqual([{ n: 0 }]);
  });
});

describe("borrowing", () => {
  it("a salesperson borrows for themselves, due after the loan days", async () => {
    const sample = await record();
    expect((await borrow("sales", sample.id)).due).toBe("2027-03-15");
  });

  it("one open loan per sample", async () => {
    const sample = await record();
    await borrow("sales", sample.id);
    await expect(borrow("bd", sample.id)).rejects.toThrow("Already on loan.");
  });

  it.each(["bd", "director"] as const)(
    "%s borrows for themselves only",
    async (who) => {
      const sample = await record();
      await expect(
        borrow(who, sample.id, { salesperson: "sales" }),
      ).rejects.toThrow("A salesperson borrows for themselves.");
      await borrow(who, sample.id);
    },
  );

  it("the MD borrows for a salesperson, not for himself", async () => {
    const sample = await record();
    await expect(borrow("md", sample.id)).rejects.toThrow(
      "Only a salesperson borrows a custom sample.",
    );
    await borrow("md", sample.id, { salesperson: "sales" });
  });

  it.each([
    "designer",
    "support",
    "ssup",
    "marketing",
    "accounts",
    "site",
  ] as const)("%s cannot borrow", async (who) => {
    const sample = await record();
    await expect(borrow(who, sample.id)).rejects.toThrow();
    await expect(
      borrow(who, sample.id, { salesperson: "sales" }),
    ).rejects.toThrow();
  });

  it("a person who also sells borrows", async () => {
    await t.actAs(null);
    await t.db.query("update public.profiles set sells = true where id = $1", [
      t.profileIds.ssup,
    ]);
    const sample = await record();
    await borrow("ssup", sample.id);
    await t.actAs(null);
    await t.db.query("update public.profiles set sells = false where id = $1", [
      t.profileIds.ssup,
    ]);
  });
});

describe("loan days setting", () => {
  it("keepers change it; existing loans keep their due date", async () => {
    const sample = await record();
    const before = await borrow("sales", sample.id);
    await t.actAs("designer");
    await t.db.query(
      `update public.app_settings set value = '{"loanDays": 7}' where key = 'customSamples'`,
    );
    const rows = await query<{ due: string }>(
      "md",
      "select to_char(due_on, 'YYYY-MM-DD') as due from public.custom_sample_loans where id = $1",
      [before.id],
    );
    expect(rows).toEqual([{ due: "2027-03-15" }]);
    expect((await borrow("sales", (await record()).id)).due).toBe("2027-03-08");
    await setLoanDays(14);
  });

  it("HR & Accounts and salespeople cannot change it", async () => {
    for (const who of ["accounts", "sales"] as const) {
      const rows = await query(
        who,
        `update public.app_settings set value = '{"loanDays": 3}'
         where key = 'customSamples' returning key`,
      );
      expect(rows).toEqual([]);
    }
  });

  it("refuses a loan period under one day", async () => {
    await expect(setLoanDays(0)).rejects.toThrow();
  });
});

describe("two-step return", () => {
  it("the borrower marks it returned; a keeper says not received, then confirms", async () => {
    const sample = await record();
    const { id } = await borrow("sales", sample.id);
    expect(
      await updateLoan("bd", id, "returned_marked_on = current_date"),
    ).toEqual([]);
    await updateLoan("sales", id, "returned_marked_on = current_date");
    expect((await loan(id)).returned).toBe(true);

    await expect(
      updateLoan("sales", id, "returned_marked_on = null"),
    ).rejects.toThrow("Only the office answers a return.");
    await updateLoan("designer", id, "returned_marked_on = null");
    expect(await loan(id)).toMatchObject({ returned: false, not_received: 1 });

    await updateLoan("sales", id, "returned_marked_on = current_date");
    await updateLoan("designer", id, "back_on = current_date");
    expect((await loan(id)).back_by).toBe(t.profileIds.designer);
    // Available again.
    await borrow("bd", sample.id);
  });

  it("the borrower cannot confirm their own return", async () => {
    const sample = await record();
    const { id } = await borrow("sales", sample.id);
    await updateLoan("sales", id, "returned_marked_on = current_date");
    await expect(
      updateLoan("sales", id, "back_on = current_date"),
    ).rejects.toThrow("Only the office takes a sample back.");
  });

  it("a keeper takes it back in one step, and a closed loan stays closed", async () => {
    const sample = await record();
    const { id } = await borrow("sales", sample.id);
    await updateLoan("ssup", id, "back_on = current_date");
    expect(await updateLoan("md", id, "back_on = null")).toEqual([]);
    expect(
      await updateLoan("sales", id, "returned_marked_on = current_date"),
    ).toEqual([]);
  });

  it("HR & Accounts cannot answer a return", async () => {
    const sample = await record();
    const { id } = await borrow("sales", sample.id);
    expect(await updateLoan("accounts", id, "back_on = current_date")).toEqual(
      [],
    );
  });
});

describe("giving away", () => {
  it("the borrower gives it away once; the loan closes as given away", async () => {
    const sample = await record();
    const { id } = await borrow("sales", sample.id);
    expect(await giveAway("sales", sample.id)).toHaveLength(1);
    expect(await loan(id)).toMatchObject({
      given_away: true,
      back_by: t.profileIds.sales,
    });
    expect(await giveAway("designer", sample.id, "Second time")).toEqual([]);
    expect(await updateSample("designer", sample.id, "notes = 'x'")).toEqual(
      [],
    );
    await expect(borrow("bd", sample.id)).rejects.toThrow(
      "This sample was given away.",
    );
  });

  it("the borrower cannot edit the sample itself", async () => {
    const sample = await record();
    await borrow("sales", sample.id);
    await expect(
      updateSample("sales", sample.id, "design_name = 'Mine'"),
    ).rejects.toThrow("Only the office records custom samples.");
  });

  it("another salesperson cannot give it away; a keeper can, even when available", async () => {
    const lent = await record();
    await borrow("sales", lent.id);
    expect(await giveAway("bd", lent.id)).toEqual([]);
    expect(await giveAway("accounts", lent.id)).toEqual([]);
    const available = await record();
    expect(await giveAway("marketing", available.id)).toHaveLength(1);
  });

  it("needs a reason of at least 5 characters and who it went to", async () => {
    const sample = await record();
    await expect(giveAway("designer", sample.id, "ok")).rejects.toThrow();
    await expect(
      updateSample("designer", sample.id, "gift_reason = 'Kept for showroom'"),
    ).rejects.toThrow();
  });
});

describe("deleting", () => {
  it("a keeper deletes a sample never lent nor given", async () => {
    const sample = await record();
    expect(
      await query(
        "sales",
        "delete from public.custom_samples where id = $1 returning id",
        [sample.id],
      ),
    ).toEqual([]);
    expect(
      await query(
        "designer",
        "delete from public.custom_samples where id = $1 returning id",
        [sample.id],
      ),
    ).toHaveLength(1);
  });

  it("not one that was lent or given away", async () => {
    const lent = await record();
    const { id } = await borrow("sales", lent.id);
    await updateLoan("designer", id, "back_on = current_date");
    const given = await record();
    await giveAway("designer", given.id);
    for (const sampleId of [lent.id, given.id]) {
      expect(
        await query(
          "md",
          "delete from public.custom_samples where id = $1 returning id",
          [sampleId],
        ),
      ).toEqual([]);
    }
  });
});

describe("the photo upload", () => {
  const attach = async (who: JobRole) => {
    await t.actAs(who);
    await t.db.query(
      "insert into storage.objects (bucket_id, name, owner_id) values ('attachments', $1, $2)",
      [
        `custom-samples/${crypto.randomUUID()}/ab12cd34-swirl.jpg`,
        t.profileIds[who],
      ],
    );
  };

  it("keepers add a photo before the sample is saved", async () => {
    for (const who of KEEPERS) await attach(who);
  });

  it("nobody else does", async () => {
    for (const who of ["sales", "bd", "accounts", "site"] as const) {
      await expect(attach(who)).rejects.toThrow(/row-level security/);
    }
  });
});

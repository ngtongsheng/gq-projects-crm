import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 25 task 02: travel claims. The person keys in and submits; md and accounts return or
// release, and release needs the same month's monthly report submitted (D3). Released is final.

let t: TestDatabase;
let monthCounter = 0;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

/** A month no other test has used, so each test gets a fresh claim. */
function nextMonth() {
  monthCounter += 1;
  const year = 2020 + Math.floor(monthCounter / 12);
  return `${year}-${String((monthCounter % 12) + 1).padStart(2, "0")}-01`;
}

async function startClaim(
  as: JobRole,
  { month = nextMonth(), status = "submitted", petrol = "120.50" } = {},
) {
  await t.actAs(as);
  const { rows } = await t.db.query<{ id: string; month: string }>(
    `insert into public.travel_claims (month, petrol_parking_toll, status)
     values ($1, $2, $3) returning id, to_char(month, 'YYYY-MM-DD') as month`,
    [month, petrol, status],
  );
  return rows[0];
}

async function update(as: JobRole, claimId: string, set: string) {
  await t.actAs(as);
  const { rows } = await t.db.query<{ status: string }>(
    `update public.travel_claims set ${set} where id = $1 returning status`,
    [claimId],
  );
  return rows;
}

async function fileReport(filer: JobRole, month: string, status: string) {
  await t.actAs(null);
  await t.db.query(
    `insert into public.monthly_reports
       (profile_id, month, kind, status, stats, submitted_at, reviewed_at)
     values ($1, $2, $3, $4::text, case when $4 = 'draft' then null else '{}'::jsonb end,
       case when $4 = 'draft' then null else now() end,
       case when $4 = 'reviewed' then now() end)`,
    [t.profileIds[filer], month, filer, status],
  );
}

async function read(as: JobRole, claimId: string) {
  await t.actAs(as);
  const { rows } = await t.db.query<{
    status: string;
    released_by: string | null;
  }>("select status, released_by from public.travel_claims where id = $1", [
    claimId,
  ]);
  return rows;
}

describe("travel claims", () => {
  it("the person starts, edits and submits their own claim", async () => {
    const claim = await startClaim("sales", { status: "draft" });
    expect(
      await update("sales", claim.id, "hotel = 200, remark = 'KL trip'"),
    ).toEqual([{ status: "draft" }]);
    expect(await update("sales", claim.id, "status = 'submitted'")).toEqual([
      { status: "submitted" },
    ]);
    // Still theirs to update until it is released.
    expect(await update("sales", claim.id, "outstation = 50")).toEqual([
      { status: "submitted" },
    ]);
    await t.actAs("sales");
    const { rows } = await t.db.query<{ submitted: boolean; updated: boolean }>(
      `select submitted_on is not null as submitted, updated_on is not null as updated
       from public.travel_claims where id = $1`,
      [claim.id],
    );
    expect(rows).toEqual([{ submitted: true, updated: true }]);
  });

  it("refuses a second claim for the same month", async () => {
    const claim = await startClaim("sales");
    await expect(startClaim("sales", { month: claim.month })).rejects.toThrow();
  });

  it("refuses a claim from someone who does not claim travel", async () => {
    await expect(startClaim("accounts")).rejects.toThrow();
    await expect(startClaim("marketing")).rejects.toThrow();
  });

  it("refuses submitting with no amount", async () => {
    await expect(startClaim("sales", { petrol: "0" })).rejects.toThrow();
  });

  it("another staff member cannot read or change it", async () => {
    const claim = await startClaim("sales");
    expect(await read("site", claim.id)).toEqual([]);
    expect(await read("director", claim.id)).toEqual([]);
    expect(await update("site", claim.id, "hotel = 1")).toEqual([]);
    expect(await read("accounts", claim.id)).toHaveLength(1);
    expect(await read("md", claim.id)).toHaveLength(1);
  });

  it("the person cannot set the checker's columns", async () => {
    const claim = await startClaim("sales");
    await expect(
      update("sales", claim.id, "final_amount = 999"),
    ).rejects.toThrow();
    await expect(
      update("sales", claim.id, "status = 'released'"),
    ).rejects.toThrow();
  });

  it("accounts can only check, not change the amounts", async () => {
    const claim = await startClaim("sales");
    await expect(update("accounts", claim.id, "hotel = 10")).rejects.toThrow();
    expect(
      await update(
        "accounts",
        claim.id,
        "final_amount = 100, final_note = 'No receipt for toll', verified_with_vicky_on = current_date",
      ),
    ).toEqual([{ status: "submitted" }]);
  });

  it("accounts releases when the same month's report is submitted", async () => {
    const claim = await startClaim("sales");
    await fileReport("sales", claim.month, "submitted");
    expect(await update("accounts", claim.id, "status = 'released'")).toEqual([
      { status: "released" },
    ]);
    expect(await read("sales", claim.id)).toEqual([
      { status: "released", released_by: t.profileIds.accounts },
    ]);
  });

  it("a reviewed report also lets the claim go", async () => {
    const claim = await startClaim("site");
    await fileReport("site", claim.month, "reviewed");
    expect(await update("md", claim.id, "status = 'released'")).toEqual([
      { status: "released" },
    ]);
  });

  it("refuses release without the same month's submitted report", async () => {
    const claim = await startClaim("sales");
    await expect(
      update("accounts", claim.id, "status = 'released'"),
    ).rejects.toThrow("Monthly report not submitted yet.");

    const draftReport = await startClaim("bd");
    await fileReport("bd", draftReport.month, "draft");
    await expect(
      update("accounts", draftReport.id, "status = 'released'"),
    ).rejects.toThrow("Monthly report not submitted yet.");

    // A report for another month does not count.
    const otherMonth = await startClaim("sales");
    await fileReport("sales", nextMonth(), "submitted");
    await expect(
      update("accounts", otherMonth.id, "status = 'released'"),
    ).rejects.toThrow("Monthly report not submitted yet.");
  });

  it("a Sales Director files no monthly report, so nothing holds the release", async () => {
    const claim = await startClaim("director");
    expect(await update("accounts", claim.id, "status = 'released'")).toEqual([
      { status: "released" },
    ]);
    expect(await read("director", claim.id)).toEqual([
      { status: "released", released_by: t.profileIds.accounts },
    ]);
  });

  it("a salesperson who is not a report-filing role is not held either", async () => {
    await t.actAs(null);
    await t.db.query("update public.profiles set sells = true where id = $1", [
      t.profileIds.support,
    ]);
    const claim = await startClaim("support");
    expect(await update("md", claim.id, "status = 'released'")).toEqual([
      { status: "released" },
    ]);
  });

  it("refuses releasing a draft", async () => {
    const claim = await startClaim("sales", { status: "draft" });
    await fileReport("sales", claim.month, "submitted");
    expect(await update("accounts", claim.id, "status = 'released'")).toEqual(
      [],
    );
  });

  it("a released claim cannot be changed by anyone", async () => {
    const claim = await startClaim("sales");
    await fileReport("sales", claim.month, "submitted");
    await update("accounts", claim.id, "status = 'released'");
    expect(await update("sales", claim.id, "hotel = 5")).toEqual([]);
    expect(await update("accounts", claim.id, "status = 'draft'")).toEqual([]);
    expect(await update("md", claim.id, "final_amount = 1")).toEqual([]);
  });

  it("Return sends the claim back to draft for the person to fix", async () => {
    const claim = await startClaim("sales");
    expect(
      await update(
        "accounts",
        claim.id,
        "status = 'draft', final_note = 'Attach the TNG statement'",
      ),
    ).toEqual([{ status: "draft" }]);
    expect(await update("sales", claim.id, "petrol_parking_toll = 90")).toEqual(
      [{ status: "draft" }],
    );
    expect(await update("sales", claim.id, "status = 'submitted'")).toEqual([
      { status: "submitted" },
    ]);
  });

  it("the person cannot pull a submitted claim back to draft", async () => {
    const claim = await startClaim("sales");
    await expect(
      update("sales", claim.id, "status = 'draft'"),
    ).rejects.toThrow();
  });

  it("only Site Supervisors claim overtime", async () => {
    await t.actAs("site");
    const { rows } = await t.db.query<{ overtime: string }>(
      `insert into public.travel_claims (month, overtime, status)
       values ($1, 80, 'submitted') returning overtime`,
      [nextMonth()],
    );
    expect(rows).toEqual([{ overtime: "80.00" }]);

    await t.actAs("sales");
    await expect(
      t.db.query(
        "insert into public.travel_claims (month, overtime) values ($1, 80)",
        [nextMonth()],
      ),
    ).rejects.toThrow("Only Site Supervisors claim overtime.");
    const claim = await startClaim("sales", { status: "draft" });
    await expect(update("sales", claim.id, "overtime = 10")).rejects.toThrow(
      "Only Site Supervisors claim overtime.",
    );
  });

  it("refuses others without saying what was bought", async () => {
    await t.actAs("sales");
    await expect(
      t.db.query(
        "insert into public.travel_claims (month, others) values ($1, 30)",
        [nextMonth()],
      ),
    ).rejects.toThrow();
    const { rows } = await t.db.query<{ others: string }>(
      `insert into public.travel_claims (month, others, others_description)
       values ($1, 30, 'Tape measure') returning others`,
      [nextMonth()],
    );
    expect(rows).toEqual([{ others: "30.00" }]);
  });

  it("keeps the stored claim settings and checks only the cut-off day", async () => {
    await t.actAs(null);
    const { rows } = await t.db.query<{ cut: number }>(
      "select (value ->> 'cutOffDay')::int as cut from public.app_settings where key = 'claims'",
    );
    expect(rows).toEqual([{ cut: 25 }]);
    await t.db.query(
      `update public.app_settings set value = '{"cutOffDay": 20}' where key = 'claims'`,
    );
    await expect(
      t.db.query(
        `update public.app_settings set value = '{"cutOffDay": 31}' where key = 'claims'`,
      ),
    ).rejects.toThrow();
  });
});

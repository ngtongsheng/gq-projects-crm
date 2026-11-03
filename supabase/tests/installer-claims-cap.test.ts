import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMof } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 audit: progress and final claims together cannot pass the installer PO amount.
// Two saves at once is out of reach in PGlite; the cap itself is what is checked here.

const overPo =
  "These claims add up to more than the installer PO. If there is extra work, increase the PO amount first.";

let t: TestDatabase;
let installerCounter = 0;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

/** A PO of 1000 on its own order, so each test starts with nothing claimed. */
async function addPo() {
  const mofId = await addMof(t);
  await t.actAs("md");
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.installer_pos (mof_id, po_no, po_date, installer, amount)
     values ($1, 'PO-1', current_date, $2, 1000) returning id`,
    [mofId, `Installer ${++installerCounter}`],
  );
  return rows[0].id;
}

function addClaim(poId: string, claimType: string, amount: number) {
  return t.db.query<{ id: string }>(
    `insert into public.installer_claims (installer_po_id, claim_type, amount, claimed_on)
     values ($1, $2, $3, current_date) returning id`,
    [poId, claimType, amount],
  );
}

describe("installer claims", () => {
  it("refuses a claim that takes progress and final past the PO", async () => {
    const poId = await addPo();
    await addClaim(poId, "progress", 600);

    await expect(addClaim(poId, "final", 500)).rejects.toThrow(overPo);
  });

  it("allows claims that add up to exactly the PO", async () => {
    const poId = await addPo();
    await addClaim(poId, "progress", 600);

    await expect(addClaim(poId, "final", 400)).resolves.toBeDefined();
  });

  it("does not count deductions", async () => {
    const poId = await addPo();
    await addClaim(poId, "progress", 1000);

    await expect(addClaim(poId, "deduction", 300)).resolves.toBeDefined();
  });

  it("refuses raising a claim past the PO", async () => {
    const poId = await addPo();
    await addClaim(poId, "progress", 600);
    const { rows } = await addClaim(poId, "final", 300);

    await expect(
      t.db.query(
        "update public.installer_claims set amount = 500 where id = $1",
        [rows[0].id],
      ),
    ).rejects.toThrow(overPo);
  });

  it("allows editing a claim without changing its amount or type", async () => {
    const poId = await addPo();
    await addClaim(poId, "progress", 600);
    const { rows } = await addClaim(poId, "final", 400);

    await expect(
      t.db.query(
        "update public.installer_claims set claim_no = 'C-2' where id = $1",
        [rows[0].id],
      ),
    ).resolves.toMatchObject({ affectedRows: 1 });
  });
});

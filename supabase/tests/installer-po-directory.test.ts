import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addInstaller, addMof } from "./fixtures";
import {
  applyMigrations,
  createTestDatabase,
  type TestDatabase,
} from "./harness";

// Loop 24 task 06 (D5): every installer PO points at one installer in the directory, so one MOF
// cannot hold two POs for the same installer under different spellings.

const MIGRATION = "20261120160000_installer_po_directory.sql";

/** An MOF added before the migration, as the service role. */
async function addOldMof(db: TestDatabase, mofNo: string) {
  await db.actAs(null);
  const { rows } = await db.db.query<{ id: string }>(
    `insert into public.mofs (mof_no, loa_date, salesperson_id, company_name, project_name,
       contract_sum)
     values ($1, current_date, $2, 'Old Co', $1, 1000) returning id`,
    [mofNo, db.profileIds.sales],
  );
  return rows[0].id;
}

async function addOldPo(
  db: TestDatabase,
  mofId: string,
  poNo: string,
  installer: string,
) {
  await db.db.query(
    `insert into public.installer_pos (mof_id, po_no, po_date, installer, amount)
     values ($1, $2, current_date, $3, 500)`,
    [mofId, poNo, installer],
  );
}

describe("the backfill", () => {
  let before: TestDatabase;

  beforeAll(async () => {
    before = await createTestDatabase({ migrationsBefore: MIGRATION });
    const mofId = await addOldMof(before, "MOF-OLD");
    const otherMofId = await addOldMof(before, "MOF-OTHER");
    await before.db.query(
      "insert into public.installers (name) values ('Leong')",
    );
    await addOldPo(before, mofId, "PO-1", "leong");
    await addOldPo(before, mofId, "PO-2", "Nora  Lim");
    await addOldPo(before, otherMofId, "PO-3", "Nora Lim");

    await applyMigrations(before.db, { from: MIGRATION });
  });

  afterAll(async () => {
    await before.close();
  });

  it("links every PO to its directory installer and keeps the typed name", async () => {
    const { rows } = await before.db.query<{
      po_no: string;
      installer: string;
      name: string;
    }>(
      `select p.po_no, p.installer, i.name from public.installer_pos p
       join public.installers i on i.id = p.installer_id order by p.po_no`,
    );
    expect(rows).toEqual([
      { po_no: "PO-1", installer: "leong", name: "Leong" },
      { po_no: "PO-2", installer: "Nora  Lim", name: "Nora Lim" },
      { po_no: "PO-3", installer: "Nora Lim", name: "Nora Lim" },
    ]);
  });

  it("adds installers named only on POs to the directory once", async () => {
    const { rows } = await before.db.query<{ name: string }>(
      "select name from public.installers order by name",
    );
    expect(rows.map((r) => r.name)).toEqual(["Leong", "Nora Lim"]);
  });
});

describe("two spellings of one installer on one MOF", () => {
  it("stops the migration and names the POs", async () => {
    const db = await createTestDatabase({ migrationsBefore: MIGRATION });
    try {
      const mofId = await addOldMof(db, "MOF-OLD");
      await addOldPo(db, mofId, "PO-1", "Leong");
      await addOldPo(db, mofId, "PO-2", "leong");

      const run = applyMigrations(db.db, { from: MIGRATION });

      await expect(run).rejects.toThrow(
        /same installer twice on one MOF.*MOF MOF-OLD .*POs PO-1, PO-2 name Leong \/ leong/,
      );
    } finally {
      await db.close();
    }
  });
});

describe("after the migration", () => {
  let t: TestDatabase;
  let mofId: string;
  let installerId: string;

  async function addPo(poNo: string, installer: string) {
    await t.actAs("support");
    return t.db.query<{ installer: string }>(
      `insert into public.installer_pos (mof_id, po_no, po_date, installer_id, amount)
       values ($1, $2, current_date, $3, 500) returning installer`,
      [mofId, poNo, installer],
    );
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    mofId = await addMof(t);
    installerId = await addInstaller(t);
  });

  afterAll(async () => {
    await t.close();
  });

  it("writes the installer's directory name on the PO", async () => {
    await t.actAs(null);
    const {
      rows: [installer],
    } = await t.db.query<{ name: string }>(
      "select name from public.installers where id = $1",
      [installerId],
    );

    const { rows } = await addPo("PO-1", installerId);

    expect(rows[0].installer).toBe(installer.name);
  });

  it("refuses a second PO for the same installer on the MOF", async () => {
    await expect(addPo("PO-2", installerId)).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("refuses an installer who is not in the directory", async () => {
    await expect(
      addPo("PO-3", "99999999-9999-4999-8999-999999999999"),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("does not let the app type the installer's name", async () => {
    await t.actAs("support");
    await expect(
      t.db.query(
        `insert into public.installer_pos (mof_id, po_no, po_date, installer, amount)
         values ($1, 'PO-4', current_date, 'Typed Name', 500)`,
        [mofId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

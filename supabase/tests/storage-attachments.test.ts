import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 11 task 10: the private attachments bucket. People add files as themselves, in the
// <area>/<record-id>/<file> shape; nobody reads, replaces or deletes through the API.

let t: TestDatabase;

const RECORD = "3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f";
const OK_PATH = `leave/${RECORD}/abc-mc-slip.jpg`;

function addObject(ownerId: string, name: string, bucket = "attachments") {
  return t.db.query(
    "insert into storage.objects (bucket_id, name, owner_id) values ($1, $2, $3)",
    [bucket, name, ownerId],
  );
}

beforeAll(async () => {
  t = await createTestDatabase();
  await t.actAs(null);
  await t.db.exec(
    "insert into storage.buckets (id, name) values ('public-files', 'public-files')",
  );
});

afterAll(() => t.close());

describe("the attachments bucket", () => {
  it("is private, capped at 1.5 MB and limited to images and PDFs", async () => {
    await t.actAs(null);
    const { rows } = await t.db.query<{
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    }>(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'attachments'",
    );
    expect(rows).toEqual([
      {
        public: false,
        file_size_limit: 1572864,
        allowed_mime_types: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ],
      },
    ]);
  });
});

describe("adding a file", () => {
  it("lets an active person add a file as themselves", async () => {
    await t.actAs("sales");
    await addObject(t.profileIds.sales, OK_PATH);
  });

  it("refuses a file recorded under someone else", async () => {
    await t.actAs("sales");
    await expect(addObject(t.profileIds.md, OK_PATH)).rejects.toThrow(
      /row-level security/,
    );
  });

  it.each([
    ["no record folder", "mc-slip.jpg"],
    ["a record id that is not an id", "leave/not-an-id/mc-slip.jpg"],
    ["a folder too deep", `leave/${RECORD}/sub/mc-slip.jpg`],
    ["an area in capitals", `Leave/${RECORD}/mc-slip.jpg`],
  ])("refuses %s", async (_label, name) => {
    await t.actAs("sales");
    await expect(addObject(t.profileIds.sales, name)).rejects.toThrow(
      /row-level security/,
    );
  });

  it("refuses another bucket", async () => {
    await t.actAs("sales");
    await expect(
      addObject(t.profileIds.sales, OK_PATH, "public-files"),
    ).rejects.toThrow(/row-level security/);
  });

  it("refuses a signed-out request", async () => {
    await t.db.exec("reset role");
    await t.db.query("select set_config('request.jwt.claim.sub', '', false)");
    await t.db.exec("set role anon");
    await expect(addObject(t.profileIds.sales, OK_PATH)).rejects.toThrow(
      /permission denied|row-level security/,
    );
  });
});

describe("reading, replacing and deleting through the API", () => {
  it("shows nobody any file, not even their own", async () => {
    await t.actAs("sales");
    const own = await t.db.query("select 1 from storage.objects");
    expect(own.rows).toEqual([]);
    await t.actAs("md");
    const md = await t.db.query("select 1 from storage.objects");
    expect(md.rows).toEqual([]);
  });

  it("changes and removes nothing", async () => {
    await t.actAs("sales");
    const update = await t.db.query(
      "update storage.objects set name = 'x' where owner_id = $1",
      [t.profileIds.sales],
    );
    expect(update.affectedRows).toBe(0);
    const removed = await t.db.query(
      "delete from storage.objects where owner_id = $1",
      [t.profileIds.sales],
    );
    expect(removed.affectedRows).toBe(0);
    await t.actAs(null);
    const { rows } = await t.db.query<{ n: number }>(
      "select count(*)::int as n from storage.objects",
    );
    expect(rows[0].n).toBe(1);
  });

  it("is still open to the server, which creates the signed links", async () => {
    await t.actAs(null);
    const { rows } = await t.db.query("select 1 from storage.objects");
    expect(rows).toHaveLength(1);
  });
});

describe("a person who has left", () => {
  beforeAll(async () => {
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set active = false, left_on = current_date where id = $1",
      [t.profileIds.sales],
    );
  });

  it("cannot add a file", async () => {
    await t.actAs("sales");
    await expect(addObject(t.profileIds.sales, OK_PATH)).rejects.toThrow(
      /row-level security/,
    );
  });
});

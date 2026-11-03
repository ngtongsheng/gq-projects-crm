import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addContact } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 audit: a planned activity is completed or cancelled, both final, and a completed
// activity cannot start in the future (it feeds the visit count and the customer health flag).

let t: TestDatabase;
let contactId: string;

beforeAll(async () => {
  t = await createTestDatabase();
  contactId = await addContact(t);
  await t.actAs("sales");
});

afterAll(async () => {
  await t.close();
});

/** `offset` is a Postgres interval from now, e.g. '-2 days'. */
async function addActivity(status: string, offset: string) {
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.activities (contact_id, type, purpose, starts_at, status)
     values ($1, 'visit', 'Show samples', now() + $2::interval, $3) returning id`,
    [contactId, offset, status],
  );
  return rows[0].id;
}

function setStatus(id: string, status: string) {
  return t.db.query("update public.activities set status = $1 where id = $2", [
    status,
    id,
  ]);
}

describe("activity status", () => {
  it("allows a planned activity to be completed once it has started", async () => {
    const id = await addActivity("planned", "-2 days");
    await expect(setStatus(id, "completed")).resolves.toMatchObject({
      affectedRows: 1,
    });
  });

  it("allows a planned activity to be cancelled", async () => {
    const id = await addActivity("planned", "2 days");
    await expect(setStatus(id, "cancelled")).resolves.toMatchObject({
      affectedRows: 1,
    });
  });

  it("allows editing a completed activity without reopening it", async () => {
    const id = await addActivity("completed", "-2 days");
    await expect(
      t.db.query(
        "update public.activities set outcome = 'Liked it' where id = $1",
        [id],
      ),
    ).resolves.toMatchObject({ affectedRows: 1 });
  });

  it("refuses logging a completed activity dated in the future", async () => {
    await expect(addActivity("completed", "2 days")).rejects.toThrow(
      "A completed activity can't be in the future.",
    );
  });

  it("refuses completing a planned activity dated in the future", async () => {
    const id = await addActivity("planned", "2 days");
    await expect(setStatus(id, "completed")).rejects.toThrow(
      "A completed activity can't be in the future.",
    );
  });

  it.each([
    ["completed", "planned"],
    ["completed", "cancelled"],
    ["cancelled", "planned"],
    ["cancelled", "completed"],
  ])("refuses reopening a %s activity as %s", async (from, to) => {
    const id = await addActivity(from, "-2 days");
    await expect(setStatus(id, to)).rejects.toThrow(
      "A completed or cancelled activity can't be reopened.",
    );
  });
});

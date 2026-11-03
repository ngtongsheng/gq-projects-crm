import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 audit: there must always be an admin, or nobody can open People again. Two admins
// demoting each other at once is out of reach in PGlite; the count itself is checked here.
// The tests run in order: the MD starts as the only admin.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

function setRole(id: string, role: "admin" | "staff") {
  return t.db.query("update public.profiles set role = $1 where id = $2", [
    role,
    id,
  ]);
}

describe("admins", () => {
  it("refuses the only admin demoting themselves", async () => {
    await t.actAs("md");
    await expect(setRole(t.profileIds.md, "staff")).rejects.toThrow(
      "There must be at least one admin.",
    );
  });

  it("allows making another person an admin", async () => {
    await expect(
      setRole(t.profileIds.director, "admin"),
    ).resolves.toMatchObject({ affectedRows: 1 });
  });

  it("allows an admin to step down while another remains", async () => {
    await expect(setRole(t.profileIds.md, "staff")).resolves.toMatchObject({
      affectedRows: 1,
    });
  });

  it("refuses the last remaining admin stepping down", async () => {
    await t.actAs("director");
    await expect(setRole(t.profileIds.director, "staff")).rejects.toThrow(
      "There must be at least one admin.",
    );
  });
});

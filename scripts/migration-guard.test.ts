import { describe, expect, it } from "vitest";
import {
  findDestructiveStatements,
  parseChanges,
  runGuard,
  stripSqlNoise,
} from "./migration-guard";

const reasonsFor = (sql: string) =>
  findDestructiveStatements(sql, "m.sql").map((f) => f.reason);

describe("destructive statements are caught", () => {
  it.each([
    ["DROP TABLE clients;"],
    ["drop table if exists clients cascade;"],
    ["ALTER TABLE clients DROP COLUMN phone;"],
    ["DROP SCHEMA extras;"],
    ["DROP TYPE role;"],
    ["DROP TABLE IF EXISTS clients;"],
    ["ALTER TABLE clients DROP COLUMN IF EXISTS phone;"],
    ["TRUNCATE clients;"],
    ["TRUNCATE TABLE clients RESTART IDENTITY;"],
    ["DELETE FROM clients;"],
    ["delete\n  from clients where id = 1;"],
    ["ALTER TABLE clients ALTER COLUMN phone DROP NOT NULL;"],
    ["ALTER TABLE clients RENAME TO customers;"],
    ["ALTER TABLE clients RENAME COLUMN phone TO mobile;"],
    ["ALTER TABLE clients ALTER COLUMN phone TYPE integer;"],
    ["ALTER TABLE clients ALTER phone SET DATA TYPE integer;"],
    ["UPDATE clients SET status = 'x';"],
    ["UPDATE clients SET status = (SELECT 'a' WHERE true);"],
    ["ALTER TABLE clients DROP CONSTRAINT clients_status_check;"],
    [
      "ALTER TABLE clients DROP CONSTRAINT a_check, ADD CONSTRAINT b_check CHECK (x > 0);",
    ],
    [
      "ALTER TABLE clients DROP CONSTRAINT c_check, ADD CONSTRAINT c_check CHECK (x > 0), DROP COLUMN phone;",
    ],
  ])("%s", (sql) => {
    expect(reasonsFor(sql)).toHaveLength(1);
  });

  it("catches destructive SQL inside a DO block", () => {
    expect(reasonsFor("DO $$ BEGIN DELETE FROM clients; END $$;")).toHaveLength(
      1,
    );
  });
});

describe("safe statements pass", () => {
  it.each([
    ["DROP POLICY p ON clients;"],
    ['drop policy if exists "mof costs: managers read" on public.mof_costs;'],
    ["DROP FUNCTION touch();"],
    ["drop function if exists public.touch() cascade;"],
    ["DROP TRIGGER t ON clients;"],
    ["drop trigger if exists t on public.clients;"],
    ["DROP VIEW client_summary;"],
    ["drop view if exists client_summary;"],
    ["DROP INDEX clients_status_idx;"],
    ["drop index if exists public.clients_status_idx;"],
    ["DROP INDEX CONCURRENTLY IF EXISTS clients_status_idx;"],
    ["CREATE TABLE clients (id uuid primary key, name text);"],
    ["ALTER TABLE clients ADD COLUMN phone text;"],
    ["ALTER TABLE clients ADD COLUMN dropped_at timestamptz;"],
    ["CREATE POLICY p ON clients FOR DELETE USING (true);"],
    ["CREATE POLICY p ON clients FOR SELECT USING (auth.uid() is not null);"],
    ["ALTER TABLE clients ENABLE ROW LEVEL SECURITY;"],
    ["ALTER TYPE role ADD VALUE 'viewer';"],
    ["CREATE TABLE notes (c uuid references clients on delete cascade);"],
    ["GRANT TRUNCATE ON clients TO staff;"],
    ["UPDATE clients SET status = 'x' WHERE id = 1;"],
    ["INSERT INTO clients (a) VALUES (1) ON CONFLICT (a) DO UPDATE SET a = 2;"],
    ["CREATE INDEX ON clients (status);"],
    [
      "ALTER TABLE clients DROP CONSTRAINT clients_status_check, ADD CONSTRAINT clients_status_check CHECK (status in ('a', 'b'));",
    ],
    [
      "alter table clients drop constraint if exists c_check, add constraint c_check check (x > 0);",
    ],
  ])("%s", (sql) => {
    expect(reasonsFor(sql)).toEqual([]);
  });
});

describe("comments and strings are ignored", () => {
  it.each([
    ["-- DROP TABLE clients;\nSELECT 1;"],
    ["/* DROP TABLE clients; */ SELECT 1;"],
    ["/* outer /* nested */ DROP TABLE clients; */ SELECT 1;"],
    ["INSERT INTO log (msg) VALUES ('DROP TABLE clients;');"],
    ["INSERT INTO log (msg) VALUES ('it''s a DELETE FROM x; ok');"],
    ["INSERT INTO log (msg) VALUES (E'it\\'s a DROP TABLE x; ok');"],
    ["COMMENT ON TABLE clients IS 'We never TRUNCATE this';"],
    ['ALTER TABLE clients ADD COLUMN "drop" text;'],
    [
      "CREATE FUNCTION f() RETURNS void LANGUAGE sql AS $body$ DELETE FROM clients; $body$;",
    ],
    ["DO $$ BEGIN PERFORM 1; -- DROP TABLE x;\nEND $$;"],
  ])("%s", (sql) => {
    expect(reasonsFor(sql)).toEqual([]);
  });

  it("still catches real statements after a comment or string", () => {
    const sql = "SELECT 'a;b'; -- note; here\nDROP TABLE clients;";
    expect(findDestructiveStatements(sql, "m.sql")).toMatchObject([
      { line: 2, statement: "DROP TABLE clients" },
    ]);
  });

  it("keeps length and line breaks when stripping", () => {
    const sql = "-- a\n/* b\nc */ SELECT 'x\ny';";
    const stripped = stripSqlNoise(sql);
    expect(stripped).toHaveLength(sql.length);
    expect(stripped.split("\n")).toHaveLength(sql.split("\n").length);
  });
});

describe("reporting", () => {
  it("reports file, line and statement", () => {
    const sql = "CREATE TABLE a (id int);\n\nDELETE FROM a;\n";
    expect(findDestructiveStatements(sql, "supabase/migrations/1.sql")).toEqual(
      [
        {
          file: "supabase/migrations/1.sql",
          line: 3,
          statement: "DELETE FROM a",
          reason: expect.stringContaining("DELETE FROM"),
        },
      ],
    );
  });
});

describe("runGuard", () => {
  const files: Record<string, string> = {
    "supabase/migrations/002_new.sql": "DROP TABLE clients;",
    "supabase/migrations/003_safe.sql": "CREATE TABLE a (id int);",
  };
  const readFile = (path: string) => files[path];

  it("passes when there are no migration changes", () => {
    const changes = parseChanges(["M\tsrc/app.ts", "A\tdocs/x.md"]);
    expect(runGuard({ changes, readFile, env: {} }).exitCode).toBe(0);
  });

  it("passes a safe new migration", () => {
    const changes = parseChanges(["A\tsupabase/migrations/003_safe.sql"]);
    expect(runGuard({ changes, readFile, env: {} }).exitCode).toBe(0);
  });

  it("fails a destructive new migration with a readable message", () => {
    const changes = parseChanges(["A\tsupabase/migrations/002_new.sql"]);
    const result = runGuard({ changes, readFile, env: {} });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("supabase/migrations/002_new.sql line 1");
    expect(result.output).toContain("DROP TABLE clients");
    expect(result.output).toContain("data-loss-approved");
  });

  it.each(["M", "D"])("fails when a merged migration is changed (%s)", (s) => {
    const changes = parseChanges([`${s}\tsupabase/migrations/001_old.sql`]);
    const result = runGuard({ changes, readFile, env: {} });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("already merged");
  });

  it("accepts the colon form used for args", () => {
    const changes = parseChanges(["M:supabase/migrations/001_old.sql"]);
    expect(runGuard({ changes, readFile, env: {} }).exitCode).toBe(1);
  });

  it("DATA_LOSS_APPROVED=true bypasses but still lists the findings", () => {
    const changes = parseChanges([
      "A\tsupabase/migrations/002_new.sql",
      "M\tsupabase/migrations/001_old.sql",
    ]);
    const result = runGuard({
      changes,
      readFile,
      env: { DATA_LOSS_APPROVED: "true" },
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("DROP TABLE clients");
  });

  it("only the exact value true bypasses", () => {
    const changes = parseChanges(["A\tsupabase/migrations/002_new.sql"]);
    expect(
      runGuard({ changes, readFile, env: { DATA_LOSS_APPROVED: "yes" } })
        .exitCode,
    ).toBe(1);
  });
});

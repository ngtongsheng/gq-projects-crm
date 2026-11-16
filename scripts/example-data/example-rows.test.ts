import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ExampleData } from "./dataset.ts";
import { removeExampleRows } from "./example-rows.ts";
import { buildInstallers } from "./installation.ts";
import { EXAMPLE_REFERENCES } from "./table-references.ts";
import type { Row } from "./types.ts";

type Store = Record<string, Row[]>;

/** True when another row still points at `row` of `table`, as a foreign key would refuse. */
function isReferenced(store: Store, table: string, row: Row): boolean {
  return Object.entries(EXAMPLE_REFERENCES).some(([child, links]) =>
    Object.entries(links).some(
      ([column, parent]) =>
        parent === table &&
        (store[child] ?? []).some((c) => c[column] === row.id),
    ),
  );
}

/** Just enough of the Supabase client for the reset: select and delete filtered by `in`. */
function fakeClient(store: Store): SupabaseClient {
  const from = (table: string) => ({
    select: () => ({
      in: async (column: string, keys: string[]) => ({
        data: (store[table] ?? []).filter((r) =>
          keys.includes(String(r[column])),
        ),
        error: null,
      }),
    }),
    delete: () => ({
      in: async (column: string, keys: string[]) => {
        const rows = store[table] ?? [];
        const doomed = rows.filter((r) => keys.includes(String(r[column])));
        const kept = rows.filter((r) => !doomed.includes(r));
        const after = { ...store, [table]: kept };
        if (doomed.some((r) => isReferenced(after, table, r))) {
          return { error: { message: "violates foreign key constraint" } };
        }
        store[table] = kept;
        return { error: null };
      },
    }),
  });
  return { from } as unknown as SupabaseClient;
}

describe("removeExampleRows", () => {
  it("clears rows the team added in the app under example records", async () => {
    const store: Store = {
      projects: [{ id: "p1" }],
      mofs: [
        { id: "m1", project_id: "p1" },
        { id: "app-mof", project_id: "p1" },
      ],
      payments: [
        { id: "app-pay", mof_id: "m1" },
        { id: "app-pay-2", mof_id: "app-mof" },
      ],
      site_logs: [
        { id: "seeded-log", mof_id: "m1" },
        { id: "app-log", mof_id: "m1" },
      ],
      site_follow_ups: [{ id: "app-fu", site_log_id: "app-log" }],
      unrelated: [{ id: "keep" }],
    };
    const data: ExampleData = {
      tables: [
        { table: "projects", key: "id", rows: [{ id: "p1" }] },
        { table: "mofs", key: "id", rows: [{ id: "m1", project_id: "p1" }] },
        { table: "payments", key: "id", rows: [] },
        {
          table: "site_logs",
          key: "id",
          rows: [{ id: "seeded-log", mof_id: "m1" }],
        },
        { table: "site_follow_ups", key: "id", rows: [] },
      ],
      deliveriesToFinish: [],
    };

    await removeExampleRows(fakeClient(store), data);

    expect(store).toEqual({
      projects: [],
      mofs: [],
      payments: [],
      site_logs: [],
      site_follow_ups: [],
      unrelated: [{ id: "keep" }],
    });
  });

  it("removes installers the database made from old job names, under other ids", async () => {
    const store: Store = {
      installers: [
        { id: "made-by-migration", name_key: "apex installers" },
        { id: "made-by-trigger", name_key: "delta floor crew" },
        { id: "team-added", name_key: "someone else" },
      ],
    };
    const data: ExampleData = {
      tables: [buildInstallers()],
      deliveriesToFinish: [],
    };

    await removeExampleRows(fakeClient(store), data);

    expect(store.installers).toEqual([
      { id: "team-added", name_key: "someone else" },
    ]);
  });
});

import type { CalendarDate } from "../../src/lib/format/date.ts";
import type { PersonKey } from "./people.ts";

export type Row = Record<string, unknown>;

/** Profile id of each test person. */
export type People = Record<PersonKey, string>;

export type BuildContext = { people: People; today: CalendarDate };

/**
 * Rows for one table. `key` is the column the reset deletes by; `cleanupKeys` overrides
 * the key values when the table is cleaned up by its parent (rows added in the app).
 */
export type ExampleTable = {
  table: string;
  key: "id" | "mof_id" | "contact_id";
  rows: Row[];
  cleanupKeys?: string[];
};
